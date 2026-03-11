import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { supabase } from './supabase-client.js';
import { calculateBotDecision, calculateSharpeRatio, calculateMaxDrawdown, calculateWinRate } from './market-engine.js';
import { searchSimilarTrades, searchCoachingPrompts, generateEmbedding } from './rag-service.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

const MARKET_SYMBOLS: Record<string, { finnhub: string; name: string; region: string }> = {
  Americas:   { finnhub: 'SPY', name: 'S&P 500',    region: 'Americas'    },
  Asia:       { finnhub: 'EWJ', name: 'Nikkei 225', region: 'Asia'        },
  MiddleEast: { finnhub: 'KSA', name: 'Tadawul',    region: 'Middle East' },
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const FINNHUB_KEY  = process.env.FINNHUB_API_KEY ?? '';

async function fetchFinnhubCandles(symbol: string, daysBack = 60): Promise<{ prices: number[]; dates: string[] }> {
  const to   = Math.floor(Date.now() / 1000);
  const from = to - daysBack * 24 * 60 * 60;
  const url  = `${FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_KEY}`;
  const res  = await fetch(url);
  const json = await res.json() as { c?: number[]; t?: number[]; s?: string };
  if (json.s !== 'ok' || !json.c || !json.t) return { prices: [], dates: [] };
  return {
    prices: json.c,
    dates:  json.t.map((ts: number) => new Date(ts * 1000).toISOString().split('T')[0]),
  };
}

async function fetchFinnhubQuote(symbol: string): Promise<number> {
  const url  = `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
  const res  = await fetch(url);
  const json = await res.json() as { c?: number };
  return json.c ?? 0;
}

// ─── Market Data ───────────────────────────────────────────────────────────────
app.get('/api/markets', async (c) => {
  try {
    const results = await Promise.all(
      Object.entries(MARKET_SYMBOLS).map(async ([key, meta]) => {
        const { prices, dates } = await fetchFinnhubCandles(meta.finnhub, 60);
        const currentPrice  = prices.at(-1) ?? 0;
        const previousPrice = prices.at(-2) ?? currentPrice;
        const changePercent = previousPrice ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
        const botDecision   = prices.length >= 50 ? await calculateBotDecision({ prices, dates }) : null;
        return {
          key, name: meta.name, region: meta.region,
          currentPrice,
          changePercent: parseFloat(changePercent.toFixed(2)),
          prices: prices.slice(-30),
          dates: dates.slice(-30),
          botDecision,
        };
      })
    );
    return c.json({ success: true, data: results });
  } catch (err) {
    console.error('[/api/markets]', err);
    return c.json({ success: false, error: 'Failed to fetch market data' }, 500);
  }
});

// ─── Trades ────────────────────────────────────────────────────────────────────
app.get('/api/trades', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ success: false, error: 'Missing x-user-id header' }, 401);
  const { data, error } = await supabase
    .from('trades').select('*, bot_decisions (*), conversations (*)')
    .eq('user_id', userId).order('created_at', { ascending: false });
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

app.post('/api/trades', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ success: false, error: 'Missing x-user-id header' }, 401);

  // FIX: waiting_days typed as number (not literal union) — JSON parse won't narrow literals
  const body = await c.req.json<{
    market: string;
    amount: number;
    position: 'BUY' | 'SELL' | 'HOLD';
    waiting_days: number;
  }>();

  const meta = MARKET_SYMBOLS[body.market];
  if (!meta) return c.json({ success: false, error: 'Invalid market' }, 400);

  const entryPrice = await fetchFinnhubQuote(meta.finnhub);
  const { data: profile } = await supabase.from('users').select('virtual_balance').eq('id', userId).single();
  if (!profile || profile.virtual_balance < body.amount)
    return c.json({ success: false, error: 'Insufficient virtual balance' }, 400);

  const { data: trade, error: tradeErr } = await supabase.from('trades')
    .insert({
      user_id: userId, market: body.market, amount: body.amount,
      position: body.position, entry_price: entryPrice,
      status: 'active', waiting_days: body.waiting_days,
    })
    .select().single();
  if (tradeErr) return c.json({ success: false, error: tradeErr.message }, 500);

  await supabase.from('users').update({ virtual_balance: profile.virtual_balance - body.amount }).eq('id', userId);

  // Fire-and-forget bot decision
  (async () => {
    const { prices, dates } = await fetchFinnhubCandles(meta.finnhub, 60);
    if (prices.length < 50) return;
    const decision = await calculateBotDecision({ prices, dates });
    await supabase.from('bot_decisions').insert({
      trade_id: trade.id, position: decision.position,
      confidence_score: decision.confidence,
      technical_score: decision.scores.technical,
      volatility_score: decision.scores.volatility,
      risk_reward_score: decision.scores.riskReward,
      reasoning: decision.reasoning,
    });
  })();

  return c.json({ success: true, data: trade }, 201);
});

app.patch('/api/trades/:id/complete', async (c) => {
  const userId  = c.req.header('x-user-id');
  const tradeId = c.req.param('id');
  if (!userId) return c.json({ success: false, error: 'Missing x-user-id header' }, 401);

  const { data: trade } = await supabase.from('trades').select('*').eq('id', tradeId).eq('user_id', userId).single();
  if (!trade) return c.json({ success: false, error: 'Trade not found' }, 404);

  const meta      = MARKET_SYMBOLS[trade.market];
  const exitPrice = meta ? await fetchFinnhubQuote(meta.finnhub) : trade.entry_price;
  const pnl =
    trade.position === 'BUY'  ? (exitPrice - trade.entry_price) / trade.entry_price * trade.amount :
    trade.position === 'SELL' ? (trade.entry_price - exitPrice) / trade.entry_price * trade.amount : 0;

  const { data: updated, error } = await supabase.from('trades')
    .update({ exit_price: exitPrice, status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', tradeId).select().single();
  if (error) return c.json({ success: false, error: error.message }, 500);

  const { data: profile } = await supabase.from('users').select('virtual_balance').eq('id', userId).single();
  if (profile) await supabase.from('users').update({ virtual_balance: profile.virtual_balance + trade.amount + pnl }).eq('id', userId);

  return c.json({ success: true, data: { trade: updated, pnl: parseFloat(pnl.toFixed(2)), exitPrice } });
});

// ─── Bot Chat ──────────────────────────────────────────────────────────────────
app.post('/api/bot/chat', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ success: false, error: 'Missing x-user-id header' }, 401);

  const body = await c.req.json<{
    tradeId: string;
    phase: 'pre_trade' | 'post_trade';
    userMessage: string;
    confidenceLevel?: string;
    analysisType?: string;
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }>();

  const { tradeId, phase, userMessage, confidenceLevel, analysisType } = body;
  const history = body.messages ?? [];

  const { data: trade } = await supabase.from('trades').select('*, bot_decisions(*)').eq('id', tradeId).single();
  const [similarTrades, coachingPrompts] = await Promise.all([
    searchSimilarTrades(userMessage, userId, 3),
    searchCoachingPrompts(userMessage, 2),
  ]);

  const ragContext = [
    similarTrades?.length ? `Past similar trades:\n${similarTrades.map((t: { content: string }) => `- ${t.content}`).join('\n')}` : '',
    coachingPrompts?.length ? `Coaching prompts:\n${coachingPrompts.map((p: { content: string }) => `- ${p.content}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  const systemPrompt = [
    `You are a financial learning coach for capiTrade. Help users improve their investment thinking through Socratic dialogue.`,
    `NEVER give direct investment advice. Ask 1-2 thoughtful follow-up questions only.`,
    `\nContext:`,
    `- Phase: ${phase}`,
    `- Market: ${trade?.market ?? 'Unknown'}`,
    `- Position: ${trade?.position ?? 'Unknown'}`,
    `- Confidence: ${confidenceLevel ?? 'not stated'}`,
    `- Analysis type: ${analysisType ?? 'not stated'}`,
    trade?.bot_decisions?.[0] ? `- Bot decision: ${trade.bot_decisions[0].position}` : '',
    ragContext ? `\nRAG context:\n${ragContext}` : '',
  ].filter(Boolean).join('\n');

  const chatHistory = [...history, { role: 'user' as const, content: userMessage }];
  let botReply = '';

  try {
    const hfRes = await fetch('https://api-inference.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        messages: [{ role: 'system', content: systemPrompt }, ...chatHistory],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });
    const hfJson = await hfRes.json() as { choices?: Array<{ message: { content: string } }> };
    botReply = hfJson.choices?.[0]?.message?.content?.trim() ?? 'Could you tell me more about your reasoning?';
  } catch {
    botReply = 'What specific data or indicators influenced your decision?';
  }

  const updatedMessages = [...chatHistory, { role: 'assistant', content: botReply, timestamp: new Date().toISOString() }];
  await supabase.from('conversations').upsert(
    { trade_id: tradeId, phase, messages: updatedMessages, updated_at: new Date().toISOString() },
    { onConflict: 'trade_id,phase' }
  );

  try {
    const embedding = await generateEmbedding(userMessage);
    await supabase.from('knowledge_base').insert({
      content: userMessage, embedding,
      metadata: { type: 'user_reasoning', user_id: userId, trade_id: tradeId, phase },
    });
  } catch { /* non-critical */ }

  return c.json({ success: true, data: { reply: botReply, messages: updatedMessages } });
});

// ─── Metrics ───────────────────────────────────────────────────────────────────
app.get('/api/metrics', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ success: false, error: 'Missing x-user-id header' }, 401);

  const { data: trades } = await supabase.from('trades').select('*').eq('user_id', userId).eq('status', 'completed');
  const { data: profile } = await supabase.from('users').select('virtual_balance').eq('id', userId).single();
  const { data: metricsRow } = await supabase.from('user_metrics').select('*').eq('user_id', userId).single();

  if (!trades || trades.length === 0) {
    return c.json({
      success: true,
      data: {
        totalTrades: 0, winRate: 0, sharpeRatio: 0, maxDrawdown: 0,
        avgGain: 0, avgLoss: 0,
        reasoningQualityAvg: metricsRow?.reasoning_quality_avg ?? 0,
        virtualBalance: profile?.virtual_balance ?? 10000,
        totalReturn: 0,
      },
    });
  }

  // FIX: use explicit typed interface instead of inline annotations inside callbacks
  interface TradeRow { exit_price: number; entry_price: number; position: string; }
  const returns: number[] = trades.map((t: TradeRow) => {
    if (!t.exit_price || !t.entry_price) return 0;
    if (t.position === 'BUY')  return (t.exit_price - t.entry_price) / t.entry_price;
    if (t.position === 'SELL') return (t.entry_price - t.exit_price) / t.entry_price;
    return 0;
  });

  const gains  = returns.filter(r => r > 0);
  const losses = returns.filter(r => r < 0);

  // FIX: replace (_: unknown, i) with (_, i) — TypeScript infers fine here
  const portfolioValues = [
    10000,
    ...trades.map((_, i: number) =>
      10000 * returns.slice(0, i + 1).reduce((acc: number, r: number) => acc * (1 + r), 1)
    ),
  ];

  const metrics = {
    totalTrades: trades.length,
    winRate:      parseFloat((calculateWinRate(trades as Parameters<typeof calculateWinRate>[0]) * 100).toFixed(1)),
    sharpeRatio:  parseFloat(calculateSharpeRatio(returns, 0.02 / 252).toFixed(3)),
    maxDrawdown:  parseFloat((calculateMaxDrawdown(portfolioValues) * 100).toFixed(2)),
    avgGain:      gains.length  ? parseFloat((gains.reduce((a, b) => a + b, 0)  / gains.length  * 100).toFixed(2)) : 0,
    avgLoss:      losses.length ? parseFloat((losses.reduce((a, b) => a + b, 0) / losses.length * 100).toFixed(2)) : 0,
    reasoningQualityAvg: metricsRow?.reasoning_quality_avg ?? 0,
    virtualBalance:      profile?.virtual_balance ?? 10000,
    totalReturn: parseFloat(((returns.reduce((acc, r) => acc * (1 + r), 1) - 1) * 100).toFixed(2)),
  };

  await supabase.from('user_metrics').upsert({
    user_id: userId,
    total_trades: metrics.totalTrades,
    win_rate: metrics.winRate / 100,
    sharpe_ratio: metrics.sharpeRatio,
    max_drawdown: metrics.maxDrawdown / 100,
    avg_gain: metrics.avgGain / 100,
    avg_loss: metrics.avgLoss / 100,
    reasoning_quality_avg: metrics.reasoningQualityAvg,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return c.json({ success: true, data: metrics });
});

// ─── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

const PORT = parseInt(process.env.PORT ?? '3001', 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`capiTrade backend running on http://localhost:${info.port}`);
});
