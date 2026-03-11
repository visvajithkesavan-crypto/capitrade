# capiTrade — Complete Technical Documentation

## 1. Executive Summary

**capiTrade** is a gamified trading simulator that teaches financial decision-making through experience, reflection, and quantitative analysis. Unlike traditional paper trading platforms that simply track wins and losses, capiTrade integrates an AI companion that evaluates the *quality of thinking* behind each trade, uses real financial models to make independent market decisions, and guides users toward better risk-adjusted returns through Socratic dialogue.

The platform combines real-time market data, quantitative trading logic, RAG-powered AI conversations, and behavioral finance principles inspired by Carol S. Dweck's *Mindset* to create a learning environment where users develop both the analytical skills and mental models needed for successful investing.

**Key Innovation:** The bot does not automatically oppose the user. Instead, it makes its own independent market analysis using quantitative models and engages users in pre-trade conversations powered by RAG to assess their reasoning quality — creating productive confusion that drives self-directed learning.

---

## 2. Problem Statement

Many people want to learn about investing but struggle because most learning methods are either:

**Passive Learning:**
- Watching trading tutorials
- Reading financial blogs
- Copying investment advice from influencers
- Following tips without understanding reasoning

**Unguided Practice:**
- Using trading simulators that only show profit/loss
- Making decisions without understanding risk management
- Learning through trial and error without reflection
- No feedback on *why* decisions succeeded or failed

**The Result:**
- Beginners often gamble rather than invest
- Users fail to develop analytical thinking skills
- People confuse luck with skill
- Lack of understanding of financial metrics (Sharpe ratio, risk-adjusted returns, drawdown)
- Many lose confidence in their ability to invest intelligently

**What's Missing:** A platform that teaches users *how to think* about investing, not *what to buy*. One that evaluates decision quality, not just outcomes, and integrates real financial metrics that professionals use.

---

## 3. Solution

capiTrade solves this by creating a **quantitatively-driven, conversation-based learning environment** where users learn through:

### Experience
- Make real investment decisions using virtual capital
- Face real market scenarios with actual market data
- Live with the consequences of decisions over 3-7 day periods

### Reflection Through Conversation (RAG-Powered)
- **Pre-trade discussion:** Bot assesses reasoning quality before trade is locked using RAG to pull relevant context
- **Post-trade analysis:** Four outcome scenarios drive different learning paths
- **Socratic method:** Bot asks questions informed by past user patterns, never gives direct answers
- **Productive confusion:** Conversations reveal knowledge gaps and spark curiosity

### Quantitative Analysis
- Bot makes independent decisions using technical indicators (moving averages, RSI, MACD)
- Calculates risk metrics (Sharpe ratio, volatility, drawdown)
- Evaluates trades using real financial metrics professionals use
- Users learn to measure success by risk-adjusted returns, not just profit

### Growth Mindset
- Mistakes are reframed as data, not failures
- Focus on improving reasoning quality over time
- Bot learns from users who demonstrate strong analytical thinking
- Celebrates process improvement, not just winning trades

**Core Philosophy:** No advice, no tips — purely learning through doing and understanding.

---

## 4. Target Audience

### Primary Users
- **Beginner Investors** — People who want to learn investing but lack experience and don't know where to start
- **College Students** — Students interested in finance, trading, or economics who want practical experience beyond textbooks
- **Finance Learners** — Individuals studying markets who want to develop real analytical skills
- **Career Switchers** — Professionals moving into fintech or finance roles who need to demonstrate market understanding

### What Makes Them Ideal Users
- Curious about investing but intimidated by complexity
- Want to understand *why* things work, not just *what* to do
- Willing to reflect on their decisions
- Value learning over quick profits
- Interested in developing genuine financial literacy

---

## 5. Product Features

### MVP Features (Phase 1) — Locked Scope

**1. Virtual Trading Capital**
- Users start with $10,000 virtual balance
- Can allocate capital across different positions
- Portfolio tracking in real-time

**2. Real Market Scenarios (3 Regional Markets)**
- **Locked for MVP:** Americas (S&P 500), Asia (Nikkei 225 or Hang Seng), Middle East (Tadawul)
- Real-time market data displayed with current prices and recent trends
- Data sourced from yfinance (development) and Finnhub (production)

**3. Pre-Trade Conversation (Core Innovation with RAG)**
- Bot initiates dialogue before trade is finalized: *"What made you choose this investment?"*
- **Text input** for reasoning explanation (primary)
- **MCQ questions** for quick classification:
  - "How confident are you? (Low / Medium / High)"
  - "What type of analysis did you do? (Research-based / Gut feeling / No analysis)"
