"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { createBrowserClient } from "@supabase/ssr"
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  LineChart,
  Settings,
  Send,
  ArrowUpRight,
  ArrowDownRight,
  Bot,
  User,
  Mail,
  Shield,
  Database,
  Zap,
  Check,
  LogOut,
  X,
  Lock,
  RotateCcw,
} from "lucide-react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import PostTradeReflectionDialog, { type ReflectionTrade } from "@/components/PostTradeReflectionDialog"

// ============================================================================
// TYPES
// ============================================================================

type ViewType = "dashboard" | "markets" | "trades" | "analytics" | "settings"

interface MarketData {
  id: string
  region: string
  flag: string
  name: string
  ticker: string
  price: number
  change: number
  signal: "BUY" | "SELL" | "HOLD"
  confidence: number
  sparklineData: { value: number }[]
  fullChartData: { date: string; value: number }[]
}

interface Trade {
  id: string
  market: string
  position: "LONG" | "SHORT"
  amount: number
  entryPrice: number
  exitPrice: number | null
  pnl: number
  pnlPercent: number
  status: "OPEN" | "CLOSED" | "PENDING"
  date: string
  duration: string
}

interface ChatMessage {
  id: string
  role: "bot" | "user"
  content: string
}

interface Metric {
  label: string
  value: string
  numericValue: number
  trend: "up" | "down" | "neutral"
  trendValue: string
  sparkData: number[]
}

interface TickerItem {
  symbol: string
  price: string
  change: number
}

interface OrderBookLevel {
  price: number
  size: number
  total: number
}

interface ApiMarket {
  key: string
  name: string
  region: string
  currentPrice: number
  changePercent: number
  prices: number[]
  dates: string[]
  botDecision: {
    position: "BUY" | "SELL" | "HOLD"
    confidence: number
    reasoning: string
  } | null
}

interface ApiMetrics {
  totalTrades: number
  winRate: number
  sharpeRatio: number
  maxDrawdown: number
  avgGain: number
  avgLoss: number
  virtualBalance: number
  totalReturn: number
}

interface ApiTrade {
  id: string
  market: string
  amount: number
  position: "BUY" | "SELL" | "HOLD"
  entry_price: number
  exit_price: number | null
  status: "active" | "completed"
  waiting_days?: number
  created_at: string
  bot_decisions: Array<{ position: string; confidence_score: number }>
}

// ============================================================================
// MOCK DATA
// ============================================================================

const tickerData: TickerItem[] = [
  { symbol: "SPX", price: "5,248.32", change: 1.24 },
  { symbol: "NKY", price: "38,456.78", change: 0.12 },
  { symbol: "SX5E", price: "4,892.15", change: -0.67 },
  { symbol: "BTC", price: "67,234.10", change: 2.31 },
  { symbol: "ETH", price: "3,456.78", change: 1.87 },
  { symbol: "GOLD", price: "2,187.40", change: -0.23 },
  { symbol: "OIL", price: "78.34", change: 0.89 },
]

const generateSparkline = (trend: "up" | "down" | "volatile") => {
  const data: { value: number }[] = []
  let value = 100

  for (let i = 0; i < 30; i++) {
    if (trend === "up") {
      value += Math.random() * 5 - 1
    } else if (trend === "down") {
      value -= Math.random() * 5 - 1
    } else {
      value += Math.random() * 10 - 5
    }
    data.push({ value: Math.max(50, Math.min(150, value)) })
  }
  return data
}

const generateFullChartData = (basePrice: number, trend: "up" | "down" | "volatile") => {
  const data: { date: string; value: number }[] = []
  let value = basePrice * 0.95

  for (let i = 29; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    
    if (trend === "up") {
      value += value * (Math.random() * 0.02 - 0.005)
    } else if (trend === "down") {
      value -= value * (Math.random() * 0.02 - 0.005)
    } else {
      value += value * (Math.random() * 0.03 - 0.015)
    }
    data.push({ date: dateStr, value: Math.round(value * 100) / 100 })
  }
  return data
}

const generateMiniSparkline = () => {
  return Array.from({ length: 6 }, () => Math.random() * 100)
}

const generateOrderBook = (basePrice: number): { bids: OrderBookLevel[]; asks: OrderBookLevel[] } => {
  const bids: OrderBookLevel[] = []
  const asks: OrderBookLevel[] = []
  let bidTotal = 0
  let askTotal = 0

  for (let i = 0; i < 5; i++) {
    const bidSize = Math.round(Math.random() * 1000 + 100)
    const askSize = Math.round(Math.random() * 1000 + 100)
    bidTotal += bidSize
    askTotal += askSize

    bids.push({
      price: basePrice - (i + 1) * (basePrice * 0.001),
      size: bidSize,
      total: bidTotal,
    })
    asks.push({
      price: basePrice + (i + 1) * (basePrice * 0.001),
      size: askSize,
      total: askTotal,
    })
  }
  return { bids, asks }
}

const markets: MarketData[] = [
  {
    id: "1",
    region: "US",
    flag: "🇺🇸",
    name: "S&P 500",
    ticker: "SPX",
    price: 5248.32,
    change: 1.24,
    signal: "BUY",
    confidence: 73,
    sparklineData: generateSparkline("up"),
    fullChartData: generateFullChartData(5248.32, "up"),
  },
  {
    id: "2",
    region: "EU",
    flag: "🇪🇺",
    name: "Euro Stoxx 50",
    ticker: "SX5E",
    price: 4892.15,
    change: -0.67,
    signal: "SELL",
    confidence: 81,
    sparklineData: generateSparkline("down"),
    fullChartData: generateFullChartData(4892.15, "down"),
  },
  {
    id: "3",
    region: "JP",
    flag: "🇯🇵",
    name: "Nikkei 225",
    ticker: "NKY",
    price: 38456.78,
    change: 0.12,
    signal: "HOLD",
    confidence: 54,
    sparklineData: generateSparkline("volatile"),
    fullChartData: generateFullChartData(38456.78, "volatile"),
  },
]

