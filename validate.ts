/**
 * 公安知識庫自動驗證腳本
 * 用法：npx tsx validate.ts [--verbose] [--json]
 *
 * 對每一條知識卡：
 *   1. 從 answer 中萃取「問：」欄位作為查詢字串
 *   2. 若有「情境：」欄位則改用情境（更口語，更接近真實查詢）
 *   3. 以相同的 searchKnowledge 邏輯找出 top-3 結果
 *   4. 判斷正確條目是否出現在 top-3 中（以 source 對齊）
 *   5. 輸出驗證報告
 */

import { knowledgeBaseEntries } from './src/data/knowledgeBaseEntries'
import type { KnowledgeEntry } from './src/types'

// ─── CLI 參數 ────────────────────────────────────────────────────────────────
const VERBOSE = process.argv.includes('--verbose')
const JSON_OUTPUT = process.argv.includes('--json')

// ─── 搜尋邏輯（與 knowledgeBase.ts 保持同步）────────────────────────────────

function isCJK(ch: string): boolean {
  if (!ch) return false
  return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch)
}

function isEmbeddedInCompound(text: string, keyword: string, idx: number): boolean {
  const charBefore = idx > 0 ? text[idx - 1] : ''
  const charAfter = idx + keyword.length < text.length ? text[idx + keyword.length] : ''
  return (
    isCJK(charBefore) && isCJK(keyword[0]) &&
    isCJK(charAfter) && isCJK(keyword[keyword.length - 1])
  )
}

function expandQuerySynonyms(q: string): string {
  let extra = ''
  if (/需要附|附什麼|附哪些|哪些文件|什麼文件|所需文件|附件清單|要附什麼|要附哪/.test(q)) {
    extra += ' 附件'
  }
  if (/要繳|繳什麼|送件要|送件需|要準備|準備什麼/.test(q)) {
    extra += ' 附件 書表'
  }
  return q + extra
}

const COUNTY_PAIRS: [string, string][] = [
  ['台北', '台北市'], ['臺北', '台北市'],
  ['新北', '新北市'],
  ['桃園', '桃園市'],
  ['台中', '台中市'], ['臺中', '台中市'],
  ['台南', '台南市'], ['臺南', '台南市'],
  ['高雄', '高雄市'],
  ['基隆', '基隆市'],
  ['新竹市', '新竹市'], ['新竹縣', '新竹縣'],
  ['新竹', '新竹市'],
  ['苗栗', '苗栗縣'],
  ['彰化', '彰化縣'],
  ['南投', '南投縣'],
  ['雲林', '雲林縣'],
  ['嘉義市', '嘉義市'], ['嘉義縣', '嘉義縣'],
  ['嘉義', '嘉義市'],
  ['屏東', '屏東縣'],
  ['宜蘭', '宜蘭縣'],
  ['花蓮', '花蓮縣'],
  ['台東', '台東縣'], ['臺東', '台東縣'],
  ['澎湖', '澎湖縣'],
  ['金門', '金門縣'],
  ['馬祖', '馬祖'],
  ['竹科', '竹科'],
  ['中科', '中科'],
  ['交通局', '交通局'],
]

function detectQueryCounty(q: string): string | null {
  const sorted = [...COUNTY_PAIRS].sort((a, b) => b[0].length - a[0].length)
  for (const [prefix, fullName] of sorted) {
    if (q.includes(prefix)) return fullName
  }
  return null
}

function getEntryCounty(entry: KnowledgeEntry): string | null {
  const allCountyNames = new Set(COUNTY_PAIRS.map(([, name]) => name))
  for (const kw of entry.keywords) {
    if (allCountyNames.has(kw)) return kw
  }
  return null
}

