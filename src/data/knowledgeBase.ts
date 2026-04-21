import Fuse, { type IFuseOptions } from 'fuse.js'
import { entries as allEntries } from './knowledgeBaseEntries'
import type { Entry, SearchPhase } from '../types'

export { allEntries }

// ── 縣市對照表（查詢用前綴 → 知識庫全名） ───────────────────────────────────
const COUNTY_MAP: [string, string][] = [
  ['臺北市', '台北市'], ['台北市', '台北市'], ['台北', '台北市'],
  ['新北市', '新北市'], ['新北', '新北市'],
  ['桃園市', '桃園市'], ['桃園', '桃園市'],
  ['臺中市', '台中市'], ['台中市', '台中市'], ['台中', '台中市'],
  ['臺南市', '台南市'], ['台南市', '台南市'], ['台南', '台南市'],
  ['高雄市', '高雄市'], ['高雄', '高雄市'],
  ['基隆市', '基隆市'], ['基隆', '基隆市'],
  ['新竹市', '新竹市'],
  ['新竹縣', '新竹縣'],
  ['新竹', '新竹市'],
  ['苗栗縣', '苗栗縣'], ['苗栗', '苗栗縣'],
  ['彰化縣', '彰化縣'], ['彰化', '彰化縣'],
  ['南投縣', '南投縣'], ['南投', '南投縣'],
  ['雲林縣', '雲林縣'], ['雲林', '雲林縣'],
  ['嘉義市', '嘉義市'],
  ['嘉義縣', '嘉義縣'],
  ['嘉義', '嘉義市'],
  ['屏東縣', '屏東縣'], ['屏東', '屏東縣'],
  ['宜蘭縣', '宜蘭縣'], ['宜蘭', '宜蘭縣'],
  ['花蓮縣', '花蓮縣'], ['花蓮', '花蓮縣'],
  ['臺東縣', '台東縣'], ['台東縣', '台東縣'], ['台東', '台東縣'],
  ['澎湖縣', '澎湖縣'], ['澎湖', '澎湖縣'],
  ['金門縣', '金門縣'], ['金門', '金門縣'],
  ['連江縣', '連江縣'], ['馬祖', '馬祖'],
  ['竹科', '竹科'],
  ['中科', '中科'],
  ['交通局', '交通局'],
]

// 長字串優先，避免「新竹」吃掉「新竹市」
const COUNTY_MAP_SORTED = [...COUNTY_MAP].sort((a, b) => b[0].length - a[0].length)

export function detectCounty(query: string): string | null {
  const q = query.toLowerCase()
  for (const [prefix, full] of COUNTY_MAP_SORTED) {
    if (q.includes(prefix.toLowerCase())) return full
  }
  return null
}

// ── 類組偵測 ────────────────────────────────────────────────────────────────
const GROUP_PATTERNS: [RegExp, string][] = [
  [/H2|集合住宅/i, 'H2'],
  [/U2|工業廠房|廠房/i, 'U2'],
  [/學校/,         '學校'],
  [/G類|餐廳|飲食/,'G類'],
  [/B類/i,         'B類'],
  [/H1/i,          'H1'],
]

export function detectGroup(query: string): string | null {
  for (const [re, group] of GROUP_PATTERNS) {
    if (re.test(query)) return group
  }
  return null
}

// ── 階段偵測 ────────────────────────────────────────────────────────────────
const STAGE_PATTERNS: [RegExp, string][] = [
  [/書表|表單|報告書|附件|清單|文件/,   '書表整理'],
  [/現場|勘驗|到場|缺失認定/,           '現場檢查'],
  [/申報|送件|申請/,                    '申報'],
  [/申報前|評選|準備/,                  '申報前'],
]

export function detectStage(query: string): string | null {
  for (const [re, stage] of STAGE_PATTERNS) {
    if (re.test(query)) return stage
  }
  return null
}

