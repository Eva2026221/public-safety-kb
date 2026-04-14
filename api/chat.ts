/**
 * Vercel Edge Function — 公安知識庫 AI 問答 API
 * POST /api/chat
 * Body: { query: string, entries: KnowledgeEntry[] }
 * Response: text/event-stream (SSE)
 */

import Anthropic from '@anthropic-ai/sdk'

export const config = { runtime: 'edge' }

interface KnowledgeEntry {
  keywords: string[]
  answer: string
  source?: string
}

interface RequestBody {
  query: string
  entries: KnowledgeEntry[]
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `你是「公安知識庫 AI 助理」，專門提供台灣公共安全法規、消防法規、建築安全相關的專業諮詢。

你的回答原則：
1. 用自然、流暢的繁體中文回答，不要逐字複製知識卡原文
2. 直接切入重點，回答使用者的核心問題
3. 當有多筆相關資料時，適當整合成連貫的說明
4. 提及具體規定時，簡短標注法規依據（如：依 BS-255 書表規定）
5. 若有縣市差異，清楚說明各縣市的不同規定
6. 回答長度適中，精簡扼要，避免冗長贅述
7. 若知識庫資料不足以完整回答，誠實說明並建議洽詢相關主管機關
8. 語氣專業但親切，適合業務人員日常查詢使用`

function formatEntries(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return '（知識庫中未找到相關資料）'

  return entries
    .map((e, i) => {
      const source = e.source ? `\n來源：${e.source}` : ''
      return `【資料 ${i + 1}】\n${e.answer}${source}`
    })
    .join('\n\n---\n\n')
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let body: RequestBody
  try {
    body = await req.json() as RequestBody
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { query, entries } = body
  if (!query?.trim()) {
    return new Response('Missing query', { status: 400 })
  }

  const knowledgeContext = formatEntries(entries ?? [])

  const userMessage = entries.length > 0
    ? `使用者問題：${query}\n\n以下是從知識庫中找到的相關資料，請根據這些資料回答：\n\n${knowledgeContext}`
    : `使用者問題：${query}\n\n（知識庫中未找到相關資料，請根據公安法規一般知識回答，並說明建議洽詢相關主管機關）`

  try {
    const stream = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      stream: true,
    })

    // 建立 SSE 串流回應
    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const data = JSON.stringify({ text: event.delta.text })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'API 呼叫失敗'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
