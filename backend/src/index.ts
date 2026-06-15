import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { supabase } from './supabase-client.js';
import { calculateBotDecision, calculateSharpeRatio, calculateMaxDrawdown, calculateWinRate } from './market-engine.js';
import { searchSimilarTrades, searchCoachingPrompts, generateEmbedding } from './rag-service.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? ''
});

console.log('[Config] ANTHROPIC_API_KEY present:', !!process.env.ANTHROPIC_API_KEY);

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    if (
      origin === 'https://capitrade1.vercel.app' ||
      origin === 'http://localhost:3000' ||
      /https:\/\/capitrade1.*\.vercel\.app$/.test(origin)
    ) {
      return origin
    }
    return 'https://capitrade1.vercel.app'
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  credentials: true,
}));


const MARKET_SYMBOLS: Record<string, { finnhub: string; name: string; region: string }> = {
  Americas:   { finnhub: 'SPY', name: 'S&P 500',    region: 'Americas'    },
  Asia:       { finnhub: 'EWJ', name: 'Nikkei 225', region: 'Asia'        },
  MiddleEast: { finnhub: 'KSA', name: 'Tadawul',    region: 'Middle East' },
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const FINNHUB_KEY  = process.env.FINNHUB_API_KEY ?? '';

function generateMockPrices(
  basePrice: number,
  days: number,
  volatility: number
): { prices: number[]; dates: string[] } {
  const prices: number[] = [];
  const dates: string[] = [];
  let price = basePrice;
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    const change = (Math.random() - 0.48) * volatility;
    price = price * (1 + change);
    prices.push(parseFloat(price.toFixed(2)));
    dates.push(date.toISOString().split('T')[0]);
  }
  return { prices, dates };
}

const MOCK_DATA: Record<string, { base: number; vol: number }> = {
  'SPY': { base: 580, vol: 0.008 },
  'EWJ': { base: 70,  vol: 0.009 },
  'KSA': { base: 38,  vol: 0.007 },
};

