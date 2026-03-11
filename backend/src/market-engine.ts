/**
 * market-engine.ts
 *
 * Pure quantitative bot decision engine — NO LLM.
 * Implements SMA, RSI, and weighted scoring to produce BUY / SELL / HOLD signals.
 *
 * Weights:
 *   Technical Analysis  40%  (SMA crossover + RSI)
 *   Volatility          30%  (standard deviation)
 *   Risk / Reward       20%  (recent high vs. low)
 *   Market Sentiment    10%  (neutral baseline for MVP)
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MarketData {
  prices: number[];
  dates:  string[];
}

export interface BotDecisionScores {
  technical:  number;
  volatility: number;
  riskReward: number;
  sentiment:  number;
  final:      number;
}

export interface BotDecision {
  position:   'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning:  string;
  scores:     BotDecisionScores;
}

export interface TradeForWinRate {
  position:    'BUY' | 'SELL' | 'HOLD';
  entry_price: number;
  exit_price:  number;
  status:      string;
}

// ─── Statistical helpers ───────────────────────────────────────────────────────

/**
 * Population standard deviation of an array of numbers.
 */
export function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean     = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ─── Technical indicators (manual implementation — no external packages) ───────

/**
 * Simple Moving Average for the last `period` values.
 * Returns NaN if there are not enough data points.
 */
