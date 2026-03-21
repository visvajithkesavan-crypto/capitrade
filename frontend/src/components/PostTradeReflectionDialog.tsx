"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Bot, X, Check } from "lucide-react"

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

const SCENARIO_CONFIG: Record<
  Scenario,
  { label: string; color: string; bgColor: string; borderColor: string; message: string }
> = {
  both_right: {
    label: "Both Right",
    color: "text-primary",
    bgColor: "bg-primary/20",
    borderColor: "border-primary/50",
    message:
      "We both called this correctly, but likely for different reasons. What was the key signal that convinced you to make this trade?",
  },
  user_right_bot_wrong: {
    label: "You Were Right",
    color: "text-primary",
    bgColor: "bg-primary/20",
    borderColor: "border-primary/50",
    message:
      "You spotted something my quantitative model missed. What was your key insight that drove this decision?",
  },
  user_wrong_bot_right: {
    label: "Bot Was Right",
    color: "text-warning",
    bgColor: "bg-warning/20",
    borderColor: "border-warning/50",
    message:
      "The market moved against you this time. Looking back, what data or signals might have changed your decision?",
  },
  both_wrong: {
    label: "Both Wrong",
    color: "text-destructive",
    bgColor: "bg-destructive/20",
    borderColor: "border-destructive/50",
    message:
      "Neither of us predicted this outcome. What do you think we both failed to account for in our analysis?",
  },
}

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
  const [reflection, setReflection] = useState("")
  const [botReply, setBotReply] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [phase, setPhase] = useState<"write" | "responded">("write")

  useEffect(() => {
    if (open) {
      setReflection("")
      setBotReply(null)
      setSending(false)
      setPhase("write")
    }
  }, [open])

  if (!open || !trade) return null

  const scenario = getScenario(pnl, exitPrice, trade)
  const config = SCENARIO_CONFIG[scenario]
  const pnlPositive = pnl >= 0
  const pnlFormatted = `${pnlPositive ? "+" : "-"}$${Math.abs(pnl).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  const handleSend = async () => {
    if (!reflection.trim()) return
    setSending(true)
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
          userMessage: reflection,
          messages: [],
        }),
      })
      const json = await res.json() as { success: boolean; data?: { reply: string } }
      setBotReply(
        json.success && json.data?.reply
          ? json.data.reply
          : "Thank you for your reflection. Every trade, win or lose, is a learning opportunity."
      )
      setPhase("responded")
    } catch {
      setBotReply("Thank you for your reflection. Every trade, win or lose, is a learning opportunity.")
      setPhase("responded")
    } finally {
      setSending(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl bg-card border border-border overflow-hidden">
        {/* Header */}
        <div className="gradient-border-bottom px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Post-Trade Reflection</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {trade.market} · {trade.position}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Outcome row */}
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${config.bgColor} ${config.color} border ${config.borderColor}`}
            >
              {config.label}
            </span>
            <span
              className={`font-mono text-lg font-bold tabular-nums ${
                pnlPositive ? "text-primary" : "text-destructive"
              }`}
            >
              {pnlFormatted}
            </span>
          </div>

          {/* Bot opening message */}
          <div className="bg-muted rounded-xl rounded-tl-sm border-l-2 border-primary/50 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium text-primary">AI Advisor</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{config.message}</p>
          </div>

          {/* Write phase: textarea + send button */}
          {phase === "write" && (
            <>
              <div>
                <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Your Reflection
                </label>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={4}
                  placeholder="Share your thoughts on this trade..."
                  className="w-full rounded-lg bg-muted border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none transition-colors"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!reflection.trim() || sending}
                className="w-full rounded-lg py-3 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background:
                    sending || !reflection.trim()
                      ? "var(--muted)"
                      : "linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)",
                  color:
                    sending || !reflection.trim() ? "var(--muted-foreground)" : "#080808",
                  boxShadow:
                    sending || !reflection.trim()
                      ? "none"
                      : "0 0 20px rgba(0, 255, 136, 0.25)",
                }}
              >
                {sending ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send to Coach"
                )}
              </button>
            </>
          )}

          {/* Responded phase: bot follow-up + finish button */}
          {phase === "responded" && botReply && (
            <>
              <div className="bg-muted rounded-xl rounded-tl-sm border-l-2 border-primary/50 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-primary">AI Advisor</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{botReply}</p>
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-lg py-3 text-sm font-bold flex items-center justify-center gap-2 bg-muted border border-border text-foreground hover:bg-muted/80 transition-colors"
              >
                <Check className="h-4 w-4" />
                Finish Reflection
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
