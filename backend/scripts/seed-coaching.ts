import { createClient } from '@supabase/supabase-js'
import { VoyageAIClient } from 'voyageai'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! })

const COACHING_PROMPTS = [
  "Before acting on news, check if the price chart already reflects that news.",
  "Consensus across media sources is not the same as market evidence.",
  "A winning trade built on weak reasoning is more dangerous than a losing trade.",
  "Price momentum and news momentum are different signals — never confuse them.",
  "If you cannot explain why you are buying, you are gambling not investing.",
  "Overconfidence after a winning streak leads to larger position sizes and bigger losses.",
  "The question is never just whether the news is good — it is whether the news is better than expected.",
  "Markets price in expectations, not events. React to surprises, not headlines.",
  "Volatility is not risk. Not knowing why you are in a trade is risk.",
  "A trade without an exit plan is a gamble with unlimited downside.",
  "Confirmation bias makes you seek news that supports your existing position.",
  "The best traders are wrong often — they just lose less when they are wrong.",
  "Volume confirms price moves. Price moves without volume are often traps.",
  "Never increase position size to recover losses — that is revenge trading.",
  "Your confidence level before a trade should match the quality of your evidence.",
  "A 3-day lock forces patience. Patience is a trading edge most people ignore.",
  "If three news channels say the same thing, the trade is probably already priced in.",
  "Loss aversion makes bad trades feel safer to hold than to cut.",
  "The market does not care about your entry price or your feelings.",
  "Recency bias makes the most recent trade feel like a pattern when it is just one data point.",
  "Strong reasoning protects you in losing trades. Weak reasoning fails you in winning ones.",
  "Ask yourself: am I reacting to information or to emotion right now?",
  "A trade based on one signal is a bet. A trade based on three confirming signals is a thesis.",
  "Post-trade reflection is where real learning happens, not in the profit number.",
  "The goal of each trade is not to make money — it is to make a better decision than last time."
]

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await voyage.embed({ input: [text], model: 'voyage-3-lite' })
  return response.data?.[0]?.embedding ?? []
}

async function seed() {
  console.log('Deleting old coaching prompts...')
  await supabase
    .from('knowledge_base')
    .delete()
    .eq('metadata->>type', 'coaching_prompt')

  console.log('Seeding 25 coaching prompts...')
  for (const content of COACHING_PROMPTS) {
    const embedding = await generateEmbedding(content)
    const { error } = await supabase.from('knowledge_base').insert({
      content,
      embedding,
      metadata: { type: 'coaching_prompt' }
    })
    if (error) {
      console.error('Insert error:', error.message, 'for:', content.slice(0, 50))
    } else {
      console.log('Seeded:', content.slice(0, 60))
    }
    await new Promise(resolve => setTimeout(resolve, 25000))
  }
  console.log('Done.')
}

seed().catch(console.error)