function scoreEntry(q: string, entry: KnowledgeEntry, queryCounty: string | null): number {
  let score = 0
  const qExp = expandQuerySynonyms(q)

  for (const kw of entry.keywords) {
    const kwl = kw.toLowerCase()
    const idx = qExp.indexOf(kwl)
    if (idx !== -1) {
      let s = kwl.length * 3
      const idxOrig = q.indexOf(kwl)
      if (idxOrig !== -1 && isEmbeddedInCompound(q, kwl, idxOrig)) s *= 0.1
      score += s
    }
  }

  if (queryCounty !== null) {
    const entryCounty = getEntryCounty(entry)
    if (entryCounty === queryCounty) {
      score += 15
    } else if (entryCounty !== null) {
      score -= 12
    }
  }

  const ans = entry.answer.toLowerCase()
  const cjkBlocks = q.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{2,}/g) ?? []
  let textBonus = 0
  for (const block of cjkBlocks) {
    for (let len = Math.min(8, block.length); len >= 3; len--) {
      for (let i = 0; i <= block.length - len; i++) {
        if (ans.includes(block.substring(i, i + len))) {
          textBonus = Math.max(textBonus, len * len * 0.5)
        }
      }
    }
  }
  score += textBonus
  return score
}

function searchKnowledge(query: string, topK = 3): Array<{ entry: KnowledgeEntry; score: number }> {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const queryCounty = detectQueryCounty(q)
  const STATIC_MIN = 6

  return knowledgeBaseEntries
    .map(entry => ({ entry, score: scoreEntry(q, entry, queryCounty) }))
    .filter(x => x.score >= STATIC_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

// ─── 問題萃取 ─────────────────────────────────────────────────────────────────

/** 從 answer header 萃取縣市名（如「桃園市」「全國通用」）。 */
function extractCountyFromHeader(answer: string): string {
  const m = answer.match(/\*\*【(.+?)】/)
  return m ? m[1] : ''
}

/** 從縣市名中萃取最短可識別前綴（如「桃園市」→「桃園」），用於偵測查詢是否已含縣市 */
const ALL_COUNTY_NAMES = new Set(COUNTY_PAIRS.map(([, name]) => name))

function queryContainsCounty(q: string): boolean {
  return COUNTY_PAIRS.some(([prefix]) => q.includes(prefix))
}

/**
 * 從 answer markdown 中萃取查詢字串。
 * 優先使用「情境：」（更口語），否則用「問：」。
 * 策略：
 *  1. 若含「這個縣市」佔位符 → 以 header 縣市名取代
 *  2. 若查詢完全不含任何縣市名，且條目屬特定縣市 → 前綴縣市名
 *     （模擬使用者問「嘉義市要附委託書嗎？」的真實場景）
 */
function extractQuery(answer: string): string {
  const county = extractCountyFromHeader(answer)
  const isCountySpecific = county && county !== '全國通用' && ALL_COUNTY_NAMES.has(county)

  const pick = (raw: string): string => {
    let q = raw.trim()
    // 1. 佔位符替換
    if (q.includes('這個縣市') && isCountySpecific) {
      q = q.replace(/這個縣市/g, county)
    }
    // 2. 若查詢完全不含任何縣市詞，且條目屬特定縣市 → 補縣市前綴
    if (isCountySpecific && !queryContainsCounty(q)) {
      q = county + q
    }
    return q
  }

  const contextMatch = answer.match(/\*\*情境：\*\*\s*(.+?)(?:\n|$)/)
  if (contextMatch) return pick(contextMatch[1])

  const questionMatch = answer.match(/\*\*問：\*\*\s*(.+?)(?:\n|$)/)
  if (questionMatch) return pick(questionMatch[1])

  return ''
}

/** 從 answer 萃取條目標識（source 的第一個欄位，如 WKB-001、BS-255）*/
function extractId(source: string): string {
  return source.split(/[，,]/)[0].trim()
}

// ─── 主要驗證邏輯 ──────────────────────────────────────────────────────────────

interface ValidateResult {
  id: string
  query: string
  found: boolean
  rank: number | null   // 1-based，null 表示完全找不到
  topScore: number
  correctScore: number
  topAnswer: string
}

function validate(): void {
  const entries = knowledgeBaseEntries
  const results: ValidateResult[] = []

  for (const entry of entries) {
    const query = extractQuery(entry.answer)
    const id = extractId(entry.source ?? '')

    if (!query) {
      results.push({ id, query: '(無法萃取問題)', found: false, rank: null, topScore: 0, correctScore: 0, topAnswer: '' })
      continue
    }

    const top3 = searchKnowledge(query, 3)
    const correctScore = scoreEntry(
      query.toLowerCase(),
      entry,
      detectQueryCounty(query.toLowerCase())
    )

    // 以 source 相等判斷是否為「正確條目」
    const rank = top3.findIndex(r => r.entry.source === entry.source)
    const found = rank !== -1
    const topScore = top3[0]?.score ?? 0
    const topAnswer = top3[0]
      ? extractQuery(top3[0].entry.answer) || top3[0].entry.answer.split('\n')[0]
      : '（無結果）'

    results.push({ id, query, found, rank: found ? rank + 1 : null, topScore, correctScore, topAnswer })
  }

  // ─── 統計 ─────────────────────────────────────────────────────────────────
  const total = results.length
  const correct = results.filter(r => r.found).length
  const rank1 = results.filter(r => r.rank === 1).length
  const rank2 = results.filter(r => r.rank === 2).length
  const rank3 = results.filter(r => r.rank === 3).length
  const notFound = results.filter(r => !r.found).length
  const accuracy = ((correct / total) * 100).toFixed(1)

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ total, correct, notFound, accuracy: Number(accuracy), results }, null, 2))
    return
  }

  // ─── 文字報告 ──────────────────────────────────────────────────────────────
  const line = '─'.repeat(80)
  console.log(line)
  console.log('  公安知識庫 智慧問答驗證報告')
  console.log(`  產生時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`)
  console.log(line)

  console.log('\n【總體準確率】')
  console.log(`  總知識卡數：${total}`)
  console.log(`  Top-3 命中：${correct} 條  (${accuracy}%)`)
  console.log(`  ├─ 第 1 名：${rank1} 條`)
  console.log(`  ├─ 第 2 名：${rank2} 條`)
  console.log(`  └─ 第 3 名：${rank3} 條`)
  console.log(`  未命中：    ${notFound} 條`)

  // ─── 答對清單 ──────────────────────────────────────────────────────────────
  if (VERBOSE) {
    console.log(`\n${'─'.repeat(80)}`)
    console.log('【答對的條目】')
    const hits = results.filter(r => r.found)
    for (const r of hits) {
      const rankLabel = r.rank === 1 ? '✓ #1' : r.rank === 2 ? '✓ #2' : '✓ #3'
      console.log(`  ${rankLabel}  [${r.id}]  ${r.query.substring(0, 50)}${r.query.length > 50 ? '…' : ''}`)
    }
  } else {
    console.log(`\n  (使用 --verbose 可顯示完整答對清單)`)
  }

  // ─── 答錯/找不到清單（一律顯示）────────────────────────────────────────────
  console.log(`\n${'─'.repeat(80)}`)
  console.log('【答錯或找不到的條目】')
  const misses = results.filter(r => !r.found)

  if (misses.length === 0) {
    console.log('  (無) — 全部命中！')
  } else {
    for (const r of misses) {
      console.log(`\n  ✗ [${r.id}]`)
      console.log(`    查詢：${r.query}`)
      console.log(`    正確分數：${r.correctScore.toFixed(1)}（門檻 6.0）`)
      if (r.topScore > 0) {
        console.log(`    Top-1 分數：${r.topScore.toFixed(1)}，答案：${r.topAnswer.substring(0, 60)}…`)
      } else {
        console.log(`    搜尋結果：無符合條目`)
      }
      // 診斷原因
      if (r.correctScore < 6) {
        console.log(`    診斷：正確條目分數低於門檻，查詢詞與關鍵字重疊不足`)
      } else {
        console.log(`    診斷：正確條目被其他條目超越（正確分 ${r.correctScore.toFixed(1)} < 最高分 ${r.topScore.toFixed(1)}）`)
      }
    }
  }

  console.log(`\n${'─'.repeat(80)}`)
  console.log(`  報告結束  |  命中率 ${accuracy}%  |  Top-3 ${correct}/${total}`)
  console.log('─'.repeat(80))
}

validate()
