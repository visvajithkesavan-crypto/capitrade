"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Bot, X, Check, Send } from "lucide-react"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

type Scenario = "both_right" | "user_right_bot_wrong" | "user_wrong_bot_right" | "both_wrong"

export interface ReflectionTrade {
  id: string
  market: string
  position: "BUY" | "SELL" | "HOLD"
  amount: number
  entry_price: number
  exit_price: number | null
  status: string
  waiting_days?: number
  created_at: string
  bot_decisions: Array<{ position: string; confidence_score: number }>
}

interface Message {
  role: "bot" | "user"
  text: string
}

function getScenario(pnl: number, exitPrice: number, trade: ReflectionTrade): Scenario {
  const userRight = pnl > 0
  const botDecision = trade.bot_decisions[0]
  let botRight = false
  if (botDecision) {
    if (botDecision.position === "BUY" && exitPrice > trade.entry_price) botRight = true
    else if (botDecision.position === "SELL" && exitPrice < trade.entry_price) botRight = true
  }
  if (userRight && botRight) return "both_right"
  if (userRight && !botRight) return "user_right_bot_wrong"
  if (!userRight && botRight) return "user_wrong_bot_right"
  return "both_wrong"
}

const OPENING_MESSAGE: Record<Scenario, string> = {
  both_right: "We both called this correctly, but likely for different reasons. Before this trade you shared your reasoning with me — what do you think was the strongest part of that thinking?",
  user_right_bot_wrong: "You spotted something my model missed. Looking back at the reasoning you shared before placing this trade, what gave you that conviction?",
  user_wrong_bot_right: "The market moved against you this time. Before this trade you had a specific thesis — where do you think that thesis broke down?",
  both_wrong: "Neither of us got this right. Before placing this trade you shared your thinking with me — what would you change about that reasoning now?",
}

const SCENARIO_CONFIG: Record<Scenario, { label: string; color: string; bgColor: string; borderColor: string }> = {
  both_right: { label: "Both Right", color: "text-primary", bgColor: "bg-primary/20", borderColor: "border-primary/50" },
  user_right_bot_wrong: { label: "You Were Right", color: "text-primary", bgColor: "bg-primary/20", borderColor: "border-primary/50" },
  user_wrong_bot_right: { label: "Bot Was Right", color: "text-warning", bgColor: "bg-warning/20", borderColor: "border-warning/50" },
  both_wrong: { label: "Both Wrong", color: "text-destructive", bgColor: "bg-destructive/20", borderColor: "border-destructive/50" },
}

const MAX_EXCHANGES = 3

export default function PostTradeReflectionDialog({
  open,
  onClose,
  trade,
  pnl,
  exitPrice,
  userId,
}: {
  open: boolean
  onClose: () => void
  trade: ReflectionTrade | null
  pnl: number
  exitPrice: number
  userId: string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [exchangeCount, setExchangeCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const [lessonCard, setLessonCard] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && trade) {
      const scenario = getScenario(pnl, exitPrice, trade)
      setMessages([{ role: "bot", text: OPENING_MESSAGE[scenario] }])
      setInput("")
      setSending(false)
      setExchangeCount(0)
      setFinished(false)
      setLessonCard(null)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (!open || !trade) return null

  const scenario = getScenario(pnl, exitPrice, trade)
  const config = SCENARIO_CONFIG[scenario]
  const pnlPositive = pnl >= 0
  const pnlFormatted = `${pnlPositive ? "+" : "-"}$${Math.abs(pnl).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  const extractLesson = (text: string): string | null => {
    const match = text.match(/Lesson:\s*(.+)/i)
    return match ? match[1].trim() : null
  }

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const userText = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", text: userText }])
    setSending(true)

    const newCount = exchangeCount + 1
    setExchangeCount(newCount)
    const isFinal = newCount >= MAX_EXCHANGES

    try {
      const res = await fetch(`${BACKEND_URL}/api/bot/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          tradeId: trade.id,
          phase: "post_trade",
          userMessage: userText,
          isFinalExchange: isFinal,
          exchangeNumber: newCount,
          scenario,
          pnl,
          messages: messages.map((m) => ({
            role: m.role === "bot" ? "assistant" : "user",
            content: m.text,
          })),
        }),
      })
      const json = await res.json() as { success: boolean; data?: { reply: string } }
      const reply = json.success && json.data?.reply
        ? json.data.reply
        : isFinal
          ? "Lesson: Every trade is a mirror. The goal is not to be right — it is to reason better each time."
          : "Interesting — can you tell me more about what drove that thinking?"

      setMessages((prev) => [...prev, { role: "bot", text: reply }])

      if (isFinal) {
        const lesson = extractLesson(reply)
        if (lesson) setLessonCard(lesson)
        setFinished(true)
      }
    } catch {
      const fallback = isFinal
        ? "Lesson: Every trade is a mirror. The goal is not to be right — it is to reason better each time."
        : "Interesting — can you tell me more about what drove that thinking?"
      setMessages((prev) => [...prev, { role: "bot", text: fallback }])
      if (isFinal) {
        const lesson = extractLesson(fallback)
        if (lesson) setLessonCard(lesson)
        setFinished(true)
      }
    } finally {
      setSending(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl bg-card border border-border overflow-hidden flex flex-col" style={{ maxHeight: "85vh" }}>

        {/* Header */}
        <div className="gradient-border-bottom px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-foreground">Post-Trade Reflection</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{trade.market} · {trade.position}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Outcome row */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between shrink-0">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${config.bgColor} ${config.color} border ${config.borderColor}`}>
            {config.label}
          </span>
          <span className={`font-mono text-lg font-bold tabular-nums ${pnlPositive ? "text-primary" : "text-destructive"}`}>
            {pnlFormatted}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "bot" ? (
                <div className="bg-muted rounded-xl rounded-tl-sm border-l-2 border-primary/50 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-medium text-primary">AI Advisor</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{msg.text}</p>
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="max-w-xs bg-primary/10 border border-primary/20 rounded-xl rounded-tr-sm px-4 py-3">
                    <p className="text-sm text-foreground leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="bg-muted rounded-xl rounded-tl-sm border-l-2 border-primary/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Lesson card */}
        {lessonCard && (
          <div className="mx-6 mb-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 shrink-0">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Your Lesson</p>
            <p className="text-sm text-foreground leading-relaxed">{lessonCard}</p>
          </div>
        )}

        {/* Input or Finish */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          {!finished ? (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Share your thoughts..."
                  disabled={sending}
                  className="flex-1 rounded-lg bg-muted border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="flex h-10 w-10 items-center justify-center rounded-lg transition-all disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)" }}
                >
                  <Send className="h-4 w-4 text-black" />
                </button>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-2">
                {MAX_EXCHANGES - exchangeCount} question{MAX_EXCHANGES - exchangeCount !== 1 ? "s" : ""} remaining
              </p>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full rounded-lg py-3 text-sm font-bold flex items-center justify-center gap-2 bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors"
            >
              <Check className="h-4 w-4" />
              Finish Reflection
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