- RAG system retrieves:
  - User's similar past trades
  - Relevant coaching prompts
  - Growth mindset question templates
- Assesses reasoning quality and asks follow-up questions
- Encourages users to research further before committing

**4. Independent Bot Decision Engine (Quantitative Model)**

**Critical: This is NOT an LLM making predictions. This is a pure quantitative model you code.**

Bot analyzes market using:

```python
# Simplified Bot Decision Logic
def calculate_bot_position(market_data):
    # Technical Analysis (40%)
    sma_20 = calculate_sma(market_data, 20)
    sma_50 = calculate_sma(market_data, 50)
    rsi = calculate_rsi(market_data, 14)
    
    technical_score = 0
    if sma_20 > sma_50:
        technical_score += 0.5  # Bullish signal
    if 30 < rsi < 70:
        technical_score += 0.5  # Not overbought/oversold
    
    # Volatility Assessment (30%)
    std_dev = calculate_std_dev(market_data, 20)
    volatility_score = max(0, 1 - (std_dev / 100))
    
    # Risk/Reward Ratio (20%)
    recent_high = max(market_data[-20:])
    recent_low = min(market_data[-20:])
    current_price = market_data[-1]
    
    potential_gain = (recent_high - current_price) / current_price
    potential_loss = (current_price - recent_low) / current_price
    
    if potential_loss > 0:
        risk_reward_score = min(1, potential_gain / potential_loss / 3)
    else:
        risk_reward_score = 0.5
    
    # Market Sentiment (10%) - simplified for MVP
    sentiment_score = 0.5  # Neutral baseline
    
    # Weighted Final Score
    final_score = (
        technical_score * 0.4 +
        volatility_score * 0.3 +
        risk_reward_score * 0.2 +
        sentiment_score * 0.1
    )
    
    # Decision Thresholds
    if final_score > 0.6:
        return "BUY", final_score
    elif final_score < 0.4:
        return "SELL", final_score
    else:
        return "HOLD", final_score
```

**Key Points:**
- Bot makes its own position based on data, not by opposing user
- May agree or disagree with user's choice
- All calculations are transparent and explainable

**5. Waiting Period & Position Tracking**
- **Default: 3 days** (user can choose 7 days)
- Real-time price updates visible but no early exit
- Builds discipline in holding positions
- Teaches patience and conviction

**6. Post-Trade Reflective Discussion (Four Scenarios)**

**User Right, Bot Wrong:**
- Bot acknowledges user's success: *"What signals did you spot that I missed?"*
- RAG retrieves similar successful trades for pattern recognition
- Reinforces confidence in research-driven decisions

**User Wrong, Bot Right:**
- Bot guides reflection: *"What data would have changed your mind?"*
- Helps identify overlooked indicators
- RAG pulls relevant educational content about missed concepts

**Both Wrong:**
- Collaborative reflection: *"Neither of us saw this coming. What did we both miss?"*
- Teaches humility and limits of prediction
- Reinforces importance of risk management

**Both Right:**
- Philosophy discussion: *"We both made money but for different reasons. You saw growth, I saw value. Let's compare."*
- Explores different valid investment approaches
- Builds nuanced understanding of multiple strategies

**7. Performance Dashboard with Financial Metrics**

Basic Metrics:
- Total Return (%)
- Win Rate
- Average Gain/Loss per Trade
- Current Portfolio Value

Professional Metrics (What Sets This Apart):
- **Sharpe Ratio** — Return per unit of risk (industry standard)
- **Max Drawdown** — Largest peak-to-trough decline
- **Volatility** — Standard deviation of returns
- **Risk-Adjusted Return** — Profit relative to risk taken
- **Reasoning Quality Score** — Bot's assessment of decision logic improvement over time

**8. Reasoning Log Archive**
- Users can review past trades and their thought processes
- See how reasoning evolved over time
- Identify patterns in decision-making
- Used by RAG system to personalize future conversations

### Future Features (Phase 2+)

**Advanced Analytics:**
- Sortino ratio, Calmar ratio, win/loss ratio analysis
- Portfolio diversification scoring
- Sector allocation visualization
- Performance comparison (user vs. bot vs. market benchmark)

**Gamification & Community:**
- Achievement system based on reasoning quality, not just profit
- Leaderboard ranked by risk-adjusted returns (Sharpe ratio)
- Anonymized trade reasoning sharing
- Community discussions on investment approaches

