/**
 * rag-service.ts
 *
 * Retrieval-Augmented Generation helpers.
 *
 * generateEmbedding()      — converts text → vector using HuggingFace MiniLM
 * searchSimilarTrades()    — finds past user trades most semantically similar to new reasoning
 * searchCoachingPrompts()  — retrieves relevant Socratic coaching prompts from the knowledge base
 *
 * Embedding model:  sentence-transformers/all-MiniLM-L6-v2 → 384 dimensions
 * Vector storage:   Supabase pgvector via the `match_documents` RPC function
 */

import { supabase } from './supabase-client';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface KnowledgeBaseRow {
  id:         string;
  content:    string;
  metadata:   Record<string, unknown>;
  similarity: number;
}

// ─── Embedding generation ──────────────────────────────────────────────────────

const HF_API_URL =
  'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2';

/**
 * Converts a text string into a 384-dimensional embedding vector using the
 * HuggingFace Inference API (free tier).
 *
 * Throws on network errors or unexpected response shapes.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('HUGGINGFACE_API_KEY is not configured.');

  const response = await fetch(HF_API_URL, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text.trim(), options: { wait_for_model: true } }),
  });

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(`HuggingFace embedding error ${response.status}: ${msg}`);
  }

  const json = await response.json() as number[] | number[][];

  // MiniLM returns a 2-D array [[...]] when a single string is passed; flatten.
  if (Array.isArray(json[0])) return json[0] as number[];
  return json as number[];
}

// ─── Vector similarity search helpers ─────────────────────────────────────────

/**
 * Executes the `match_documents` Postgres RPC to find the `limit` most
 * semantically similar rows in `knowledge_base` that satisfy `filter`.
 */
async function matchDocuments(
  embedding:       number[],
  matchThreshold:  number,
  matchCount:      number,
  filter:          Record<string, unknown> = {}
): Promise<KnowledgeBaseRow[]> {
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: matchThreshold,
    match_count:     matchCount,
    filter,
  });

  if (error) {
    console.error('[rag-service] match_documents RPC error:', error.message);
    return [];
  }

  return (data as KnowledgeBaseRow[]) ?? [];
}

// ─── Public RAG functions ──────────────────────────────────────────────────────

/**
 * Retrieves the `limit` past trade reasoning entries by `userId` that are most
 * similar to the provided `userReasoning` text.
 *
 * These are used to personalise Socratic follow-up questions by reminding the
 * bot (and the user) of consistent patterns in their decision-making history.
 */
export async function searchSimilarTrades(
  userReasoning: string,
  userId:        string,
  limit:         number = 3
): Promise<KnowledgeBaseRow[]> {
  const embedding = await generateEmbedding(userReasoning);

  return matchDocuments(
    embedding,
    0.7,
    limit,
    { type: 'user_reasoning', user_id: userId }
  );
}

/**
 * Retrieves the `limit` coaching prompts from the knowledge base that are most
 * relevant to the provided `context` (e.g. the user's MCQ answer + reasoning).
 *
 * Coaching prompts are pre-seeded growth-mindset questions that guide Socratic
 * dialogue without giving direct advice.
 */
export async function searchCoachingPrompts(
  context: string,
  limit:   number = 2
): Promise<KnowledgeBaseRow[]> {
  const embedding = await generateEmbedding(context);

  return matchDocuments(
    embedding,
    0.6,
    limit,
    { type: 'coaching_prompt' }
  );
}

/**
 * Retrieves educational content snippets (e.g. explanations of Sharpe ratio,
 * drawdown, momentum) relevant to the user's reasoning or current trade context.
 */
export async function searchEducationalContent(
  context: string,
  limit:   number = 2
): Promise<KnowledgeBaseRow[]> {
  const embedding = await generateEmbedding(context);

  return matchDocuments(
    embedding,
    0.65,
    limit,
    { type: 'educational_content' }
  );
}

/**
 * Stores a new entry in the knowledge base vector table.
 * Used to persist user reasoning after each conversation turn for future retrieval.
 */
export async function storeEmbedding(
  content:  string,
  metadata: Record<string, unknown>
): Promise<void> {
  const embedding = await generateEmbedding(content);

  const { error } = await supabase.from('knowledge_base').insert({
    content,
    embedding,
    metadata,
  });

  if (error) {
    console.error('[rag-service] storeEmbedding error:', error.message);
  }
}