// ── 同義詞展開 ───────────────────────────────────────────────────────────────
const SYNONYMS: [RegExp, string][] = [
  [/公安/, '公共安全申報'],
  [/門弓器/, '門弓器 自動關閉'],
  [/防火門/, '防火門 甲種防火門'],
  [/退件/, '退件 不予受理 補件'],
  [/缺失/, '缺失 不合格'],
  [/附件|文件|要附/, '附件 書表 清單'],
  [/改善計畫/, '改善計畫書'],
  [/格柵/, '格柵 活動窗扇'],
]

function expandQuery(q: string): string {
  let expanded = q
  for (const [re, extra] of SYNONYMS) {
    if (re.test(q)) expanded += ' ' + extra
  }
  return expanded
}

// ── Fuse.js 索引設定 ──────────────────────────────────────────────────────────
// qa 條目：question + topic 雙重加權；threshold 0.38（嚴格，避免假陽性）
const fuseOptionsQA: IFuseOptions<Entry> = {
  keys: [
    { name: 'question',   weight: 0.45 },
    { name: 'topic',      weight: 0.35 },
    { name: 'conclusion', weight: 0.12 },
    { name: 'detail',     weight: 0.08 },
  ],
  threshold: 0.38,
  distance: 150,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 3,  // 至少 3 字才算命中，防止偶發 2 字誤配
}

// regulation 條目：只在 qa 無結果時使用，threshold 寬鬆一點
const fuseOptionsReg: IFuseOptions<Entry> = {
  keys: [
    { name: 'topic',    weight: 0.50 },
    { name: 'detail',   weight: 0.30 },
    { name: 'question', weight: 0.20 },
  ],
  threshold: 0.35,
  distance: 150,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
}


// ── 核心搜尋函式 ─────────────────────────────────────────────────────────────

export interface SearchOptions {
  county?: string | null
  group?: string | null
  topK?: number
}

/**
 * 主搜尋函式：
 * 1. 偵測縣市/類組（可由呼叫端覆蓋）
 * 2. 縣市過濾（精確）
 * 3. 先搜 qa 條目；若結果不足再補 regulation 條目
 * 4. 回傳最多 topK 筆
 */
export function search(query: string, opts: SearchOptions = {}): Entry[] {
  if (!query.trim()) return []

  const county = opts.county !== undefined ? opts.county : detectCounty(query)
  const group  = opts.group  !== undefined ? opts.group  : detectGroup(query)
  const topK   = opts.topK ?? 5

  const expandedQuery = expandQuery(query)

  // 縣市過濾
  let pool = county
    ? allEntries.filter(e => e.county === county || e.county === '全國通用')
    : allEntries

  // 類組過濾
  if (group) {
    pool = pool.filter(e => e.group === null || e.group === group)
  }

  if (pool.length === 0) return []

  // 先搜 qa 條目
  const qaPool  = pool.filter(e => e.type === 'qa')
  const regPool = pool.filter(e => e.type === 'regulation')

  const qaRaw = new Fuse(qaPool, fuseOptionsQA)
    .search(expandedQuery, { limit: topK * 3 })
    .filter(r => (r.score ?? 1) < 0.38)

  // 縣市指定時，精確縣市的條目得分提升（乘 0.75，Fuse 分數越低越好）
  const qaScored = county
    ? qaRaw.map(r => ({
        item: r.item,
        score: r.item.county === county ? (r.score ?? 0) * 0.75 : (r.score ?? 0),
      })).sort((a, b) => a.score - b.score)
    : qaRaw.map(r => ({ item: r.item, score: r.score ?? 0 }))

  const qaHits = qaScored.slice(0, topK).map(r => r.item)

  if (qaHits.length >= topK) return qaHits

  // qa 不足才補 regulation
  const need = topK - qaHits.length
  const regHits = new Fuse(regPool, fuseOptionsReg)
    .search(expandedQuery, { limit: need * 3 })
    .filter(r => (r.score ?? 1) < 0.35)
    .map(r => r.item)
    .slice(0, need)

  return [...qaHits, ...regHits]
}