const trades: Trade[] = [
  {
    id: "1",
    market: "SPX",
    position: "LONG",
    amount: 50000,
    entryPrice: 5180.45,
    exitPrice: 5248.32,
    pnl: 6543.21,
    pnlPercent: 13.09,
    status: "CLOSED",
    date: "2024-03-10",
    duration: "3 days",
  },
  {
    id: "2",
    market: "SX5E",
    position: "SHORT",
    amount: 25000,
    entryPrice: 4950.0,
    exitPrice: 4892.15,
    pnl: 2921.45,
    pnlPercent: 11.69,
    status: "CLOSED",
    date: "2024-03-09",
    duration: "5 days",
  },
  {
    id: "3",
    market: "NKY",
    position: "LONG",
    amount: 35000,
    entryPrice: 38200.0,
    exitPrice: null,
    pnl: -456.78,
    pnlPercent: -1.31,
    status: "OPEN",
    date: "2024-03-11",
    duration: "1 day",
  },
  {
    id: "4",
    market: "SPX",
    position: "SHORT",
    amount: 15000,
    entryPrice: 5220.0,
    exitPrice: 5195.5,
    pnl: 1124.5,
    pnlPercent: 7.5,
    status: "CLOSED",
    date: "2024-03-08",
    duration: "2 days",
  },
  {
    id: "5",
    market: "SX5E",
    position: "LONG",
    amount: 20000,
    entryPrice: 4875.0,
    exitPrice: null,
    pnl: 348.92,
    pnlPercent: 1.74,
    status: "OPEN",
    date: "2024-03-11",
    duration: "1 day",
  },
]

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    role: "bot",
    content:
      "Good morning. Markets are showing mixed signals today. S&P 500 momentum is strong with institutional buying detected.",
  },
  {
    id: "2",
    role: "user",
    content: "What's your take on Euro Stoxx?",
  },
  {
    id: "3",
    role: "bot",
    content:
      "SX5E is facing headwinds from ECB policy uncertainty. I recommend reducing exposure. The technical setup suggests a potential retest of 4850 support.",
  },
]

const metrics: Metric[] = [
  {
    label: "Win Rate",
    value: "68.4%",
    numericValue: 68.4,
    trend: "up",
    trendValue: "+2.1%",
    sparkData: generateMiniSparkline(),
  },
  {
    label: "Sharpe Ratio",
    value: "2.34",
    numericValue: 2.34,
    trend: "up",
    trendValue: "+0.12",
    sparkData: generateMiniSparkline(),
  },
  {
    label: "Max Drawdown",
    value: "-8.2%",
    numericValue: 8.2,
    trend: "down",
    trendValue: "-1.4%",
    sparkData: generateMiniSparkline(),
  },
  {
    label: "Total Trades",
    value: "247",
    numericValue: 247,
    trend: "neutral",
    trendValue: "+12",
    sparkData: generateMiniSparkline(),
  },
  {
    label: "Virtual Balance",
    value: "$1,248,392",
    numericValue: 1248392,
    trend: "up",
    trendValue: "+$24,521",
    sparkData: generateMiniSparkline(),
  },
]

const portfolioData = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (29 - i))
  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: 1000000 + Math.random() * 300000 + i * 5000,
  }
})

const monthlyPnL = [
  { month: "Apr", pnl: 12500 },
  { month: "May", pnl: -8200 },
  { month: "Jun", pnl: 28400 },
  { month: "Jul", pnl: 15600 },
  { month: "Aug", pnl: -3200 },
  { month: "Sep", pnl: 42100 },
  { month: "Oct", pnl: 18900 },
  { month: "Nov", pnl: -12300 },
  { month: "Dec", pnl: 31200 },
  { month: "Jan", pnl: 22800 },
  { month: "Feb", pnl: -5600 },
  { month: "Mar", pnl: 35400 },
]

// ============================================================================
// API HELPERS
// ============================================================================

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

const FALLBACK_USER_ID = "00000000-0000-0000-0000-000000000001"

// Single cookie-based auth client (mirrors what login page uses so sessions match)
const authClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const REGION_META: Record<string, { flag: string; ticker: string }> = {
  Americas:   { flag: "🇺🇸", ticker: "SPY" },
  Asia:       { flag: "🇯🇵", ticker: "EWJ" },
  MiddleEast: { flag: "🇸🇦", ticker: "KSA" },
}

function apiMarketToMarketData(m: ApiMarket, idx: number): MarketData {
  const sparklineData = m.prices.map((v) => ({ value: v }))
  const fullChartData = m.prices.map((v, i) => ({
    date: m.dates[i] ?? "",
    value: v,
  }))
  const meta = REGION_META[m.region] ?? { flag: "🌍", ticker: m.key }
  return {
    id: String(idx + 1),
    region: m.region,
    flag: meta.flag,
    name: m.name,
    ticker: meta.ticker,
    price: m.currentPrice,
    change: m.changePercent,
    signal: m.botDecision?.position ?? "HOLD",
    confidence: m.botDecision ? Math.round(m.botDecision.confidence * 100) : 0,
    sparklineData,
    fullChartData,
  }
}

function buildMetricsArray(data: ApiMetrics, prev?: Metric[]): Metric[] {
  const spark = () => generateMiniSparkline()
  return [
    {
      label: "Win Rate",
      value: `${data.winRate.toFixed(1)}%`,
      numericValue: data.winRate,
      trend: "up" as const,
      trendValue: "",
      sparkData: prev?.[0]?.sparkData ?? spark(),
    },
    {
      label: "Sharpe Ratio",
      value: data.sharpeRatio.toFixed(2),
      numericValue: data.sharpeRatio,
      trend: (data.sharpeRatio >= 0 ? "up" : "down") as "up" | "down",
      trendValue: "",
      sparkData: prev?.[1]?.sparkData ?? spark(),
    },
    {
      label: "Max Drawdown",
      value: `-${data.maxDrawdown.toFixed(1)}%`,
      numericValue: data.maxDrawdown,
      trend: "down" as const,
      trendValue: "",
      sparkData: prev?.[2]?.sparkData ?? spark(),
    },
    {
      label: "Total Trades",
      value: String(data.totalTrades),
      numericValue: data.totalTrades,
      trend: "neutral" as const,
      trendValue: "",
      sparkData: prev?.[3]?.sparkData ?? spark(),
    },
    {
      label: "Virtual Balance",
      value: `$${Math.round(data.virtualBalance).toLocaleString()}`,
      numericValue: data.virtualBalance,
      trend: (data.totalReturn >= 0 ? "up" : "down") as "up" | "down",
      trendValue: `${data.totalReturn >= 0 ? "+" : ""}${data.totalReturn.toFixed(2)}%`,
      sparkData: prev?.[4]?.sparkData ?? spark(),
    },
  ]
}

// ============================================================================
// COMPONENTS
// ============================================================================

function LiveClock() {
  const [time, setTime] = useState<string>("")

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      )
    }

    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="font-mono text-sm tabular-nums text-foreground">{time}</span>
  )
}

