"use client"

import { useState } from "react"
import { createBrowserClient } from "@supabase/ssr"

// @supabase/ssr's createBrowserClient stores the session in cookies so that
// the Next.js middleware can read it server-side (lib/supabase.ts uses
// localStorage which is not accessible in middleware).
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSignIn = async () => {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === "signin") {
      await handleSignIn()
      return
    }
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      setMessage("Account created! Check your email to confirm, then sign in.")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#080808" }}
    >
      {/* Logo */}
      <div className="mb-8 text-center">
        <span className="text-3xl font-bold tracking-tight">
          <span className="text-white">capi</span>
          <span style={{ color: "#00ff88", fontSize: "2rem" }}>T</span>
          <span style={{ color: "#00ff88" }}>rade</span>
        </span>
        <p className="mt-3 text-sm text-gray-400 italic">
          Learn by doing. Understand by reflecting.
        </p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-xl border p-8"
        style={{ backgroundColor: "#0e0e0e", borderColor: "#1a1a1a" }}
      >
        {/* Tab toggle */}
        <div className="mb-6 flex rounded-lg overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); setMessage(null) }}
            className="flex-1 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: mode === "signin" ? "#00ff88" : "transparent",
              color: mode === "signin" ? "#080808" : "#666",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); setMessage(null) }}
            className="flex-1 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: mode === "signup" ? "#00ff88" : "transparent",
              color: mode === "signup" ? "#080808" : "#666",
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: "#141414",
                border: "1px solid #2a2a2a",
                // @ts-expect-error css custom property via inline style
                "--tw-ring-color": "#00ff88",
              }}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
              className="w-full rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: "#141414",
                border: "1px solid #2a2a2a",
              }}
            />
          </div>

          {error && (
            <p className="rounded-lg px-4 py-2 text-sm" style={{ backgroundColor: "#3d0000", color: "#ff6666" }}>
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-lg px-4 py-2 text-sm" style={{ backgroundColor: "#003d1f", color: "#00ff88" }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#00ff88", color: "#080808" }}
          >
            {loading ? "Loading…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  )
}