**Bot Learning & Fine-Tuning:**
- Fine-tune LLM on collected conversation data
- Bot learns from aggregate user patterns
- Identifies successful reasoning strategies
- Adapts conversation style based on user level

**Advanced Scenarios:**
- Individual stocks (Phase 2)
- Multi-asset portfolios
- Options trading education
- Portfolio rebalancing challenges
- Crisis scenario simulations (market crashes, volatility spikes)

---

## 6. How It Works (Step-by-Step User Flow)

### Step 1: Onboarding
- User creates account and receives $10,000 virtual capital
- Brief introduction: *"We don't tell you what to do. We help you understand why you do it."*
- Platform philosophy explained: learning through experience and reflection

### Step 2: Market Scenario Presented
- Real-time data for 3 regional markets displayed
- User sees current prices, recent trends (line charts), basic information
- Example: "Which market will perform better over the next 3 days: Americas, Asia, or Middle East?"

### Step 3: User Makes Investment Decision
- User selects market(s) and allocates capital
- Can invest in one or multiple options
- Must commit minimum amount (e.g., $100)

### Step 4: Pre-Trade Conversation Begins

**Step 4a: Initial Question**
- Bot asks: *"What made you choose this investment?"*
- User types reasoning (text input, primary method)

**Step 4b: Quick Classification (MCQ)**
- "How confident are you in this decision?"
  - [ ] Low confidence
  - [ ] Medium confidence
  - [ ] High confidence
- "What influenced your decision most?"
  - [ ] Research and data
  - [ ] Gut feeling/intuition
  - [ ] News/social media
  - [ ] Just guessing

**Step 4c: RAG-Powered Follow-up**
- Bot retrieves from vector DB:
  - User's 2-3 most similar past trades
  - Relevant coaching prompts based on confidence level
  - Growth mindset question templates
- Bot asks personalized follow-up:
  - If research-backed: *"What specific metric influenced you most?"*
  - If intuition-based: *"Have you looked at how this market performed in similar conditions?"*
  - If uninformed: *"What information would help you feel more confident in this decision?"*

**Goal:** Create productive confusion that motivates research without being condescending

### Step 5: Bot Makes Independent Decision
- Bot analyzes the same 3 markets using quantitative model
- Calculates technical score, volatility, risk/reward for each
- Takes position based on weighted score
- **May align with user or differ** — not automatically opposite
- Bot's reasoning is logged for post-trade discussion

### Step 6: Trade Locked & Waiting Period
- Both positions are locked for chosen period (3 or 7 days)
- User can track real-time price movement via dashboard
- No early exit allowed (teaches commitment and patience)
- Timer countdown visible

### Step 7: Market Outcome Determined
- After waiting period, real market performance decides results
- Profit/loss calculated for both user and bot
- Outcome classified into one of four scenarios
- Notifications sent to user

### Step 8: Post-Trade Reflective Discussion
- Bot initiates conversation based on outcome scenario
- RAG retrieves relevant context:
  - This trade's pre-trade conversation
  - Similar past trades by this user
  - Relevant educational content
- Asks questions to guide reflection, never directly instructs
- Introduces relevant financial concepts organically (e.g., "Have you heard of the Sharpe ratio?")
- Updates user's reasoning quality score

### Step 9: Dashboard Update
- Portfolio value updated
- Performance metrics recalculated (Sharpe ratio, win rate, etc.)
- New reasoning log entry created with full conversation history
- Trade stored in vector DB for future RAG retrieval

### Step 10: Next Scenario
- User ready for next trade with enhanced understanding
- Can review past trades before making new decisions
- Continuous learning cycle
- Bot conversations become more personalized over time

---

## 7. What Makes capiTrade Different

### vs. Traditional Paper Trading Platforms (Investopedia, TradingView)
- **They focus on:** Profit/loss tracking
- **capiTrade focuses on:** Quality of reasoning and decision process
- **Key difference:** Pre-trade conversation assesses thinking before execution, RAG personalizes learning

### vs. Educational Apps (Duolingo for Finance, Zogo)
- **They focus on:** Quiz-based knowledge testing
- **capiTrade focuses on:** Learning through real market experience
- **Key difference:** Outcomes determined by actual markets, not pre-written answers

### vs. Robo-Advisors (Betterment, Wealthfront)
- **They focus on:** Automated portfolio management
- **capiTrade focuses on:** Teaching users to think for themselves
- **Key difference:** No advice given, only questions asked

