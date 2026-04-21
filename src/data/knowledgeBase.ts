import { entries as allEntries } from './knowledgeBaseEntries'
import type { Entry, SearchPhase, KnowledgeEntry } from '../types'

export { allEntries }

// ── 縣市對照表 ───────────────────────────────────────────────────────────────
const COUNTY_MAP: [string, string][] = [
  ['臺北市', '台北市'], ['台北市', '台北市'], ['台北', '台北市'],
  ['新北市', '新北市'], ['新北', '新北市'],
  ['桃園市', '桃園市'], ['桃園', '桃園市'],
  ['臺中市', '台中市'], ['台中市', '台中市'], ['台中', '台中市'],
  ['臺南市', '台南市'], ['台南市', '台南市'], ['台南', '台南市'],
  ['高雄市', '高雄市'], ['高雄', '高雄市'],
  ['基隆市', '基隆市'], ['基隆', '基隆市'],
  ['新竹市', '新竹市'], ['新竹縣', '新竹縣'], ['新竹', '新竹市'],
  ['苗栗縣', '苗栗縣'], ['苗栗', '苗栗縣'],
  ['彰化縣', '彰化縣'], ['彰化', '彰化縣'],
  ['南投縣', '南投縣'], ['南投', '南投縣'],
  ['雲林縣', '雲林縣'], ['雲林', '雲林縣'],
  ['嘉義市', '嘉義市'], ['嘉義縣', '嘉義縣'], ['嘉義', '嘉義市'],
  ['屏東縣', '屏東縣'], ['屏東', '屏東縣'],
  ['宜蘭縣', '宜蘭縣'], ['宜蘭', '宜蘭縣'],
  ['花蓮縣', '花蓮縣'], ['花蓮', '花蓮縣'],
  ['臺東縣', '台東縣'], ['台東縣', '台東縣'], ['台東', '台東縣'],
  ['澎湖縣', '澎湖縣'], ['澎湖', '澎湖縣'],
  ['金門縣', '金門縣'], ['金門', '金門縣'],
  ['連江縣', '連江縣'], ['馬祖', '馬祖'],
  ['竹科', '竹科'], ['中科', '中科'], ['交通局', '交通局'],
]
const COUNTY_MAP_SORTED = [...COUNTY_MAP].sort((a, b) => b[0].length - a[0].length)

export function detectCounty(query: string): string | null {
  for (const [prefix, full] of COUNTY_MAP_SORTED) {
    if (query.includes(prefix)) return full
  }
  return null
}

// ── 類組偵測 ─────────────────────────────────────────────────────────────────
const GROUP_PATTERNS: [RegExp, string][] = [
  [/H2|集合住宅/i, 'H2'],
  [/U2|工業廠房|廠房/i, 'U2'],
  [/學校/, '學校'],
  [/G類|餐廳|飲食/, 'G類'],
  [/B類/i, 'B類'],
]

export function detectGroup(query: string): string | null {
  for (const [re, group] of GROUP_PATTERNS) {
    if (re.test(query)) return group
  }
  return null
}

// ── 同義詞展開 ───────────────────────────────────────────────────────────────
const SYNONYMS: [RegExp, string][] = [
  [/公安/, '公共安全申報'],
  [/門弓器|自動關閉/, '門弓器 自動關閉裝置'],
  [/防火門/, '防火門 甲種防火門'],
  [/退件|不予受理/, '退件 不予受理 補件'],
  [/缺失|不合格/, '缺失 不合格'],
  [/附件|文件|要附|附什麼|附哪些/, '附件 書表 清單'],
  [/改善計畫/, '改善計畫書'],
  [/格柵/, '格柵 活動窗扇'],
  [/照片|相片/, '照片 相片'],
  [/申報份數/, '申報份數 申報份'],
]

function expandQuery(q: string): string {
  let expanded = q
  for (const [re, extra] of SYNONYMS) {
    if (re.test(q)) expanded += ' ' + extra
  }
  return expanded
}

// ── 中文 n-gram 搜尋引擎 ─────────────────────────────────────────────────────
/**
 * 從查詢字串抽取所有 CJK n-gram（長度 2~5），以及 ASCII token。
 * 例：「台北市H2分戶門」→ ['台北', '北市', '台北市', '分戶', '戶門', '分戶門', 'H2']
 */
