/**
 * rag-service.ts
 *
 * Retrieval-Augmented Generation helpers.
 *
 * generateEmbedding()      — converts text → vector using Voyage AI voyage-3-lite
 * searchSimilarTrades()    — finds past user trades most semantically similar to new reasoning
 * searchCoachingPrompts()  — retrieves relevant Socratic coaching prompts from the knowledge base
 *
 * Embedding model:  voyage-3-lite → 512 dimensions
 * Vector storage:   Supabase pgvector via the `match_documents` RPC function
 */

import { VoyageAIClient } from 'voyageai';
import { supabase } from './supabase-client';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface KnowledgeBaseRow {
  id:         string;
  content:    string;
  metadata:   Record<string, unknown>;
  similarity: number;
}

// ─── Embedding generation ──────────────────────────────────────────────────────

const voyage = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY,
});

const EMBEDDING_ZERO_VECTOR: number[] = new Array(512).fill(0);

/**
 * Converts a text string into a 512-dimensional embedding vector using
 * Voyage AI voyage-3-lite.
 *
 * Returns a zero vector of length 512 on any failure so callers keep working.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await voyage.embed({
      input: [text],
      model: 'voyage-3-lite',
    });
    return response.embeddings![0];
  } catch (err) {
    console.error('[rag-service] generateEmbedding failed, using zero-vector fallback:', err);
    return EMBEDDING_ZERO_VECTOR;
  }
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
  try {
    const embedding = await generateEmbedding(userReasoning);
    return matchDocuments(
      embedding,
      0.7,
      limit,
      { type: 'user_reasoning', user_id: userId }
    );
  } catch (err) {
    console.error('[rag-service] searchSimilarTrades error:', err);
    return [];
  }
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
  try {
    const embedding = await generateEmbedding(context);
    return matchDocuments(
      embedding,
      0.6,
      limit,
      { type: 'coaching_prompt' }
    );
  } catch (err) {
    console.error('[rag-service] searchCoachingPrompts error:', err);
    return [];
  }
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