### vs. Financial News/Advice Platforms (Motley Fool, Seeking Alpha)
- **They focus on:** Telling users what to buy
- **capiTrade focuses on:** Teaching users how to analyze
- **Key difference:** Socratic method powered by RAG, not prescription

### Unique Value Proposition
**"Most trading simulators focus on profit. capiTrade focuses on process. Because in real markets, luck runs out — but a solid decision-making framework compounds forever."**

---

## 8. Technical Architecture

### Tech Stack Overview (Optimized for Solo Dev with AI Agents)

| Layer | Technology | Why This Choice |
|-------|-----------|-----------------|
| **Frontend** | Next.js 14 + Tailwind + shadcn/ui | Fast development, great with v0 for UI generation |
| **UI Prototyping** | v0 by Vercel | Generate production-quality UI components quickly |
| **Backend** | Hono.js on Node.js/Bun | Extremely fast, lightweight, minimal boilerplate |
| **Database** | Supabase (PostgreSQL + pgvector) | Built-in auth, RAG support, free tier generous |
| **AI Model** | Llama 3.1 8B Instruct | Free, open-source, good for conversation |
| **AI Hosting** | Hugging Face Inference API | Free tier available, easy integration |
| **RAG/Vectors** | Supabase pgvector | No separate vector DB needed |
| **Market Data** | yfinance (dev) → Finnhub (prod) | Free for both tiers |
| **Deployment** | Vercel (frontend) + Railway (backend) | Free tiers, zero-config deployment |
| **Code Assistant** | Cursor + GitHub Copilot | AI agents help with implementation |

### Frontend Architecture

**Framework: Next.js 14 with App Router**
- Server components for better performance
- API routes for backend communication
- Real-time updates via Server-Sent Events or WebSockets

**UI Development Workflow:**
1. Design screens in v0 by Vercel (prompt-based UI generation)
2. Export generated components to project
3. Integrate with shadcn/ui for consistent design system
4. Use Cursor to refine and connect to backend APIs

**Key Libraries:**
- `@tanstack/react-query` - Data fetching and caching
- `zustand` - Lightweight state management
- `recharts` or `lightweight-charts` - Market data visualization
- `framer-motion` - Smooth animations for better UX

**Pages/Routes:**
```
/                    → Landing page
/login               → Authentication
/dashboard           → Main dashboard with portfolio
/trade               → Market selection and pre-trade conversation
/trade/[id]          → Active trade tracking
/trade/[id]/review   → Post-trade reflection
/history             → Past trades and reasoning logs
/profile             → User settings and stats
```

### Backend Architecture

**Framework: Hono.js**

Why Hono over NestJS for this project:
- 3-5x faster cold starts (important for free hosting tiers)
- Much simpler codebase (easier for solo dev + AI agents)
- Runs on Node.js, Bun, or edge (future-proof)
- Minimal boilerplate, faster development

**API Structure:**
```
/api/auth/*          → Authentication (handled by Supabase)
/api/markets         → Get current market data
/api/trades          → CRUD for trades
/api/bot/analyze     → Trigger bot decision engine
/api/bot/chat        → Pre/post-trade conversations (RAG-powered)
/api/metrics         → Calculate user performance metrics
/api/rag/search      → Vector similarity search
```

**Background Jobs (BullMQ with Redis):**
- Trade outcome calculations (scheduled for end of waiting period)
- Market data refreshing (every 5 minutes during market hours)
- Performance metrics recalculation

### Database Schema (Supabase PostgreSQL)

**Core Tables:**

