# capiTrade

> **Learn by doing. Understand by reflecting. Improve by thinking.**

capiTrade is an AI-powered virtual trading platform that teaches investment thinking through the Socratic method. Users practice making real-world market decisions with virtual capital across global indices, then engage in guided conversations with an AI coach that never tells you what to do — instead, it asks the questions that make you think deeper. Every trade becomes a learning opportunity, backed by retrieval-augmented reasoning and performance analytics.

---

## Live Demo

[https://capitrade1-20tzadqki-visvajith-kesavans-projects.vercel.app](https://capitrade1-20tzadqki-visvajith-kesavans-projects.vercel.app)

---

## Screenshots

> _Coming soon — dashboard, trade flow, and AI coaching interface._

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| UI Components | shadcn/ui, Recharts |
| Backend API | Hono.js (TypeScript), Railway |
| Database | Supabase (PostgreSQL + pgvector) |
| AI Coach | Anthropic Claude (claude-haiku-4-5) |
| Market Data | Finnhub API (with mock fallback) |
| Auth | Supabase Auth (email/password) |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## Features

- **Virtual Trading** — Trade global indices (S&P 500, Nikkei 225, Tadawul) with $10,000 virtual capital, with real-time price data and mock fallback
- **AI Socratic Coach** — Pre- and post-trade coaching conversations powered by Claude AI that challenge your reasoning without ever giving direct advice
- **Bot Benchmark** — An independent algorithmic bot evaluates the same trade using technical analysis, giving users a reference point to compare their thinking
- **RAG-Powered Memory** — Past trades and coaching prompts are embedded with pgvector and retrieved to make every conversation contextually relevant
- **Performance Analytics** — Track Sharpe ratio, max drawdown, win rate, average gain/loss, and total return across your full trading history
- **Secure Auth** — Supabase-powered authentication with protected routes, session persistence, and per-user data isolation via Row-Level Security

---

## Local Development

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with the schema from `database-schema.sql`
- An [Anthropic](https://console.anthropic.com) API key
- A [Finnhub](https://finnhub.io) API key (free tier works)

### 1. Clone the repository

```bash
git clone https://github.com/visvajithkesavan-crypto/capitrade.git
cd capitrade
```

### 2. Set up the backend

```bash
cd backend
cp .env.example .env
# Fill in your keys in .env
npm install
npm run dev
# Runs on http://localhost:3001
```

**Required backend env vars:**
```
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
FINNHUB_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PORT=3001
```

### 3. Set up the frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in your keys in .env.local
npm install
npm run dev
# Runs on http://localhost:3000
```

**Required frontend env vars:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Set up the database

Run `database-schema.sql` in your Supabase SQL editor to create all tables, RLS policies, and pgvector extensions.

---

## Project Structure

```
capitrade/
├── backend/          # Hono.js API server (TypeScript)
│   └── src/
│       ├── index.ts          # Routes & server entry point
│       ├── market-engine.ts  # Technical analysis & bot logic
│       ├── rag-service.ts    # Embedding & vector search
│       └── supabase-client.ts
├── frontend/         # Next.js 14 app
│   └── src/
│       ├── app/              # App Router pages
│       ├── components/       # UI components (shadcn/ui)
│       └── lib/              # Supabase client, types, utils
└── database-schema.sql
```

---

## Deployment

- **Frontend** is deployed on [Vercel](https://vercel.com) — connect the GitHub repo and set the root directory to `frontend`
- **Backend** is deployed on [Railway](https://railway.app) — connect the GitHub repo, set root directory to `backend`, and add environment variables

---

## Author

Built by **Visvajith Kesavan** as a full-stack portfolio project demonstrating AI integration, RAG pipelines, real-time data, and production deployment.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