function extractTerms(query: string): string[] {
  const terms = new Set<string>()
  // CJK n-gram
  const cjkBlocks = query.match(/[一-鿿㐀-䶿豈-﫿]{2,}/g) ?? []
  for (const block of cjkBlocks) {
    const maxLen = Math.min(block.length, 6)
    for (let len = 2; len <= maxLen; len++) {
      for (let i = 0; i <= block.length - len; i++) {
        terms.add(block.substring(i, i + len))
      }
    }
  }
  // ASCII token（類組代碼、縣市英文等）
  const ascii = query.match(/[A-Za-z0-9]{2,}/g) ?? []
  for (const t of ascii) terms.add(t.toUpperCase())
  return [...terms]
}

/**
 * 計算查詢 terms 在一段文字中的加總分數。
 * 長字串命中得分更高（長度²），避免短字偶發命中主導排名。
 */
function scoreText(terms: string[], text: string): number {
  if (!text) return 0
  const t = text.toUpperCase()
  let score = 0
  let matched = 0
  for (const term of terms) {
    if (t.includes(term.toUpperCase())) {
      score += term.length * term.length
      matched++
    }
  }
  // 額外獎勵：命中越多不同詞越好（避免重複命中同一詞的子集）
  if (matched >= 3) score *= 1.2
  if (matched >= 5) score *= 1.3
  return score
}

/**
 * 計算單筆條目的總分。
 * 欄位權重：question(3.0) > topic(2.5) > conclusion(1.0) > detail(0.5)
 *
 * 必要條件（防止偶發 2 字命中）：
 * 若查詢含有 3+ 字 n-gram，則 question 或 topic 中至少要有一個命中，
 * 否則直接回傳 0。
 */
function scoreEntry(terms: string[], entry: Entry): number {
  // 驗證：至少一個 3+ 字 n-gram 命中 question、topic 或 stage
  const terms3 = terms.filter(t => t.length >= 3)
  if (terms3.length > 0) {
    const qt = (entry.question + ' ' + entry.topic + ' ' + entry.stage).toUpperCase()
    const hasHit = terms3.some(t => qt.includes(t.toUpperCase()))
    if (!hasHit) return 0
  }

  return (
    scoreText(terms, entry.question)   * 3.0 +
    scoreText(terms, entry.topic)      * 2.5 +
    scoreText(terms, entry.conclusion) * 1.0 +
    scoreText(terms, entry.detail)     * 0.5 +
    scoreText(terms, entry.stage)      * 0.8
  )
}

const MIN_SCORE = 20

// ── 主搜尋函式 ───────────────────────────────────────────────────────────────
export interface SearchOptions {
  county?: string | null
  group?: string | null
  topK?: number
}

function _searchWithScore(query: string, opts: SearchOptions = {}): { hits: Entry[]; topScore: number } {
  if (!query.trim()) return { hits: [], topScore: 0 }

  const county = opts.county !== undefined ? opts.county : detectCounty(query)
  const group  = opts.group  !== undefined ? opts.group  : detectGroup(query)
  const topK   = opts.topK ?? 5

  const expanded = expandQuery(query)
  const terms = extractTerms(expanded)
  if (terms.length === 0) return { hits: [], topScore: 0 }

  // 縣市過濾
  let pool: Entry[] = county
    ? allEntries.filter(e => e.county === county || e.county === '全國通用')
    : allEntries

  // 類組過濾
  if (group) {
    pool = pool.filter(e => e.group === null || e.group === group)
  }

  type Scored = { entry: Entry; score: number }

  // qa 條目搜尋
  const qaPool  = pool.filter(e => e.type === 'qa')
  const regPool = pool.filter(e => e.type === 'regulation')

  const qaScored: Scored[] = qaPool
    .map(e => ({ entry: e, score: scoreEntry(terms, e) }))
    .filter(x => x.score >= MIN_SCORE)

  // 縣市精確命中加權（同縣市 × 1.5）
  if (county) {
    for (const s of qaScored) {
      if (s.entry.county === county) s.score *= 1.5
    }
  }

  qaScored.sort((a, b) => b.score - a.score)
  const qaHits = qaScored.slice(0, topK).map(s => s.entry)

  if (qaHits.length >= topK) return { hits: qaHits, topScore: qaScored[0]?.score ?? 0 }

  // qa 不足才補 regulation
  const need = topK - qaHits.length
  const regScored: Scored[] = regPool
    .map(e => ({ entry: e, score: scoreEntry(terms, e) }))
    .filter(x => x.score >= MIN_SCORE * 1.5) // regulation 門檻更高
    .sort((a, b) => b.score - a.score)
    .slice(0, need)

  return {
    hits: [...qaHits, ...regScored.map(s => s.entry)],
    topScore: qaScored[0]?.score ?? regScored[0]?.score ?? 0,
  }
}