async function fetchFinnhubCandles(symbol: string, daysBack = 60): Promise<{ prices: number[]; dates: string[] }> {
  try {
    const to   = Math.floor(Date.now() / 1000);
    const from = to - daysBack * 24 * 60 * 60;
    const url  = `${FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_KEY}`;
    const res  = await fetch(url);
    if (!res.ok) {
      console.warn(`[Finnhub] HTTP ${res.status} for ${symbol}, using mock data`);
      const mock = MOCK_DATA[symbol] ?? { base: 100, vol: 0.008 };
      return generateMockPrices(mock.base, daysBack, mock.vol);
    }
    const json = await res.json() as { c?: number[]; t?: number[]; s?: string };
    if (json.s !== 'ok' || !json.c || !json.t || json.c.length === 0) {
      console.warn(`[Finnhub] No data (s=${json.s}) for ${symbol}, using mock data`);
      const mock = MOCK_DATA[symbol] ?? { base: 100, vol: 0.008 };
      return generateMockPrices(mock.base, daysBack, mock.vol);
    }
    return {
      prices: json.c,
      dates:  json.t.map((ts: number) => new Date(ts * 1000).toISOString().split('T')[0]),
    };
  } catch (err) {
    console.warn(`[Finnhub] Error fetching candles for ${symbol}:`, err, '— using mock data');
    const mock = MOCK_DATA[symbol] ?? { base: 100, vol: 0.008 };
    return generateMockPrices(mock.base, daysBack, mock.vol);
  }
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

  const tradeDate = new Date(trade.created_at)
  const now = new Date()
  const daysPassed = (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60 * 24)

  if (daysPassed < trade.waiting_days) {
    const daysRemaining = Math.ceil(trade.waiting_days - daysPassed)
    return c.json({ 
      success: false, 
      error: `Trade is locked for ${daysRemaining} more day${daysRemaining === 1 ? '' : 's'}. Come back when the waiting period ends.`
    }, 400)
  }

  const meta      = MARKET_SYMBOLS[trade.market];
  const exitPrice = meta ? await fetchFinnhubQuote(meta.finnhub) : trade.entry_price;
  const pnl =
    trade.position === 'BUY'  ? (exitPrice - trade.entry_price) / trade.entry_price * trade.amount :
    trade.position === 'SELL' ? (trade.entry_price - exitPrice) / trade.entry_price * trade.amount : 0;

  const { data: updated, error } = await supabase.from('trades')
    .update({ exit_price: exitPrice, status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', tradeId).select('*, bot_decisions(*)').single();
  if (error) return c.json({ success: false, error: error.message }, 500);

  const { data: profile } = await supabase.from('users').select('virtual_balance').eq('id', userId).single();
  if (profile) await supabase.from('users').update({ virtual_balance: profile.virtual_balance + trade.amount + pnl }).eq('id', userId);

  return c.json({ success: true, data: { trade: updated, pnl: parseFloat(pnl.toFixed(2)), exitPrice } });
});

// ─── Bot Chat ──────────────────────────────────────────────────────────────────

const SOCRATIC_FALLBACKS = [
  'What specific data or indicators influenced your decision?',
  'Have you considered how this market performed in similar conditions?',
  'What would need to happen for you to be wrong about this trade?',
  'How does your confidence level compare with the amount you are investing?',
];

function getRotatingFallback(): string {
  return SOCRATIC_FALLBACKS[Math.floor(Date.now() / 1000) % SOCRATIC_FALLBACKS.length];
}

app.post('/api/bot/chat', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ success: false, error: 'Missing x-user-id header' }, 401);

  try {
    const rawText = await c.req.text();
    console.log('=== RAW BODY ===', rawText);
    const body = JSON.parse(rawText) as {
      tradeId: string;
      phase: 'pre_trade' | 'post_trade';
      userMessage: string;
      confidenceLevel?: string;
      analysisType?: string;
      isFinalExchange?: boolean;
      exchangeNumber?: number;
      scenario?: string;
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      allTrades?: Array<{ market: string; position: string; amount: number | string; status: string }>;
      botDecision?: {
        position: string;
        confidence_score: number;
        technical_score?: number;
        volatility_score?: number;
        risk_reward_score?: number;
        reasoning?: string;
      } | null;
    };
    console.log('=== PARSED allTrades ===', JSON.stringify(body.allTrades));

    const { tradeId, phase, userMessage, confidenceLevel, analysisType, isFinalExchange, exchangeNumber, scenario, botDecision } = body;
    const allTrades = body.allTrades;
    const tradeContext = Array.isArray(allTrades) && allTrades.length > 0
      ? allTrades.map((t: any) =>
          `- ${t.market} | ${t.position} | $${t.amount} | Status: ${t.status}`
        ).join('\n')
      : 'No active trades.';
    const history = body.messages ?? [];

    const { data: trade } = await supabase.from('trades').select('*, bot_decisions(*)').eq('id', tradeId).single();
    const [similarTrades, coachingPrompts] = await Promise.all([
      searchSimilarTrades(userMessage, userId, 3),
      searchCoachingPrompts(userMessage, 2),
    ]);

    let preTradeContext = '';
    if (phase === 'post_trade' && tradeId) {
      const { data: preTrade } = await supabase
        .from('conversations')
        .select('messages')
        .eq('trade_id', tradeId)
        .eq('phase', 'pre_trade')
        .single();
      if (preTrade?.messages && Array.isArray(preTrade.messages)) {
        const formatted = preTrade.messages
          .map((m: any) => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.content}`)
          .join('\n');
        preTradeContext = `\nPRE-TRADE CONVERSATION FOR THIS TRADE:\n${formatted}`;
      }
    }

    const ragContext = [
      similarTrades?.length ? `Past similar trades:\n${similarTrades.map((t: { content: string }) => `- ${t.content}`).join('\n')}` : '',
      coachingPrompts?.length ? `Coaching prompts:\n${coachingPrompts.map((p: { content: string }) => `- ${p.content}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    const systemPrompt = [
      `You are a financial learning COACH for capiTrade. Your purpose is to help users improve their investment thinking through the Socratic method.`,
      ``,
      `RULES:`,
      `- NEVER give investment advice or tell the user what to buy, sell, or hold.`,
      `- Respond SPECIFICALLY to what the user just said — do not give generic answers.`,
      `- Reference the trade details below to make your responses relevant.`,
      `- Be encouraging but honest. Celebrate good reasoning, challenge weak reasoning.`,
      `- Never repeat a question that was already asked earlier in this conversation.`,
      `- When isFinalExchange is true, do NOT ask another question. Instead end the conversation with:`,
      `  Line 1: One sentence acknowledging what the user learned.`,
      `  Line 2: Empty line.`,
      `  Line 3: Start with "Lesson:" then one sentence — a specific, personal insight about THIS user's reasoning pattern based on everything discussed. Make it concrete, not generic.`,
      `  Example: "Lesson: You tend to act on news signals without checking if price momentum confirms the story."`,
      ``,
      `CRITICAL RULE: Ask exactly ONE question per response. Never ask two questions in the same message. If you have multiple things to explore, pick the single most important question and ask only that. Keep responses under 3 sentences + 1 question. Be concise.`,
      ``,
      `RESPONSE FORMAT — YOU MUST FOLLOW THIS EXACTLY:`,
      `Line 1: One short observation sentence (no bullet).`,
      `Line 2: empty line`,
      `Line 3: • First bullet — one sentence max`,
      `Line 4: • Second bullet — one sentence max`,
      `Line 5: • Third bullet — one sentence max (optional)`,
      `Line 6: empty line`,
      `Line 7: Your single question.`,
      ``,
      `NEVER write a sentence longer than 15 words.`,
      `NEVER combine two ideas in one sentence.`,
      `NEVER write more than 6 lines total.`,
      `If your response is a paragraph, you have failed. Rewrite it as bullets.`,
      ``,
      `TRADE CONTEXT:`,
      `- Phase: ${phase}`,
      `- Market: ${trade?.market ?? 'Unknown'}`,
      `- Position: ${trade?.position ?? 'Unknown'}`,
      `- Confidence level: ${confidenceLevel ?? 'not stated'}`,
      `- Analysis type: ${analysisType ?? 'not stated'}`,
      `- Is final exchange: ${isFinalExchange ? 'YES — close the conversation with a Lesson, do not ask a question' : 'no'}`,
      exchangeNumber !== undefined ? `- Exchange number: ${exchangeNumber}` : '',
      scenario ? `- Outcome scenario: ${scenario}` : '',
      botDecision ? [
        ``,
        `BOT'S INDEPENDENT QUANT DECISION:`,
        `- Position: ${botDecision.position}`,
        `- Confidence: ${botDecision.confidence_score != null ? Math.round(botDecision.confidence_score * 100) + '%' : 'N/A'}`,
        botDecision.technical_score   != null ? `- Technical score: ${Math.round(botDecision.technical_score * 100)}%`    : '',
        botDecision.volatility_score  != null ? `- Volatility score: ${Math.round(botDecision.volatility_score * 100)}%`  : '',
        botDecision.risk_reward_score != null ? `- Risk/reward score: ${Math.round(botDecision.risk_reward_score * 100)}%` : '',
        botDecision.reasoning ? `- Bot reasoning summary: ${botDecision.reasoning}` : '',
        ``,
        `INSTRUCTION: The user has already been told what the bot predicted in the opening message.`,
        `Throughout this conversation you MUST reference the bot's prediction when relevant.`,
        `Compare the user's qualitative reasoning against the bot's quantitative signals.`,
        `Do NOT hide what the bot thought — make the comparison explicit and educational.`,
        `Example: "My technical score flagged weakness here, but you acted on a news signal instead — that divergence is worth exploring."`,
      ].filter(Boolean).join('\n') : '',
      `\nCURRENT USER TRADES:\n${tradeContext}`,
      preTradeContext || '',
      ragContext ? `\nRAG CONTEXT:\n${ragContext}` : '',
      isFinalExchange ? `
FINAL EXCHANGE INSTRUCTION — THIS OVERRIDES ALL OTHER RULES:
This is the last message in the conversation. You MUST NOT ask any question. Do not end with a question mark. Instead:
1. Write one sentence acknowledging what the user just said.
2. Write a blank line.
3. Write "Lesson: " followed by one specific insight about this user's reasoning pattern based on the full conversation above. Make it personal and concrete — reference what they actually said. Example format: "Lesson: You tend to trust news consensus without checking whether price momentum already reflects that news."
Stop there. No question. No further commentary.` : '',
    ].filter(Boolean).join('\n');

    const chatHistory = [...history, { role: 'user' as const, content: userMessage }];
    let botReply = '';

    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        system: systemPrompt,
        messages: [
          ...chatHistory
            .filter((m: { role: string; content: string }) =>
              m.role === 'user' || m.role === 'assistant')
            .map((m: { role: string; content: string }) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
        ],
      });
      const block = message.content[0] as { type: string; text: string };
      botReply = block?.text?.trim() ?? getRotatingFallback();
      console.log('[Claude] Success:', botReply.substring(0, 60));
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      console.error('[Claude Error] Status:', error.status,
                    'Message:', error.message);
      botReply = getRotatingFallback();
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
  } catch (err) {
    console.error('[/api/bot/chat] Unhandled error:', err);
    return c.json({ success: false, error: 'Chat service unavailable' }, 500);
  }
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
app.get('/', (c) => c.json({ status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok', version: '1.0.1', timestamp: new Date().toISOString() }));

const port = process.env.PORT || 3001;

serve({ fetch: app.fetch, port: Number(port) }, (info) => {
  console.log(`Server running on port ${info.port}`);
});