function sma(prices: number[], period: number): number {
  if (prices.length < period) return NaN;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Relative Strength Index (Wilder's smoothed method) using a `period`-day window.
 * Returns a value in [0, 100], or NaN if there are not enough data points.
 */
function rsi(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return NaN;

  const changes = prices.slice(-(period + 1)).map((p, i, arr) =>
    i === 0 ? 0 : p - arr[i - 1]
  ).slice(1); // drop the first placeholder

  let avgGain = changes.filter((c) => c > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = changes.filter((c) => c < 0).map(Math.abs).reduce((a, b) => a + b, 0) / period;

  // Wilder smooth over remaining prices if available
  const remaining = prices.slice(-(prices.length - period - 1));
  for (let i = 1; i < remaining.length; i++) {
    const change = remaining[i] - remaining[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, change))  / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -change)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ─── Bot decision engine ───────────────────────────────────────────────────────

/**
 * Calculates an independent quantitative trading decision.
 *
 * Requires at least 50 price data points (for SMA-50).
 */
export async function calculateBotDecision(marketData: MarketData): Promise<BotDecision> {
  const { prices } = marketData;

  if (prices.length < 50) {
    throw new Error('Insufficient price data: need at least 50 data points for SMA-50.');
  }

  // ── 1. Technical Analysis (40%) ─────────────────────────────────────────────
  const currentSMA20 = sma(prices, 20);
  const currentSMA50 = sma(prices, 50);
  const currentRSI   = rsi(prices, 14);

  let technicalScore = 0;

  if (!isNaN(currentSMA20) && !isNaN(currentSMA50)) {
    if (currentSMA20 > currentSMA50) technicalScore += 0.5; // bullish crossover
  }

  if (!isNaN(currentRSI)) {
    if (currentRSI > 30 && currentRSI < 70) technicalScore += 0.5; // not extreme
    else if (currentRSI <= 30)              technicalScore += 0.3; // oversold → potential bounce
  }

  // ── 2. Volatility Assessment (30%) ──────────────────────────────────────────
  const recentWindow = prices.slice(-20);
  const stdDev       = calculateStdDev(recentWindow);
  // Normalised: lower std dev relative to mean → higher score
  const meanPrice    = recentWindow.reduce((a, b) => a + b, 0) / recentWindow.length;
  const cvPercent    = meanPrice > 0 ? (stdDev / meanPrice) * 100 : 100;
  // cv of ~0% → score 1.0; cv of ~5% or more → score approaching 0
  const volatilityScore = Math.max(0, 1 - cvPercent / 5);

  // ── 3. Risk / Reward Ratio (20%) ─────────────────────────────────────────────
  const recentHigh    = Math.max(...recentWindow);
  const recentLow     = Math.min(...recentWindow);
  const currentPrice  = prices.at(-1)!;

  const potentialGain = (recentHigh - currentPrice) / currentPrice;
  const potentialLoss = (currentPrice - recentLow)  / currentPrice;

  // Target ≥ 3:1 reward-to-risk for full score
  const riskRewardScore = potentialLoss > 0
    ? Math.min(1, (potentialGain / potentialLoss) / 3)
    : 0.5;

  // ── 4. Market Sentiment (10%) — neutral baseline for MVP ─────────────────────
  const sentimentScore = 0.5;

  // ── Weighted final score ─────────────────────────────────────────────────────
  const finalScore =
    technicalScore  * 0.4 +
    volatilityScore * 0.3 +
    riskRewardScore * 0.2 +
    sentimentScore  * 0.1;

  // ── Decision thresholds ──────────────────────────────────────────────────────
  let position: 'BUY' | 'SELL' | 'HOLD';
  if      (finalScore > 0.6) position = 'BUY';
  else if (finalScore < 0.4) position = 'SELL';
  else                       position = 'HOLD';

  // ── Human-readable reasoning ─────────────────────────────────────────────────
  const smaSignal = !isNaN(currentSMA20) && !isNaN(currentSMA50)
    ? currentSMA20 > currentSMA50
      ? 'SMA-20 is above SMA-50, indicating bullish momentum'
      : 'SMA-20 is below SMA-50, suggesting bearish pressure'
    : 'insufficient data for SMA crossover';

  const rsiSignal = !isNaN(currentRSI)
    ? currentRSI < 30 ? `RSI at ${currentRSI.toFixed(1)} shows oversold conditions (potential reversal)`
    : currentRSI > 70 ? `RSI at ${currentRSI.toFixed(1)} shows overbought conditions (caution)`
    : `RSI at ${currentRSI.toFixed(1)} is in neutral territory`
    : 'insufficient data for RSI';

  const volSignal = cvPercent < 2
    ? 'low volatility environment (stable trend)'
    : cvPercent < 4
    ? 'moderate volatility'
    : 'high volatility (elevated risk)';

  const rrSignal = riskRewardScore > 0.6
    ? 'risk/reward ratio is favourable'
    : riskRewardScore > 0.3
    ? 'risk/reward ratio is moderate'
    : 'risk/reward ratio is unfavourable';

  const reasoning = `${smaSignal}. ${rsiSignal}. Volatility is ${volSignal}. The ${rrSignal}. Composite score: ${(finalScore * 100).toFixed(0)}/100.`;

  return {
    position,
    confidence: parseFloat(finalScore.toFixed(4)),
    reasoning,
    scores: {
      technical:  parseFloat(technicalScore.toFixed(4)),
      volatility: parseFloat(volatilityScore.toFixed(4)),
      riskReward: parseFloat(riskRewardScore.toFixed(4)),
      sentiment:  sentimentScore,
      final:      parseFloat(finalScore.toFixed(4)),
    },
  };
}

// ─── Performance metric helpers ────────────────────────────────────────────────

/**
 * Annualised Sharpe Ratio.
 *
 * @param returns        Array of per-trade returns (e.g. 0.05 = 5%)
 * @param riskFreePerTrade Risk-free rate per trade period (default 0 for simplicity)
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreePerTrade: number = 0
): number {
  if (returns.length < 2) return 0;
  const excess  = returns.map((r) => r - riskFreePerTrade);
  const mean    = excess.reduce((a, b) => a + b, 0) / excess.length;
  const stdDev  = calculateStdDev(excess);
  if (stdDev === 0) return 0;
  // Annualise assuming ~252 trading periods per year
  return (mean / stdDev) * Math.sqrt(252);
}

/**
 * Maximum peak-to-trough drawdown across a series of portfolio values.
 * Returns a positive decimal (e.g. 0.15 = 15% drawdown).
 */
export function calculateMaxDrawdown(portfolioValues: number[]): number {
  if (portfolioValues.length === 0) return 0;
  let maxDrawdown = 0;
  let peak        = portfolioValues[0];

  for (const value of portfolioValues) {
    if (value > peak) peak = value;
    const drawdown = peak > 0 ? (peak - value) / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return maxDrawdown;
}

/**
 * Win rate as a decimal (e.g. 0.6 = 60%).
 * A trade is a "win" when the direction matched the price movement.
 */
export function calculateWinRate(trades: TradeForWinRate[]): number {
  const completed = trades.filter((t) => t.status === 'completed' && t.exit_price != null);
  if (completed.length === 0) return 0;

  const wins = completed.filter((t) =>
    (t.position === 'BUY'  && t.exit_price > t.entry_price) ||
    (t.position === 'SELL' && t.exit_price < t.entry_price)
  );

  return wins.length / completed.length;
}