```sql
-- Users (handled by Supabase Auth)
users (
  id UUID PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMP,
  virtual_balance DECIMAL DEFAULT 10000
)

-- Trades
trades (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  market TEXT,  -- 'Americas', 'Asia', 'Middle East'
  amount DECIMAL,
  position TEXT,  -- 'BUY', 'SELL', 'HOLD'
  entry_price DECIMAL,
  exit_price DECIMAL,
  status TEXT,  -- 'pending', 'active', 'completed'
  waiting_days INTEGER,  -- 3 or 7
  created_at TIMESTAMP,
  completed_at TIMESTAMP
)

-- Bot Decisions (parallel to user trades)
bot_decisions (
  id UUID PRIMARY KEY,
  trade_id UUID REFERENCES trades(id),
  position TEXT,
  confidence_score DECIMAL,
  technical_score DECIMAL,
  volatility_score DECIMAL,
  risk_reward_score DECIMAL,
  reasoning TEXT,
  created_at TIMESTAMP
)

-- Conversations (for RAG and history)
conversations (
  id UUID PRIMARY KEY,
  trade_id UUID REFERENCES trades(id),
  phase TEXT,  -- 'pre_trade' or 'post_trade'
  messages JSONB,  -- Array of {role, content, timestamp}
  reasoning_quality_score DECIMAL,
  created_at TIMESTAMP
)

-- User Metrics (cached calculations)
user_metrics (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  total_trades INTEGER,
  win_rate DECIMAL,
  sharpe_ratio DECIMAL,
  max_drawdown DECIMAL,
  avg_gain DECIMAL,
  avg_loss DECIMAL,
  reasoning_quality_avg DECIMAL,
  updated_at TIMESTAMP
)

-- RAG Knowledge Base (with pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

knowledge_base (
  id UUID PRIMARY KEY,
  content TEXT,
  embedding VECTOR(1536),  -- For text-embedding-ada-002 or similar
  metadata JSONB,  -- {type: 'coaching_prompt' | 'user_reasoning' | 'educational_content'}
  created_at TIMESTAMP
)

-- Indexes for RAG similarity search
CREATE INDEX ON knowledge_base USING ivfflat (embedding vector_cosine_ops);
```

**Seeded Content for RAG:**
- 20-30 coaching prompt templates (growth mindset questions)
- Educational snippets (Sharpe ratio, risk management, technical indicators)
- Example reasoning patterns (good vs. poor analysis)

### AI Conversation Layer (Two-System Architecture)

**System 1: Conversation Bot (LLM + RAG)**

**Model: Llama 3.1 8B Instruct**
- Hosted on Hugging Face Inference API (free tier: 1000 requests/day)
- No fine-tuning in MVP (use as-is with good prompts)

**RAG Pipeline:**

```
User submits reasoning
    ↓
Generate embedding of user text
    ↓
Search knowledge_base table for similar vectors
    ↓
Retrieve:
  - 2-3 similar past trades by this user
  - 2-3 relevant coaching prompts
  - 1-2 educational snippets if needed
    ↓
Build context for LLM:
  - System prompt (growth mindset, Socratic method)
  - Retrieved RAG context
  - Current trade details
  - User's MCQ responses
    ↓
Send to Llama 3.1 8B
    ↓
Get personalized follow-up question
    ↓
Store conversation + generate embedding
    ↓
Save to knowledge_base for future RAG
```

**Embedding Model:**
- Use Hugging Face's `sentence-transformers/all-MiniLM-L6-v2` (free, fast, good quality)
- Alternative: OpenAI `text-embedding-3-small` if budget allows

**System Prompt Template:**
```
You are a financial learning coach for capiTrade. Your role is to help users improve their investment thinking through Socratic dialogue.

Core principles:
- Never give direct advice or tell users what to buy/sell
- Ask thoughtful questions that reveal gaps in reasoning
- Adopt a growth mindset: mistakes are learning opportunities
- Be encouraging but honest
- Reference specific data when available

Context about this user:
- Past similar trades: {rag_past_trades}
- Current trade: {current_trade_details}
- Confidence level: {confidence_mcq}

Your goal: Ask 1-2 follow-up questions that create productive confusion and motivate research.
```

**System 2: Market Decision Engine (Quantitative Model)**

**Not an LLM — pure Python/TypeScript code.**

**Library: TA-Lib (Technical Analysis Library)**
- Install: `pip install TA-Lib` or `npm install technicalindicators`
- Provides pre-built functions for SMA, RSI, MACD, etc.