export function search(query: string, opts: SearchOptions = {}): Entry[] {
  return _searchWithScore(query, opts).hits
}

// ── 分類結果 ─────────────────────────────────────────────────────────────────
const HIGH_CONFIDENCE_SCORE = 50

export function classify(query: string, forceCounty?: string | null): SearchPhase {
  if (!query.trim()) return { kind: 'idle' }

  const county = forceCounty !== undefined ? forceCounty : detectCounty(query)
  const { hits: results, topScore } = _searchWithScore(query, { county, topK: 8 })

  if (results.length === 0) return { kind: 'not_found', query }

  // 低信心：分數不夠高且有多筆結果，不強迫給出單一答案
  if (topScore < HIGH_CONFIDENCE_SCORE && results.length > 1) {
    return { kind: 'low_confidence', candidates: results.slice(0, 5) }
  }

  if (results.length === 1) return { kind: 'answer', entry: results[0] }

  const conclusions = new Set(results.map(e => e.conclusion))
  if (conclusions.size === 1) return { kind: 'answer', entry: results[0] }

  // 全國通用條目排第一 → 直接回傳，無需詢問縣市
  if (results[0].county === '全國通用') {
    return { kind: 'answer', entry: results[0] }
  }

  // 未指定縣市，且結果跨兩個以上縣市 → 才詢問縣市
  if (!county) {
    const counties = [...new Set(
      results.map(e => e.county).filter(c => c !== '全國通用')
    )]
    if (counties.length >= 2) {
      return {
        kind: 'ambiguous',
        question: { type: 'county', options: counties },
        candidates: results,
      }
    }
  }

  // 其餘情況信任搜尋引擎排名，回傳第一筆
  return { kind: 'answer', entry: results[0] }
}

// ── 過濾式搜尋 ───────────────────────────────────────────────────────────────
export function searchFiltered(opts: {
  county?: string
  group?: string
  stage?: string
  query?: string
  topK?: number
}): Entry[] {
  const { county, group, stage, query = '', topK = 20 } = opts

  let pool = allEntries.filter(e => e.type === 'qa')

  if (county && county !== 'all') {
    pool = pool.filter(e => e.county === county || e.county === '全國通用')
  }
  if (group && group !== 'all') {
    pool = pool.filter(e => e.group === null || e.group === group)
  }
  if (stage && stage !== 'all') {
    const stageAliases: Record<string, string[]> = {
      '書表整理': ['書表整理', '現場檢查/書表整理'],
      '現場檢查': ['現場檢查', '現場檢查/書表整理'],
      '申報':     ['申報'],
      '申報前':   ['申報前／評選準備'],
    }
    const allowed = stageAliases[stage] ?? [stage]
    pool = pool.filter(e => !e.stage || allowed.includes(e.stage))
  }

  if (!query.trim()) {
    const riskOrder: Record<string, number> = { '高': 0, '中': 1, '低': 2 }
    return [...pool]
      .sort((a, b) => (riskOrder[a.risk] ?? 3) - (riskOrder[b.risk] ?? 3))
      .slice(0, topK)
  }

  const expanded = expandQuery(query)
  const terms = extractTerms(expanded)
  return pool
    .map(e => ({ e, score: scoreEntry(terms, e) }))
    .filter(x => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(x => x.e)
}

// ── 向後相容（供 pdfKnowledge.ts 使用） ─────────────────────────────────────
let _pdfEntries: KnowledgeEntry[] = []

export function setPdfEntries(entries: KnowledgeEntry[]): void {
  _pdfEntries = entries
}

export function searchKnowledge(query: string, topK = 3): KnowledgeEntry[] {
  if (!query.trim() || _pdfEntries.length === 0) return []
  const q = query.toLowerCase()
  return _pdfEntries
    .map(e => {
      const score = e.keywords.reduce(
        (s, kw) => s + (q.includes(kw.toLowerCase()) ? kw.length * kw.length : 0), 0
      )
      return { e, score }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(x => x.e)
}

export const SEARCH_SCORE_THRESHOLD = 10