function TickerTape({ liveMarkets }: { liveMarkets: MarketData[] }) {
  const displayItems: TickerItem[] = liveMarkets.length > 0
    ? liveMarkets.map((m) => ({
        symbol: m.ticker,
        price: m.price.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        change: m.change,
      }))
    : tickerData
  return (
    <div className="w-full overflow-hidden border-b border-[#1a1a1a] bg-[#050508]/80 backdrop-blur-sm">
      <div className="ticker-scroll flex whitespace-nowrap py-2">
        {[...displayItems, ...displayItems].map((item, idx) => (
          <div key={idx} className="flex items-center px-6">
            <span className="font-mono text-sm font-medium text-muted-foreground">
              {item.symbol}
            </span>
            <span className="ml-2 font-mono text-sm tabular-nums text-foreground">
              {item.price}
            </span>
            <span
              className={`ml-2 font-mono text-sm tabular-nums ${
                item.change >= 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {item.change >= 0 ? "▲" : "▼"}
              {item.change >= 0 ? "+" : ""}
              {item.change.toFixed(2)}%
            </span>
            <span className="ml-6 text-[#1a1a1a]">|</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={`relative flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-200 ${
          active
            ? "text-primary"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        }`}
        style={
          active
            ? {
                textShadow: "0 0 20px rgba(0, 255, 136, 0.5)",
              }
            : undefined
        }
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
        )}
        <Icon className="h-5 w-5" />
      </button>
      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:block z-50">
        <div className="rounded-md bg-card border border-border px-3 py-1.5 text-sm text-foreground whitespace-nowrap">
          {label}
        </div>
      </div>
    </div>
  )
}

function Sidebar({
  activeView,
  setActiveView,
  onLogout,
}: {
  activeView: ViewType
  setActiveView: (view: ViewType) => void
  onLogout: () => void
}) {
  const navItems: { icon: React.ElementType; label: string; view: ViewType }[] = [
    { icon: LayoutDashboard, label: "Dashboard", view: "dashboard" },
    { icon: TrendingUp, label: "Markets", view: "markets" },
    { icon: BarChart3, label: "Trades", view: "trades" },
    { icon: LineChart, label: "Analytics", view: "analytics" },
    { icon: Settings, label: "Settings", view: "settings" },
  ]

  return (
    <aside className="flex h-full w-full flex-col items-center justify-between py-6 bg-[#0a0a0a] border-r border-border">
      <div className="flex flex-col items-center gap-2">
        {navItems.map((item) => (
          <NavItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            active={activeView === item.view}
            onClick={() => setActiveView(item.view)}
          />
        ))}
      </div>
      <div className="group relative">
        <button
          onClick={onLogout}
          className="flex h-12 w-12 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-red-500/10 hover:text-red-400"
          title="Log out"
        >
          <LogOut className="h-5 w-5" />
        </button>
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:block z-50">
          <div className="rounded-md bg-card border border-border px-3 py-1.5 text-sm text-foreground whitespace-nowrap">
            Log out
          </div>
        </div>
      </div>
    </aside>
  )
}

function AnimatedValue({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const duration = 1500
    const steps = 60
    const increment = value / steps
    let current = 0
    let step = 0

    const timer = setInterval(() => {
      step++
      current = Math.min(value, increment * step)
      setDisplayValue(current)

      if (step >= steps) {
        clearInterval(timer)
        setDisplayValue(value)
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [value])

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString()

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

function MiniSparkline({
  data,
  color = "#00ff88",
}: {
  data: number[]
  color?: string
}) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  return (
    <div className="flex items-end gap-0.5 h-3">
      {data.map((val, i) => (
        <div
          key={i}
          className="w-1 rounded-sm"
          style={{
            height: `${((val - min) / range) * 100}%`,
            minHeight: "2px",
            backgroundColor: color,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  )
}

function MetricTile({ metric }: { metric: Metric }) {
  const borderColor =
    metric.trend === "up"
      ? "#00ff88"
      : metric.trend === "down"
      ? "#ff4444"
      : "#666666"

  const sparkColor =
    metric.trend === "up"
      ? "#00ff88"
      : metric.trend === "down"
      ? "#ff4444"
      : "#666666"

  return (
    <div
      className="flex flex-col rounded-lg bg-card border border-border p-4 card-hover fade-in"
      style={{ borderTopWidth: "3px", borderTopColor: borderColor }}
    >
      <span className="text-xs text-muted-foreground uppercase tracking-wider">
        {metric.label}
      </span>
      <span className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
        {metric.label === "Virtual Balance" ? (
          <AnimatedValue
            value={metric.numericValue}
            prefix="$"
            decimals={0}
          />
        ) : metric.label === "Win Rate" ? (
          <AnimatedValue value={metric.numericValue} suffix="%" decimals={1} />
        ) : metric.label === "Sharpe Ratio" ? (
          <AnimatedValue value={metric.numericValue} decimals={2} />
        ) : metric.label === "Max Drawdown" ? (
          <>
            -<AnimatedValue value={metric.numericValue} suffix="%" decimals={1} />
          </>
        ) : (
          <AnimatedValue value={metric.numericValue} decimals={0} />
        )}
      </span>
      <div className="mt-2">
        <MiniSparkline data={metric.sparkData} color={sparkColor} />
      </div>
      <div className="mt-2 flex items-center gap-1">
        {metric.trend === "up" && (
          <ArrowUpRight className="h-3 w-3 text-primary" />
        )}
        {metric.trend === "down" && (
          <ArrowDownRight className="h-3 w-3 text-destructive" />
        )}
        <span
          className={`font-mono text-xs tabular-nums ${
            metric.trend === "up"
              ? "text-primary"
              : metric.trend === "down"
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {metric.trendValue}
        </span>
      </div>
    </div>
  )
}

function MetricsBar({ liveMetrics, loading }: { liveMetrics: Metric[] | null; loading: boolean }) {
  const displayMetrics = liveMetrics ?? metrics
  return (
    <div className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-border bg-[#050508]/50">
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-card border border-border p-4 animate-pulse">
            <div className="h-3 w-16 bg-muted rounded mb-3" />
            <div className="h-7 w-24 bg-muted rounded mb-3" />
            <div className="h-2 w-full bg-muted rounded" />
          </div>
        ))
      ) : (
        displayMetrics.map((metric) => (
          <MetricTile key={metric.label} metric={metric} />
        ))
      )}
    </div>
  )
}

function SignalBadge({ signal }: { signal: "BUY" | "SELL" | "HOLD" }) {
  const styles = {
    BUY: {
      bg: "bg-primary/20",
      text: "text-primary",
      shadow: "0 0 12px rgba(0, 255, 136, 0.5)",
    },
    SELL: {
      bg: "bg-destructive/20",
      text: "text-destructive",
      shadow: "0 0 12px rgba(255, 68, 68, 0.5)",
    },
    HOLD: {
      bg: "bg-warning/20",
      text: "text-warning",
      shadow: "0 0 12px rgba(255, 170, 0, 0.5)",
    },
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${styles[signal].bg} ${styles[signal].text}`}
      style={{ boxShadow: styles[signal].shadow }}
    >
      {signal}
    </span>
  )
}

function MarketCard({ market }: { market: MarketData }) {
  const isPositive = market.change >= 0
  const chartColor = isPositive ? "#00ff88" : "#ff4444"

  return (
    <div className="relative h-[200px] rounded-xl bg-card border border-border overflow-hidden card-hover fade-in">
      {/* Background Area Chart */}
      <div className="absolute inset-0 opacity-15">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={market.sparklineData}>
            <defs>
              <linearGradient
                id={`gradient-${market.id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.8} />
                <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2}
              fill={`url(#gradient-${market.id})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-5">
        {/* Top row */}
        <div className="flex items-start justify-between">
          <span className="font-mono text-4xl font-bold text-white/25 tracking-wider">
            {market.ticker}
          </span>
          <SignalBadge signal={market.signal} />
        </div>

        {/* Middle */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{market.flag}</span>
            <span className="text-sm text-muted-foreground">{market.name}</span>
          </div>
          <div className="font-mono text-[2.5rem] font-bold tabular-nums text-foreground leading-none">
            {market.price.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div
            className={`mt-1 flex items-center gap-1 font-mono text-sm tabular-nums ${
              isPositive ? "text-primary" : "text-destructive"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            <span>
              {isPositive ? "+" : ""}
              {market.change.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Bottom - Signal Strength */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Signal Strength
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {market.confidence}%
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${market.confidence}%`,
                backgroundColor:
                  market.signal === "BUY"
                    ? "#00ff88"
                    : market.signal === "SELL"
                    ? "#ff4444"
                    : "#ffaa00",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: "OPEN" | "CLOSED" | "PENDING" }) {
  const styles = {
    OPEN: "bg-primary/20 text-primary",
    CLOSED: "bg-muted text-muted-foreground",
    PENDING: "bg-warning/20 text-warning",
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  )
}

function getDaysInfo(createdAt: string, waitingDays: number) {
  const msPerDay = 1000 * 60 * 60 * 24
  const daysElapsed = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / msPerDay))
  const daysRemaining = Math.max(0, waitingDays - daysElapsed)
  return { daysElapsed, daysRemaining }
}

function PnLPill({ pnl }: { pnl: number }) {
  const isPositive = pnl >= 0

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-medium tabular-nums ${
        isPositive
          ? "bg-primary/20 text-primary"
          : "bg-destructive/20 text-destructive"
      }`}
    >
      {isPositive ? "+" : ""}$
      {Math.abs(pnl).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  )
}

function TradeTable({
  showExtended = false,
  apiTrades,
  loading = false,
  onComplete,
}: {
  showExtended?: boolean
  apiTrades?: ApiTrade[]
  loading?: boolean
  onComplete?: (id: string) => void
}) {
  const colCount = showExtended ? 11 : 8

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden fade-in">
      <div className="border-b border-border px-5 py-4">
        <h3 className="font-semibold text-foreground">Trade History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Market
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Position
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Amount
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Entry
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Exit
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                P&L
              </th>
              {showExtended && (
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  P&L %
                </th>
              )}
              <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              {showExtended && (
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Duration
                </th>
              )}
              {showExtended && (
                <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Action
                </th>
              )}
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: colCount }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-muted rounded w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : apiTrades && apiTrades.length > 0 ? (
              apiTrades.map((t, index) => {
                let pnl = 0
                if (t.exit_price) {
                  if (t.position === "BUY")
                    pnl = ((t.exit_price - t.entry_price) / t.entry_price) * t.amount
                  else if (t.position === "SELL")
                    pnl = ((t.entry_price - t.exit_price) / t.entry_price) * t.amount
                }
                const pnlPct = t.exit_price
                  ? ((pnl / t.amount) * 100).toFixed(2)
                  : null
                const isActive = t.status === "active"
                const status: "OPEN" | "CLOSED" =
                  isActive ? "OPEN" : "CLOSED"
                const posClass =
                  t.position === "BUY"
                    ? "text-primary"
                    : t.position === "SELL"
                    ? "text-destructive"
                    : "text-warning"
                const effectiveWaitingDays = t.waiting_days ?? 3
                const daysInfo = isActive
                  ? getDaysInfo(t.created_at, effectiveWaitingDays)
                  : null
                return (
                  <tr
                    key={t.id}
                    className={`transition-colors hover:bg-muted/20 ${
                      index % 2 === 0 ? "bg-[#0a0a0a]" : "bg-transparent"
                    }`}
                    style={{
                      borderLeft: `3px solid ${pnl >= 0 ? "#00ff88" : "#ff4444"}`,
                    }}
                  >
                    <td className="px-5 py-4 font-mono text-sm font-medium text-foreground">
                      {t.market}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-medium ${posClass}`}>
                        {t.position}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-sm tabular-nums text-foreground">
                      ${t.amount.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-sm tabular-nums text-foreground">
                      {t.entry_price.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-sm tabular-nums text-foreground">
                      {t.exit_price
                        ? t.exit_price.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <PnLPill pnl={pnl} />
                    </td>
                    {showExtended && (
                      <td className="px-5 py-4 text-right">
                        {pnlPct !== null ? (
                          <span
                            className={`font-mono text-sm tabular-nums ${
                              pnl >= 0 ? "text-primary" : "text-destructive"
                            }`}
                          >
                            {pnl >= 0 ? "+" : ""}
                            {pnlPct}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-4 text-center">
                      {daysInfo ? (
                        <div className="flex flex-col items-center gap-1.5">
                          {daysInfo.daysRemaining <= 0 ? (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/20 text-primary">
                              Ready to Complete
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-warning/20 text-warning">
                              {daysInfo.daysRemaining} {daysInfo.daysRemaining === 1 ? "day" : "days"} left
                            </span>
                          )}
                          <div className="w-24">
                            <p className="text-[10px] text-muted-foreground mb-0.5 text-center">
                              Day {Math.min(daysInfo.daysElapsed, effectiveWaitingDays)} of {effectiveWaitingDays}
                            </p>
                            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, (daysInfo.daysElapsed / effectiveWaitingDays) * 100)}%`,
                                  backgroundColor: daysInfo.daysRemaining <= 0 ? "#00ff88" : "#ffaa00",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <StatusBadge status={status} />
                      )}
                    </td>
                    {showExtended && (
                      <td className="px-5 py-4 text-right font-mono text-sm tabular-nums text-muted-foreground">
                        —
                      </td>
                    )}
                    {showExtended && (
                      <td className="px-5 py-4 text-center">
                        {daysInfo ? (
                          daysInfo.daysRemaining <= 0 ? (
                            <button
                              onClick={() => onComplete?.(t.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/20 border border-primary/50 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/30 transition-colors"
                            >
                              <Check className="h-3 w-3" />
                              Complete Trade
                            </button>
                          ) : (
                            <button
                              disabled
                              className="inline-flex items-center gap-1.5 rounded-lg bg-muted border border-border text-muted-foreground px-3 py-1.5 text-xs font-medium cursor-not-allowed opacity-60"
                            >
                              <Lock className="h-3 w-3" />
                              Locked
                            </button>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-4 text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {t.created_at.split("T")[0]}
                    </td>
                  </tr>
                )
              })
            ) : apiTrades && apiTrades.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-5 py-8 text-center text-sm text-muted-foreground"
                >
                  No trades yet.
                </td>
              </tr>
            ) : (
              trades.map((trade, index) => (
                <tr
                  key={trade.id}
                  className={`transition-colors hover:bg-muted/20 ${
                    index % 2 === 0 ? "bg-[#0a0a0a]" : "bg-transparent"
                  }`}
                  style={{
                    borderLeft: `3px solid ${
                      trade.pnl >= 0 ? "#00ff88" : "#ff4444"
                    }`,
                  }}
                >
                  <td className="px-5 py-4 font-mono text-sm font-medium text-foreground">
                    {trade.market}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`text-sm font-medium ${
                        trade.position === "LONG"
                          ? "text-primary"
                          : "text-destructive"
                      }`}
                    >
                      {trade.position}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-sm tabular-nums text-foreground">
                    ${trade.amount.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-sm tabular-nums text-foreground">
                    {trade.entryPrice.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-sm tabular-nums text-foreground">
                    {trade.exitPrice
                      ? trade.exitPrice.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <PnLPill pnl={trade.pnl} />
                  </td>
                  {showExtended && (
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`font-mono text-sm tabular-nums ${
                          trade.pnlPercent >= 0
                            ? "text-primary"
                            : "text-destructive"
                        }`}
                      >
                        {trade.pnlPercent >= 0 ? "+" : ""}
                        {trade.pnlPercent.toFixed(2)}%
                      </span>
                    </td>
                  )}
                  <td className="px-5 py-4 text-center">
                    <StatusBadge status={trade.status} />
                  </td>
                  {showExtended && (
                    <td className="px-5 py-4 text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {trade.duration}
                    </td>
                  )}
                  <td className="px-5 py-4 text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {trade.date}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex gap-1 items-center p-3 bg-muted rounded-lg w-fit">
        <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isBot = message.role === "bot"

  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isBot
            ? "bg-muted text-foreground rounded-bl-sm border-l-2 border-primary/50 animate-in fade-in slide-in-from-bottom-2 duration-300"
            : "bg-secondary text-secondary-foreground rounded-br-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}

function AIAdvisor({ apiTrades, userId }: { apiTrades: ApiTrade[]; userId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const localTradesRef = useRef<any[]>([])

  console.log('[AIAdvisor] userId on mount:', userId)

  useEffect(() => {
    console.log('[AIAdvisor] useEffect triggered, userId:', userId)
    if (!userId) return
    const fetchLocalTrades = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/trades`, {
          headers: { 'x-user-id': userId }
        })
        const json = await res.json()
        if (json.success && json.data) {
          localTradesRef.current = json.data
          console.log('[AIAdvisor] Trades loaded into ref:', json.data.length)
        }
      } catch (e) {
        console.error('Failed to fetch trades for AI advisor:', e)
      }
    }
    fetchLocalTrades()
  }, [userId])

  const activeTradeId =
    apiTrades.find((t) => t.status === "active")?.id ?? apiTrades[0]?.id ?? null

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleSend = async () => {
    if (!input.trim() || isTyping) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput("")
    setIsTyping(true)

    try {
      console.log('[AIAdvisor] Sending allTrades count:', apiTrades.length)
      console.log('[AIAdvisor] First trade:', JSON.stringify(apiTrades[0]))
      const res = await fetch(`${BACKEND_URL}/api/bot/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          tradeId: activeTradeId ?? "general",
          phase: "coaching",
          userMessage: input,
          messages: [],
          allTrades: apiTrades,
        }),
      })

      const json = await res.json() as { success: boolean; data?: { reply: string } }
      const reply = json.success && json.data?.reply
        ? json.data.reply
        : "What specific data or indicators influenced your decision?"

      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "bot", content: reply },
      ])
    } catch {
      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "bot",
          content: "What specific data or indicators influenced your decision?",
        },
      ])
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl bg-card border border-border overflow-hidden fade-in">
      {/* Header with gradient border */}
      <div className="gradient-border-bottom px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-primary border-2 border-card pulse-dot" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">AI Advisor</h3>
              <span className="text-xs text-primary">Online</span>
            </div>
          </div>
          <button
            onClick={() => setMessages([])}
            title="Clear chat"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground text-center px-4">
              I can see your trades. Ask me anything about your positions or trading patterns.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask your AI advisor..."
            className="flex-1 rounded-lg bg-muted border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
          <button
            onClick={handleSend}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Navbar({
  userEmail,
  onLogout,
}: {
  userEmail: string | null
  onLogout: () => void
}) {
  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "??"

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-[#0a0a0a]/80 backdrop-blur-sm px-6">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold tracking-tight">
          <span className="text-foreground">capi</span>
          <span className="text-primary text-[1.35rem]">T</span>
          <span className="text-primary">rade</span>
        </span>
        <span className="h-2 w-2 rounded-full bg-primary pulse-dot" />
      </div>

      {/* Center */}
      <div className="flex items-center gap-6">
        <LiveClock />
        <div className="rounded-md bg-warning/20 px-3 py-1">
          <span className="text-xs font-semibold text-warning uppercase tracking-wider">
            Paper Trading
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
          {initials}
        </div>
        <button
          onClick={onLogout}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
        >
          Sign Out
        </button>
      </div>
    </header>
  )
}

// ============================================================================
// VIEW COMPONENTS
// ============================================================================

function DashboardView({
  liveMarkets,
  marketsLoading,
  apiTrades,
  tradesLoading,
}: {
  liveMarkets: MarketData[]
  marketsLoading: boolean
  apiTrades: ApiTrade[]
  tradesLoading: boolean
}) {
  const displayMarkets = liveMarkets.length > 0 ? liveMarkets : markets
  return (
    <div className="space-y-6">
      {/* Market Cards */}
      <div className="grid grid-cols-3 gap-4">
        {marketsLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[200px] rounded-xl bg-card border border-border animate-pulse"
              />
            ))
          : displayMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
      </div>

      {/* Trade Table */}
      <TradeTable apiTrades={apiTrades} loading={tradesLoading} />
    </div>
  )
}

function MarketsView({
  liveMarkets,
  loading,
  error,
}: {
  liveMarkets: MarketData[]
  loading: boolean
  error: boolean
}) {
  const displayMarkets = liveMarkets.length > 0 ? liveMarkets : markets
  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          Unable to load market data. Showing cached data.
        </div>
      )}
      {/* Large Market Cards */}
      <div className="grid grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[200px] rounded-xl bg-card border border-border animate-pulse"
              />
            ))
          : displayMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
      </div>

      {/* Full Charts */}
      {displayMarkets.map((market) => {
        const isPositive = market.change >= 0
        const chartColor = isPositive ? "#00ff88" : "#ff4444"
        const orderBook = generateOrderBook(market.price)

        return (
          <div
            key={market.id}
            className="rounded-xl bg-card border border-border p-6 fade-in"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{market.flag}</span>
                <div>
                  <h3 className="font-semibold text-foreground">{market.name}</h3>
                  <span className="text-sm text-muted-foreground">{market.ticker}</span>
                </div>
              </div>
              <SignalBadge signal={market.signal} />
            </div>

            <div className="h-[200px] mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={market.fullChartData}>
                  <defs>
                    <linearGradient
                      id={`fullGradient-${market.id}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#666666", fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#666666", fontSize: 11 }}
                    domain={["auto", "auto"]}
                    tickFormatter={(val) => val.toLocaleString()}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f0f0f",
                      border: "1px solid #1a1a1a",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#666666" }}
                    formatter={(value: number) => [
                      value.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }),
                      "Price",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill={`url(#fullGradient-${market.id})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Market Depth */}
            <div>
              <h4 className="font-medium text-foreground mb-3">Market Depth</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Bids */}
                <div className="rounded-lg bg-muted/30 p-4">
                  <h5 className="text-sm font-medium text-primary mb-2">Bids</h5>
                  <div className="space-y-1">
                    {orderBook.bids.map((level, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs font-mono tabular-nums"
                      >
                        <span className="text-primary">
                          {level.price.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-muted-foreground">{level.size}</span>
                        <span className="text-muted-foreground">{level.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Asks */}
                <div className="rounded-lg bg-muted/30 p-4">
                  <h5 className="text-sm font-medium text-destructive mb-2">Asks</h5>
                  <div className="space-y-1">
                    {orderBook.asks.map((level, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs font-mono tabular-nums"
                      >
                        <span className="text-destructive">
                          {level.price.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-muted-foreground">{level.size}</span>
                        <span className="text-muted-foreground">{level.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// PRE-TRADE DIALOG
// ============================================================================

function PreTradeDialog({
  open,
  onClose,
  market,
  position,
  amount,
  userId,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  market: string
  position: "BUY" | "SELL" | "HOLD"
  amount: string
  userId: string
  onConfirm: () => Promise<void>
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [reasoning, setReasoning] = useState("")
  const [confidence, setConfidence] = useState<"Low" | "Medium" | "High" | null>(null)
  const [influence, setInfluence] = useState<string | null>(null)
  const [botQuestion, setBotQuestion] = useState("")
  const [followUp, setFollowUp] = useState("")
  const [botLoading, setBotLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [lockError, setLockError] = useState("")

  useEffect(() => {
    if (open) {
      setStep(1)
      setReasoning("")
      setConfidence(null)
      setInfluence(null)
      setBotQuestion("")
      setFollowUp("")
      setLockError("")
    }
  }, [open])

  const handleStep2Next = async () => {
    setBotLoading(true)
    try {
      const userMessage = `I want to trade ${market} ${position} with $${amount}. My reasoning: ${reasoning}. Confidence: ${confidence}. Main influence: ${influence}.`
      const res = await fetch(`${BACKEND_URL}/api/bot/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          tradeId: null,
          phase: "pre_trade",
          userMessage,
          messages: [{ role: "user", content: userMessage }],
        }),
      })
      const json = await res.json() as { success: boolean; data?: { reply: string } }
      setBotQuestion(
        json.success && json.data?.reply
          ? json.data.reply
          : "What specific data or indicators influenced your decision? What risks have you considered?"
      )
    } catch {
      setBotQuestion("What specific data or indicators influenced your decision? What risks have you considered?")
    } finally {
      setBotLoading(false)
      setStep(3)
    }
  }

  const handleLockIn = async () => {
    setConfirming(true)
    setLockError("")
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setLockError(err instanceof Error ? err.message : "Failed to place trade.")
    } finally {
      setConfirming(false)
    }
  }

  if (!open) return null

  const amountNum = parseFloat(amount) || 0

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl bg-card border border-border overflow-hidden">
        {/* Header */}
        <div className="gradient-border-bottom px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Pre-Trade Analysis</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Step {step} of 3</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-3 border-b border-border">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* ── Step 1: Reasoning ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 border border-border px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Trade Summary
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-0.5">Market</p>
                    <p className="font-mono text-sm font-semibold text-foreground">{market}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-0.5">Position</p>
                    <p
                      className={`font-mono text-sm font-semibold ${
                        position === "BUY"
                          ? "text-primary"
                          : position === "SELL"
                          ? "text-destructive"
                          : "text-warning"
                      }`}
                    >
                      {position}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-0.5">Amount</p>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      ${amountNum.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  What made you choose this investment?
                </label>
                <textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  rows={3}
                  placeholder="Describe your reasoning for this trade..."
                  className="w-full rounded-lg bg-muted border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none transition-colors"
                />
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!reasoning.trim()}
                className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}

          {/* ── Step 2: MCQ ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-foreground mb-3">How confident are you?</p>
                <div className="flex gap-2">
                  {(["Low", "Medium", "High"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setConfidence(c)}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                        confidence === c
                          ? c === "High"
                            ? "bg-primary/20 text-primary border border-primary/50"
                            : c === "Medium"
                            ? "bg-warning/20 text-warning border border-warning/50"
                            : "bg-destructive/20 text-destructive border border-destructive/50"
                          : "bg-muted border border-border text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-3">
                  What influenced your decision most?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {["Research & Data", "Gut Feeling", "News & Social Media", "Just Guessing"].map(
                    (opt) => (
                      <button
                        key={opt}
                        onClick={() => setInfluence(opt)}
                        className={`rounded-lg py-2.5 px-3 text-sm font-medium text-left transition-all ${
                          influence === opt
                            ? "bg-primary/20 text-primary border border-primary/50"
                            : "bg-muted border border-border text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg bg-muted border border-border text-muted-foreground py-2.5 text-sm font-medium hover:text-foreground transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleStep2Next}
                  disabled={!confidence || !influence || botLoading}
                  className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {botLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                      Thinking…
                    </span>
                  ) : (
                    "Next →"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: AI Response ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl rounded-tl-sm border-l-2 border-primary/50 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-primary">AI Advisor</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{botQuestion}</p>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Your response (optional)
                </label>
                <textarea
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  rows={3}
                  placeholder="Share any additional thoughts..."
                  className="w-full rounded-lg bg-muted border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none transition-colors"
                />
              </div>

              {lockError && (
                <p className="text-sm text-destructive">{lockError}</p>
              )}

              <button
                onClick={handleLockIn}
                disabled={confirming}
                className="w-full rounded-lg py-3 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: confirming
                    ? "var(--muted)"
                    : "linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)",
                  color: confirming ? "var(--muted-foreground)" : "#080808",
                  boxShadow: confirming ? "none" : "0 0 20px rgba(0, 255, 136, 0.25)",
                }}
              >
                {confirming ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                    Placing Trade…
                  </>
                ) : (
                  "🔒 Lock In Trade"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function TradesView({
  apiTrades,
  tradesLoading,
  onTradeSuccess,
  userId,
}: {
  apiTrades: ApiTrade[]
  tradesLoading: boolean
  onTradeSuccess: () => void
  userId: string
}) {
  const [selectedMarket, setSelectedMarket] = useState("Americas")
  const [selectedPosition, setSelectedPosition] = useState<"BUY" | "SELL" | "HOLD">("BUY")
  const [amount, setAmount] = useState("")
  const [waitingPeriod, setWaitingPeriod] = useState<"3" | "7">("3")
  const [successMsg, setSuccessMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reflectionOpen, setReflectionOpen] = useState(false)
  const [reflectionTrade, setReflectionTrade] = useState<ReflectionTrade | null>(null)
  const [reflectionPnl, setReflectionPnl] = useState(0)
  const [reflectionExitPrice, setReflectionExitPrice] = useState(0)

  const submitTrade = async (): Promise<void> => {
    const res = await fetch(`${BACKEND_URL}/api/trades`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify({
        market: selectedMarket,
        amount: parseFloat(amount),
        position: selectedPosition,
        waiting_days: parseInt(waitingPeriod),
      }),
    })
    const json = await res.json() as { success: boolean; error?: string }
    if (!json.success) {
      throw new Error(json.error ?? "Failed to place trade.")
    }
    setSuccessMsg("Trade placed successfully!")
    setAmount("")
    onTradeSuccess()
  }

  const completeTrade = async (tradeId: string): Promise<void> => {
    const res = await fetch(`${BACKEND_URL}/api/trades/${tradeId}/complete`, {
      method: "PATCH",
      headers: { "x-user-id": userId },
    })
    const json = await res.json() as {
      success: boolean
      error?: string
      data?: { trade: ApiTrade; pnl: number; exitPrice: number }
    }
    if (!json.success) {
      throw new Error(json.error ?? "Failed to complete trade.")
    }
    const originalTrade = apiTrades.find((t) => t.id === tradeId) ?? null
    setReflectionTrade(originalTrade)
    setReflectionPnl(json.data?.pnl ?? 0)
    setReflectionExitPrice(json.data?.exitPrice ?? 0)
    setReflectionOpen(true)
    onTradeSuccess()
  }

  const handlePlaceTrade = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMsg("Please enter a valid amount.")
      return
    }
    setErrorMsg("")
    setSuccessMsg("")
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* New Trade Form */}
      <div className="rounded-xl bg-card border border-border p-6 fade-in">
        <h3 className="font-semibold text-foreground mb-4">New Trade</h3>
        <div className="grid grid-cols-4 gap-4">
          {/* Market Select */}
          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Select Market
            </label>
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="w-full rounded-lg bg-muted border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="Americas">Americas — S&P 500</option>
              <option value="Asia">Asia — Nikkei 225</option>
              <option value="MiddleEast">Middle East — Tadawul</option>
            </select>
          </div>

          {/* Position Buttons */}
          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Select Position
            </label>
            <div className="flex gap-2">
              {(["BUY", "SELL", "HOLD"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setSelectedPosition(pos)}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                    selectedPosition === pos
                      ? pos === "BUY"
                        ? "bg-primary/20 text-primary border border-primary/50"
                        : pos === "SELL"
                        ? "bg-destructive/20 text-destructive border border-destructive/50"
                        : "bg-warning/20 text-warning border border-warning/50"
                      : "bg-muted border border-border text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Enter Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg bg-muted border border-border pl-8 pr-4 py-2.5 text-sm text-foreground font-mono tabular-nums placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Waiting Period */}
          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Waiting Period
            </label>
            <div className="flex gap-2">
              {(["3", "7"] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setWaitingPeriod(period)}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    waitingPeriod === period
                      ? "bg-secondary text-secondary-foreground border border-secondary"
                      : "bg-muted border border-border text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {period} days
                </button>
              ))}
            </div>
          </div>
        </div>

        {successMsg && (
          <p className="mt-3 text-sm text-primary">{successMsg}</p>
        )}
        {errorMsg && (
          <p className="mt-3 text-sm text-destructive">{errorMsg}</p>
        )}

        <button
          onClick={handlePlaceTrade}
          className="mt-4 w-full rounded-lg bg-primary text-primary-foreground py-3 font-semibold hover:bg-primary/90 transition-colors"
        >
          Place Trade
        </button>
      </div>

      {/* Trade Table with Extended Columns */}
      <TradeTable showExtended apiTrades={apiTrades} loading={tradesLoading} onComplete={completeTrade} />

      <PreTradeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        market={selectedMarket}
        position={selectedPosition}
        amount={amount}
        userId={userId}
        onConfirm={submitTrade}
      />
      <PostTradeReflectionDialog
        open={reflectionOpen}
        onClose={() => setReflectionOpen(false)}
        trade={reflectionTrade}
        pnl={reflectionPnl}
        exitPrice={reflectionExitPrice}
        userId={userId}
      />
    </div>
  )
}

function AnalyticsView({ liveMetrics, metricsLoading }: { liveMetrics: Metric[] | null; metricsLoading: boolean }) {
  const displayMetrics = liveMetrics ?? metrics
  const wins = 168
  const losses = 79
  const totalTrades = wins + losses
  const winPercent = (wins / totalTrades) * 100

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-5 gap-4">
        {metricsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-card border border-border p-4 animate-pulse">
              <div className="h-3 w-16 bg-muted rounded mb-3" />
              <div className="h-7 w-24 bg-muted rounded mb-3" />
              <div className="h-2 w-full bg-muted rounded" />
            </div>
          ))
        ) : (
          displayMetrics.map((metric) => (
            <MetricTile key={metric.label} metric={metric} />
          ))
        )}
      </div>

      {/* Portfolio Value Chart */}
      <div className="rounded-xl bg-card border border-border p-6 fade-in">
        <h3 className="font-semibold text-foreground mb-4">Portfolio Value Over Time</h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={portfolioData}>
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ff88" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00ff88" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#666666", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#666666", fontSize: 11 }}
                tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f0f0f",
                  border: "1px solid #1a1a1a",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#666666" }}
                formatter={(value: number) => [
                  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                  "Value",
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#00ff88"
                strokeWidth={2}
                fill="url(#portfolioGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly P&L Bar Chart */}
      <div className="rounded-xl bg-card border border-border p-6 fade-in">
        <h3 className="font-semibold text-foreground mb-4">Monthly P&L</h3>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyPnL}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#666666", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#666666", fontSize: 11 }}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f0f0f",
                  border: "1px solid #1a1a1a",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#666666" }}
                formatter={(value: number) => [
                  `$${value.toLocaleString("en-US")}`,
                  "P&L",
                ]}
              />
              <Bar
                dataKey="pnl"
                radius={[4, 4, 0, 0]}
              >
                {monthlyPnL.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.pnl >= 0 ? "#00ff88" : "#ff4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Win/Loss Breakdown */}
      <div className="rounded-xl bg-card border border-border p-6 fade-in">
        <h3 className="font-semibold text-foreground mb-4">Win/Loss Breakdown</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center">
            <span className="block font-mono text-5xl font-bold text-primary tabular-nums">
              {wins}
            </span>
            <span className="text-sm text-muted-foreground">Winning Trades</span>
          </div>
          <div className="text-center">
            <span className="block font-mono text-5xl font-bold text-destructive tabular-nums">
              {losses}
            </span>
            <span className="text-sm text-muted-foreground">Losing Trades</span>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Win Rate</span>
            <span className="font-mono tabular-nums text-foreground">{winPercent.toFixed(1)}%</span>
          </div>
          <div className="h-3 rounded-full bg-destructive/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${winPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsView() {
  const [positionSize, setPositionSize] = useState(50)
  const [riskTolerance, setRiskTolerance] = useState<"low" | "medium" | "high">("medium")
  const [autoComplete, setAutoComplete] = useState(true)

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile Section */}
      <div className="rounded-xl bg-card border border-border p-6 fade-in">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <User className="h-4 w-4" />
          Profile
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-xl font-semibold text-primary">
            JD
          </div>
          <div>
            <p className="font-medium text-foreground">John Doe</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              john@capitrade.io
            </p>
          </div>
        </div>
      </div>

      {/* Trading Preferences */}
      <div className="rounded-xl bg-card border border-border p-6 fade-in">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Trading Preferences
        </h3>
        <div className="space-y-6">
          {/* Position Size Slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-muted-foreground">Default Position Size</label>
              <span className="font-mono text-sm tabular-nums text-foreground">{positionSize}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={positionSize}
              onChange={(e) => setPositionSize(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
            />
          </div>

          {/* Risk Tolerance */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Risk Tolerance</label>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setRiskTolerance(level)}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium capitalize transition-all ${
                    riskTolerance === level
                      ? level === "low"
                        ? "bg-primary/20 text-primary border border-primary/50"
                        : level === "medium"
                        ? "bg-warning/20 text-warning border border-warning/50"
                        : "bg-destructive/20 text-destructive border border-destructive/50"
                      : "bg-muted border border-border text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-complete Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">Auto-complete trades</label>
            <button
              onClick={() => setAutoComplete(!autoComplete)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                autoComplete ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  autoComplete ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* API Status */}
      <div className="rounded-xl bg-card border border-border p-6 fade-in">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Database className="h-4 w-4" />
          API Connections
        </h3>
        <div className="space-y-3">
          {[
            { name: "Supabase", status: "Connected" },
            { name: "HuggingFace", status: "Connected" },
            { name: "Finnhub", status: "Connected" },
          ].map((api) => (
            <div
              key={api.name}
              className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{api.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary pulse-dot" />
                <span className="text-xs text-primary flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {api.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function DashboardPage() {
  const router = useRouter()
  const [activeView, setActiveView] = useState<ViewType>("dashboard")

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState("")
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // ── Markets state ──────────────────────────────────────────────────────────
  const [liveMarkets, setLiveMarkets] = useState<MarketData[]>([])
  const [marketsLoading, setMarketsLoading] = useState(true)
  const [marketsError, setMarketsError] = useState(false)

  // ── Metrics state ──────────────────────────────────────────────────────────
  const [liveMetrics, setLiveMetrics] = useState<Metric[] | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  // ── Trades state ───────────────────────────────────────────────────────────
  const [apiTrades, setApiTrades] = useState<ApiTrade[]>([])
  const [tradesLoading, setTradesLoading] = useState(true)

  const fetchMarkets = async () => {
    setMarketsLoading(true)
    setMarketsError(false)
    try {
      const res = await fetch(`${BACKEND_URL}/api/markets`)
      const json = await res.json() as { success: boolean; data?: ApiMarket[] }
      if (json.success && json.data) {
        setLiveMarkets(json.data.map(apiMarketToMarketData))
      } else {
        setMarketsError(true)
      }
    } catch {
      setMarketsError(true)
    } finally {
      setMarketsLoading(false)
    }
  }

  const fetchMetrics = async () => {
    setMetricsLoading(true)
    try {
      const { data: { user } } = await authClient.auth.getUser()
      const uid = user?.id ?? FALLBACK_USER_ID
      const res = await fetch(`${BACKEND_URL}/api/metrics`, {
        headers: { "x-user-id": uid },
      })
      const json = await res.json() as { success: boolean; data?: ApiMetrics }
      if (json.success && json.data) {
        setLiveMetrics((prev) => buildMetricsArray(json.data!, prev ?? undefined))
      }
    } catch {
      // show mock metrics on error
    } finally {
      setMetricsLoading(false)
    }
  }

  const fetchTrades = async () => {
    setTradesLoading(true)
    try {
      const { data: { user } } = await authClient.auth.getUser()
      const uid = user?.id ?? FALLBACK_USER_ID
      const res = await fetch(`${BACKEND_URL}/api/trades`, {
        headers: { "x-user-id": uid },
      })
      const json = await res.json() as { success: boolean; data?: ApiTrade[] }
      if (json.success && json.data) {
        setApiTrades(json.data)
      }
    } catch {
      // keep empty list on error
    } finally {
      setTradesLoading(false)
    }
  }

  const handleLogout = async () => {
    await authClient.auth.signOut()
    router.push("/login")
  }

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await authClient.auth.getUser()
      const uid = user?.id ?? FALLBACK_USER_ID
      setUserId(uid)
      setUserEmail(user?.email ?? null)
      fetchMarkets()
      fetchMetrics()
      fetchTrades()
    })()
  }, [])

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <DashboardView
            liveMarkets={liveMarkets}
            marketsLoading={marketsLoading}
            apiTrades={apiTrades}
            tradesLoading={tradesLoading}
          />
        )
      case "markets":
        return (
          <MarketsView
            liveMarkets={liveMarkets}
            loading={marketsLoading}
            error={marketsError}
          />
        )
      case "trades":
        return (
          <TradesView
            apiTrades={apiTrades}
            tradesLoading={tradesLoading}
            onTradeSuccess={() => { fetchTrades(); fetchMetrics() }}
            userId={userId}
          />
        )
      case "analytics":
        return <AnalyticsView liveMetrics={liveMetrics} metricsLoading={metricsLoading} />
      case "settings":
        return <SettingsView />
      default:
        return (
          <DashboardView
            liveMarkets={liveMarkets}
            marketsLoading={marketsLoading}
            apiTrades={apiTrades}
            tradesLoading={tradesLoading}
          />
        )
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden space-bg">
      {/* Navbar */}
      <Navbar userEmail={userEmail} onLogout={handleLogout} />

      {/* Ticker Tape */}
      <TickerTape liveMarkets={liveMarkets} />

      {/* Metrics Bar */}
      <MetricsBar liveMetrics={liveMetrics} loading={metricsLoading} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-[5%] min-w-[72px]">
          <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={handleLogout} />
        </div>

        {/* Center Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {renderView()}
        </main>

        {/* Right Panel - AI Advisor */}
        <div className="w-[25%] min-w-[320px] border-l border-border p-4">
          <AIAdvisor apiTrades={apiTrades} userId={userId} />
        </div>
      </div>
    </div>
  )
}