**Implementation:**
```typescript
// market-engine.ts
import { SMA, RSI } from 'technicalindicators';

interface MarketData {
  prices: number[];
  dates: string[];
}

interface BotDecision {
  position: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
}

export async function calculateBotDecision(
  marketData: MarketData
): Promise<BotDecision> {
  // Technical Analysis (40%)
  const sma20 = SMA.calculate({ period: 20, values: marketData.prices });
  const sma50 = SMA.calculate({ period: 50, values: marketData.prices });
  const rsi = RSI.calculate({ period: 14, values: marketData.prices });
  
  let technicalScore = 0;
  const currentSMA20 = sma20[sma20.length - 1];
  const currentSMA50 = sma50[sma50.length - 1];
  const currentRSI = rsi[rsi.length - 1];
  
  if (currentSMA20 > currentSMA50) technicalScore += 0.5;
  if (currentRSI > 30 && currentRSI < 70) technicalScore += 0.5;
  
  // Volatility Assessment (30%)
  const stdDev = calculateStdDev(marketData.prices.slice(-20));
  const volatilityScore = Math.max(0, 1 - (stdDev / 100));
  
  // Risk/Reward (20%)
  const recentPrices = marketData.prices.slice(-20);
  const recentHigh = Math.max(...recentPrices);
  const recentLow = Math.min(...recentPrices);
  const currentPrice = marketData.prices[marketData.prices.length - 1];
  
  const potentialGain = (recentHigh - currentPrice) / currentPrice;
  const potentialLoss = (currentPrice - recentLow) / currentPrice;
  const riskRewardScore = potentialLoss > 0 
    ? Math.min(1, (potentialGain / potentialLoss) / 3)
    : 0.5;
  
  // Market Sentiment (10%) - simplified for MVP
  const sentimentScore = 0.5;
  
  // Weighted Score
  const finalScore = (
    technicalScore * 0.4 +
    volatilityScore * 0.3 +
    riskRewardScore * 0.2 +
    sentimentScore * 0.1
  );
  
  // Decision Logic
  let position: 'BUY' | 'SELL' | 'HOLD';
  if (finalScore > 0.6) position = 'BUY';
  else if (finalScore < 0.4) position = 'SELL';
  else position = 'HOLD';
  
  // Generate reasoning
  const reasoning = `Technical indicators ${currentSMA20 > currentSMA50 ? 'show bullish momentum' : 'suggest caution'}. RSI at ${currentRSI.toFixed(1)} indicates ${currentRSI < 30 ? 'oversold' : currentRSI > 70 ? 'overbought' : 'neutral'} conditions. Volatility is ${volatilityScore > 0.7 ? 'low' : volatilityScore > 0.4 ? 'moderate' : 'high'}. Risk/reward ratio is ${riskRewardScore > 0.6 ? 'favorable' : 'unfavorable'}.`;
  
  return {
    position,
    confidence: finalScore,
    reasoning
  };
}

function calculateStdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}
```

### Market Data Integration

**Development: yfinance (Python)**
```python
import yfinance as yf

def get_market_data(ticker: str, period: str = "1mo"):
    """
    Fetch market data for regional indices
    ticker: '^GSPC' (S&P 500), '^N225' (Nikkei), 'TASI.SR' (Tadawul)
    """
    data = yf.download(ticker, period=period)
    return {
        'prices': data['Close'].tolist(),
        'dates': data.index.strftime('%Y-%m-%d').tolist()
    }
```

**Production: Finnhub API**
```typescript
// finnhub-client.ts
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = 'https://finnhub.io/api/v1';

export async function getMarketQuote(symbol: string) {
  const response = await fetch(
    `${BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
  );
  return response.json();
}

