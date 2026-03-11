/**
 * lib/types.ts
 *
 * Shared TypeScript definitions for the capiTrade frontend.
 * These mirror the database schema and API response shapes.
 */

// ─── Enumerations ──────────────────────────────────────────────────────────────

export type TradePosition   = 'BUY' | 'SELL' | 'HOLD';
export type TradeStatus     = 'pending' | 'active' | 'completed' | 'cancelled';
export type ConversationPhase = 'pre_trade' | 'post_trade';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type AnalysisType    = 'research' | 'gut' | 'news' | 'guess';
export type KnowledgeType   = 'user_reasoning' | 'coaching_prompt' | 'educational_content';
export type MarketKey       = 'Americas' | 'Asia' | 'MiddleEast';

// ─── Core domain models ────────────────────────────────────────────────────────

/**
 * Represents a single trading position opened by the user.
 */
export interface Trade {
  id:           string;
  user_id:      string;
  market:       MarketKey;
  amount:       number;
  position:     TradePosition;
  entry_price:  number;
  exit_price:   number | null;
  status:       TradeStatus;
  waiting_days: 3 | 7;
  created_at:   string;
  completed_at: string | null;

  // Joined relations (optional, populated on select)
  bot_decisions?: BotDecision[];
  conversations?: Conversation[];
}

/**
 * A single message in a conversation thread.
 */
export interface ChatMessage {
  role:       'user' | 'assistant' | 'system';
  content:    string;
  timestamp?: string;
}

/**
 * A pre-trade or post-trade conversation between the user and the AI coach.
 */
export interface Conversation {
  id:                     string;
  trade_id:               string;
  phase:                  ConversationPhase;
  messages:               ChatMessage[];
  reasoning_quality_score: number | null;
  created_at:             string;
  updated_at?:            string;
}

/**
 * The quantitative bot's independent market decision for a given trade.
 */
export interface BotDecision {
  id:                string;
  trade_id:          string;
  position:          TradePosition;
  confidence_score:  number;   // 0–1
  technical_score:   number;   // 0–1
  volatility_score:  number;   // 0–1
  risk_reward_score: number;   // 0–1
  reasoning:         string;
  created_at:        string;
}

/**
 * Cached performance metrics for a user, recalculated after each completed trade.
 */
export interface UserMetrics {
  id:                   string;
  user_id:              string;
  total_trades:         number;
  win_rate:             number;   // 0–1 decimal
  sharpe_ratio:         number;
  max_drawdown:         number;   // 0–1 decimal
  avg_gain:             number;   // decimal (e.g. 0.05 = 5%)
  avg_loss:             number;   // decimal (negative, e.g. -0.03 = -3%)
  reasoning_quality_avg: number;  // 0–10 score
  updated_at:           string;
}

// ─── API response shapes ───────────────────────────────────────────────────────

export interface MarketSnapshot {
  key:            MarketKey;
  name:           string;
  region:         string;
  currentPrice:   number;
  changePercent:  number;
  prices:         number[];   // last 30 days of closing prices
  dates:          string[];   // ISO date strings matching prices
  botDecision:    BotDecision | null;
}

export interface MetricsSummary {
  totalTrades:          number;
  winRate:              number;   // percentage (e.g. 60.0 = 60%)
  sharpeRatio:          number;
  maxDrawdown:          number;   // percentage (e.g. 12.5 = 12.5%)
  avgGain:              number;   // percentage
  avgLoss:              number;   // percentage (negative)
  reasoningQualityAvg:  number;
  virtualBalance:       number;
  totalReturn:          number;   // percentage
}

export interface ChatResponse {
  reply:    string;
  messages: ChatMessage[];
}

// ─── Form / UI state types ─────────────────────────────────────────────────────

export interface PreTradeFormValues {
  market:          MarketKey;
  amount:          number;
  position:        TradePosition;
  waitingDays:     3 | 7;
  reasoning:       string;
  confidenceLevel: ConfidenceLevel;
  analysisType:    AnalysisType;
}

export interface PostTradeOutcome {
  userWon:  boolean;
  botWon:   boolean;
  scenario: 'user_right_bot_wrong' | 'user_wrong_bot_right' | 'both_wrong' | 'both_right';
  pnl:      number;
  exitPrice: number;
}

// ─── Supabase database helper types (used by generated client) ─────────────────

/**
 * Minimal Database type used by the Supabase client for type inference.
 * Replace with supabase gen types for full inference.
 */
export type Database = {
  public: {
    Tables: {
      users:          { Row: UserRow;         Insert: Partial<UserRow>;         Update: Partial<UserRow>         };
      trades:         { Row: Trade;           Insert: Partial<Trade>;           Update: Partial<Trade>           };
      bot_decisions:  { Row: BotDecision;     Insert: Partial<BotDecision>;     Update: Partial<BotDecision>     };
      conversations:  { Row: Conversation;    Insert: Partial<Conversation>;    Update: Partial<Conversation>    };
      user_metrics:   { Row: UserMetrics;     Insert: Partial<UserMetrics>;     Update: Partial<UserMetrics>     };
      knowledge_base: { Row: KnowledgeBaseRow; Insert: Partial<KnowledgeBaseRow>; Update: Partial<KnowledgeBaseRow> };
    };
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count:     number;
          filter?:         Record<string, unknown>;
        };
        Returns: Array<{
          id:         string;
          content:    string;
          metadata:   Record<string, unknown>;
          similarity: number;
        }>;
      };
    };
  };
};

export interface UserRow {
  id:              string;
  email:           string;
  created_at:      string;
  virtual_balance: number;
}

export interface KnowledgeBaseRow {
  id:         string;
  content:    string;
  embedding:  number[];
  metadata:   Record<string, unknown>;
  created_at: string;
}