// ── 分類結果，決定 UI 狀態 ──────────────────────────────────────────────────

/**
 * 自然語言查詢 → SearchPhase
 *
 * | 情況                          | 回傳                    |
 * |-------------------------------|-------------------------|
 * | 0 筆                          | not_found               |
 * | 1 筆 / 結論完全相同           | answer（第 1 筆）       |
 * | 多筆，包含 2+ 個不同縣市      | ambiguous（問縣市）     |
 * | 多筆，縣市同、結論不同        | ambiguous（問情境）     |
 * | 多筆，縣市同、結論相同        | answer（第 1 筆）       |
 */
export function classify(query: string, forceCounty?: string | null): SearchPhase {
  if (!query.trim()) return { kind: 'idle' }

  const county = forceCounty !== undefined ? forceCounty : detectCounty(query)
  const results = search(query, { county, topK: 8 })

  if (results.length === 0) return { kind: 'not_found', query }

  if (results.length === 1) return { kind: 'answer', entry: results[0] }

  // 結論是否全部一樣
  const conclusions = new Set(results.map(e => e.conclusion))
  if (conclusions.size === 1) return { kind: 'answer', entry: results[0] }

  // 查詢沒指定縣市，但結果有多個縣市 → 問縣市
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

  // 同縣市但主題不同 → 問情境（用 topic 分組）
  const topics = [...new Set(results.map(e => e.topic))]
  if (topics.length >= 2) {
    return {
      kind: 'ambiguous',
      question: { type: 'topic', options: topics.slice(0, 5) },
      candidates: results,
    }
  }

  // 找不到明顯差異，回傳第一筆
  return { kind: 'answer', entry: results[0] }
}

// ── 過濾式搜尋（給引導選單用） ──────────────────────────────────────────────
export function searchFiltered(opts: {
  county?: string
  group?: string
  stage?: string
  query?: string
  topK?: number
}): Entry[] {
  const { county, group, stage, query = '', topK = 20 } = opts

  let pool = allEntries

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

  // 無文字查詢：qa 優先，依風險排序
  if (!query.trim()) {
    const riskOrder: Record<string, number> = { '高': 0, '中': 1, '低': 2 }
    return [...pool]
      .sort((a, b) => {
        const typeDiff = (a.type === 'qa' ? 0 : 1) - (b.type === 'qa' ? 0 : 1)
        if (typeDiff !== 0) return typeDiff
        return (riskOrder[a.risk] ?? 3) - (riskOrder[b.risk] ?? 3)
      })
      .slice(0, topK)
  }

  const qaPool = pool.filter(e => e.type === 'qa')
  return new Fuse(qaPool, fuseOptionsQA)
    .search(expandQuery(query), { limit: topK })
    .filter(r => (r.score ?? 1) < 0.45)
    .map(r => r.item)
}

// ── 向後相容：供 pdfKnowledge.ts 使用 ───────────────────────────────────────
import type { KnowledgeEntry } from '../types'

let _pdfEntries: KnowledgeEntry[] = []

export function setPdfEntries(entries: KnowledgeEntry[]): void {
  _pdfEntries = entries
}

/** 舊格式搜尋（供 PdfUploader 預覽用），不影響主搜尋引擎 */
export function searchKnowledge(query: string, topK = 3): KnowledgeEntry[] {
  if (!query.trim() || _pdfEntries.length === 0) return []
  const q = query.toLowerCase()
  return _pdfEntries
    .map(e => {
      const score = e.keywords.reduce((s, kw) => s + (q.includes(kw.toLowerCase()) ? kw.length : 0), 0)
      return { e, score }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(x => x.e)
}

export const SEARCH_SCORE_THRESHOLD = 10