export async function getMarketCandles(
  symbol: string,
  from: number,
  to: number
) {
  const response = await fetch(
    `${BASE_URL}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
  );
  return response.json();
}
```

**Symbol Mapping:**
- Americas: `^GSPC` (yfinance) / `SPY` (Finnhub)
- Asia: `^N225` (yfinance) / `NI225` (Finnhub)
- Middle East: `TASI.SR` (yfinance) / Custom handling

### Deployment Strategy

**Frontend (Vercel):**
- Connect GitHub repo
- Auto-deploy on push to main
- Environment variables in Vercel dashboard
- Free tier: Unlimited bandwidth

**Backend (Railway):**
- Deploy Hono.js app
- Connect Supabase via environment variables
- Add Redis addon for BullMQ
- Free tier: 500 hours/month, $5 credit

**Database (Supabase):**
- Free tier: 500MB database, unlimited API requests
- Enable pgvector extension in SQL editor
- Row Level Security (RLS) for data protection

**AI Inference:**
- Hugging Face Inference API (free tier)
- Fallback to local Llama if needed

### Monitoring & Analytics

**Error Tracking: Sentry**
- Free tier: 5000 events/month
- Track backend errors, failed API calls

**User Analytics: PostHog**
- Free tier: 1M events/month
- Track user flows, conversation completion rates

**Custom Metrics Dashboard:**
- Build in Next.js admin panel
- Track: trades/day, bot win rate, avg reasoning quality

---

## 9. Development Roadmap

### Phase 1: MVP (4-6 weeks)

**Week 1-2: Foundation**
- [ ] Set up Supabase project + enable pgvector
- [ ] Design database schema and seed data
- [ ] Set up Next.js + Hono.js projects
- [ ] Create basic UI wireframes in v0
- [ ] Set up authentication (Supabase Auth)

**Week 3-4: Core Features**
- [ ] Market data integration (yfinance first)
- [ ] Build bot decision engine (quantitative model)
- [ ] Implement pre-trade conversation flow
  - [ ] Text input + MCQ
  - [ ] Basic RAG: retrieve similar trades
  - [ ] Llama 3.1 integration via Hugging Face
- [ ] Trade creation and storage
- [ ] Waiting period timer system (BullMQ)

**Week 5-6: Polish & Deploy**
- [ ] Post-trade reflection (4 scenarios)
- [ ] Performance dashboard with Sharpe ratio
- [ ] Reasoning log archive
- [ ] Testing (user flow, bot decisions, edge cases)
- [ ] Deploy to production (Vercel + Railway)
- [ ] Switch to Finnhub for market data

**MVP Success Criteria:**
✅ User can create account and start with $10,000
✅ 3 regional markets display real-time data
✅ Pre-trade conversation works with text + MCQ
✅ Bot makes independent decision using quant model
✅ Trade locks for 3-7 days
✅ Post-trade reflection based on outcome
✅ Dashboard shows Sharpe ratio and basic metrics
✅ Deployed and accessible via URL

### Phase 2: Financial Depth & RAG Enhancement (2-3 months)

**AI Improvements:**
- [ ] Fine-tune Llama 3.1 on collected conversation data
- [ ] Improve RAG retrieval (better prompts, more context)
- [ ] Add sentiment analysis to bot decision engine

**Financial Features:**
- [ ] Sortino ratio, Calmar ratio
- [ ] Max drawdown tracking and visualization
- [ ] Historical performance charts (user vs bot vs market)
- [ ] Reasoning quality score trends

**New Scenarios:**
- [ ] Add individual stocks (10-15 popular ones)
- [ ] Sector-based scenarios

### Phase 3: Community & Scale (3-4+ months)

- [ ] Achievement system
- [ ] Leaderboard (Sharpe ratio based)
- [ ] Anonymized trade sharing
- [ ] Multi-user support at scale
- [ ] Mobile-responsive improvements
- [ ] Email notifications

---

## 10. Success Metrics

### User Engagement
- **Average session time:** Target > 10 minutes
- **Return rate:** Target > 40% weekly active
- **Trades per user:** Target > 5 in first month
- **Conversation completion:** Target > 80%

### Learning Progress
- **Reasoning quality improvement:** Tracked over first 10 trades
- **Financial literacy:** % users who understand Sharpe ratio after 1 month
- **Research behavior:** % users mentioning specific data

### Bot Performance
- **Win rate:** Bot achieves > 50% using quant model
- **RAG effectiveness:** Relevant context retrieved in > 80% of conversations

### Product-Market Fit
- **Organic signups:** Word-of-mouth growth
- **Completion rate:** > 70% complete first trade
- **User testimonials:** Qualitative feedback

---

## 11. Risk Metrics & Calculations

### Sharpe Ratio
```typescript
function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.02  // 2% annual
): number {
  const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
  const stdDev = calculateStdDev(returns);
  
  if (stdDev === 0) return 0;
  
  return (avgReturn - riskFreeRate) / stdDev;
}
```

### Max Drawdown
```typescript
function calculateMaxDrawdown(portfolioValues: number[]): number {
  let maxDrawdown = 0;
  let peak = portfolioValues[0];
  
  for (const value of portfolioValues) {
    if (value > peak) {
      peak = value;
    }
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}
```

### Win Rate
```typescript
function calculateWinRate(trades: Trade[]): number {
  const completedTrades = trades.filter(t => t.status === 'completed');
  if (completedTrades.length === 0) return 0;
  
  const winningTrades = completedTrades.filter(t => 
    t.exit_price > t.entry_price && t.position === 'BUY' ||
    t.exit_price < t.entry_price && t.position === 'SELL'
  );
  
  return winningTrades.length / completedTrades.length;
}
```

---

## 12. RAG Implementation Details

### Embedding Generation

```typescript
// embedding-service.ts
import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await hf.featureExtraction({
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    inputs: text
  });
  
  return Array.from(response);
}
```

### Vector Search

```typescript
// rag-service.ts
import { supabase } from './supabase-client';

export async function searchSimilarTrades(
  userReasoning: string,
  userId: string,
  limit: number = 3
) {
  // Generate embedding for user's reasoning
  const embedding = await generateEmbedding(userReasoning);
  
  // Search knowledge_base for similar past trades
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: limit,
    filter: { user_id: userId, type: 'user_reasoning' }
  });
  
  return data;
}

export async function searchCoachingPrompts(
  context: string,
  limit: number = 2
) {
  const embedding = await generateEmbedding(context);
  
  const { data } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: 0.6,
    match_count: limit,
    filter: { type: 'coaching_prompt' }
  });
  
  return data;
}
```

### PostgreSQL Function for Vector Search

```sql
-- Run this in Supabase SQL editor
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_base.id,
    knowledge_base.content,
    knowledge_base.metadata,
    1 - (knowledge_base.embedding <=> query_embedding) AS similarity
  FROM knowledge_base
  WHERE 
    (filter = '{}'::jsonb OR knowledge_base.metadata @> filter)
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## 13. AI Agent Development Tips

### Using Cursor + GitHub Copilot

**Best practices for working with AI coding assistants:**

1. **Break tasks into small chunks**
   - "Create a function to calculate Sharpe ratio"
   - "Build API endpoint for fetching market data"
   - Don't ask for entire features at once

2. **Provide context in comments**
   ```typescript
   // This function should:
   // 1. Fetch market data from Finnhub
   // 2. Calculate SMA(20) and SMA(50)
   // 3. Return BUY if SMA(20) > SMA(50), else SELL
   async function analyzeMarket(symbol: string) {
     // AI will complete this
   }
   ```

3. **Use v0 for UI, Cursor for logic**
   - v0: Generate entire pages/components visually
   - Cursor: Write business logic, API routes, calculations

4. **Iterate with prompts**
   - Initial: "Create a trade form component"
   - Refine: "Add validation for minimum investment amount"
   - Polish: "Add loading states and error handling"

### Debugging with AI

- Paste error messages directly into Cursor chat
- Ask: "Why is this RAG search returning empty results?"
- Use: "Explain this Sharpe ratio calculation step by step"

---

## 14. Business Model (Future)

**MVP: Completely Free**
- No paywalls, no premium tiers
- Goal is learning and portfolio value

**Post-MVP Monetization (if it gains traction):**

**Freemium:**
- Free: 10 trades/month, 3 markets
- Premium ($9.99/month): Unlimited trades, individual stocks, advanced analytics

**Educational Licensing:**
- $499/year per university for unlimited student access
- Corporate training: $2000/year for employee financial literacy

**Data Insights:**
- Anonymized reasoning patterns sold to research firms
- Market sentiment data aggregated from user decisions

---

## 15. Vision Statement

The long-term vision of capiTrade is to **transform how people learn to think about investing** — shifting from passive consumption of advice to active development of analytical skills.

**We envision:**
- Beginners approaching markets with curiosity, not fear
- Users understanding *why* they decide, not just *what* to buy
- Financial literacy built through experience, not memorization
- Investing seen as a learnable skill, not luck

**Our goal:** Create thoughtful investors who evaluate risk intelligently, learn from failures, make data-driven decisions, and continuously improve their reasoning.

---

## 16. Why This Project Matters

### For Recruiters
This project demonstrates:
- **Full-stack mastery:** Next.js, Hono.js, PostgreSQL, real-time features
- **AI integration:** RAG, LLMs, embeddings, vector search
- **Quantitative finance:** Technical indicators, risk metrics, decision models
- **Product thinking:** Solving real problems, not just building features
- **System design:** Scalable architecture, background jobs, caching
- **Modern dev practices:** AI-assisted development, v0 for rapid prototyping

### For Users
- Learn investing through real experience
- No risk of losing real money
- Build confidence through understanding
- Develop analytical skills that compound

### For the Market
- Financial literacy gap is real ($5B+ market)
- No competitor combines RAG + quantitative bot + Socratic learning
- Positioned perfectly for Gen Z investors in Dubai/MENA region

---

## 17. Next Steps

### Immediate Actions (This Week)

1. **Set up development environment**
   - Create Supabase project
   - Set up Next.js + Hono.js repos
   - Get Hugging Face API key

2. **Design database schema**
   - Run SQL scripts in Supabase
   - Enable pgvector extension
   - Seed coaching prompts

3. **Prototype UI in v0**
   - Landing page
   - Dashboard
   - Trade flow screens

4. **Test market data APIs**
   - Verify yfinance works for 3 markets
   - Get Finnhub API key
   - Cache sample data

### First Sprint (Week 1-2)

- Build authentication
- Create market data fetcher
- Implement basic bot decision engine
- Design UI components in v0

---

**capiTrade: Learn by doing. Understand by reflecting. Improve by thinking.**

**Built with:** Next.js • Hono.js • Supabase • Llama 3.1 • RAG • Quantitative Finance