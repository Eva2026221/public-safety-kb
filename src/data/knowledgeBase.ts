// 公安知識庫 - 自然語言查詢用的知識庫
import type { KnowledgeEntry } from '../types'
export type { KnowledgeEntry }  // 維持向後相容的 re-export

// PDF 知識條目由 pdfKnowledge 模組在執行期注入
let _pdfEntries: KnowledgeEntry[] = []
export function setPdfEntries(entries: KnowledgeEntry[]): void {
  _pdfEntries = entries
}

import { knowledgeBaseEntries } from './knowledgeBaseEntries'

// 靜態知識庫：由 Excel V6 主表匯入（共 123 條）
export const knowledgeBase: KnowledgeEntry[] = knowledgeBaseEntries

/** 判斷字元是否為中日韓表意文字 */
function isCJK(ch: string): boolean {
  if (!ch) return false
  return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch)
}

/**
 * 判斷關鍵字命中是否為「嵌入式」匹配。
 * 當關鍵字左右兩側都緊鄰其他中文字時（例如查詢「戶外安全梯」命中關鍵字「安全梯」），
 * 表示該關鍵字是更長複合詞的一部分，並非獨立概念，應大幅降低得分。
 *
 * 例外：若相鄰字元為連接詞（和、與、及、或、但、、，等），
 * 表示關鍵字為獨立詞組，不視為嵌入（例：「公安申報和消防申報有什麼不同」中的「消防申報」）。
 */
const CJK_CONNECTIVES = new Set(['和', '與', '及', '或', '但', '、', '，', '。', '：', '；', '/', '、'])
function isEmbeddedInCompound(text: string, keyword: string, idx: number): boolean {
  const charBefore = idx > 0 ? text[idx - 1] : ''
  const charAfter = idx + keyword.length < text.length ? text[idx + keyword.length] : ''
  // 若相鄰為連接詞，該關鍵字為獨立詞組，不懲罰
  if (CJK_CONNECTIVES.has(charBefore) || CJK_CONNECTIVES.has(charAfter)) return false
  return (
    isCJK(charBefore) && isCJK(keyword[0]) &&
    isCJK(charAfter) && isCJK(keyword[keyword.length - 1])
  )
}

// ── 查詢同義詞展開 ────────────────────────────────────────────────────────────
/**
 * 將使用者口語查詢中的隱含概念補全為知識庫關鍵字。
 * 例：「需要附哪些文件」→ 附加「附件」，讓附件類知識卡得到關鍵字命中分。
 */
function expandQuerySynonyms(q: string): string {
  let extra = ''
  // 附件查詢意圖
  if (/需要附|附什麼|附哪些|哪些文件|什麼文件|所需文件|附件清單|要附什麼|要附哪/.test(q)) {
    extra += ' 附件'
  }
  // 書表/表單查詢意圖
  if (/要繳|繳什麼|送件要|送件需|要準備|準備什麼/.test(q)) {
    extra += ' 附件 書表'
  }
  // 罰款口語查詢：「被罰多少錢」「罰多少」「罰錢」→ 映射到正式詞「罰鍰」「處罰」「罰款」
  if (/被罰|罰多少|罰錢|罰幾萬/.test(q)) {
    extra += ' 罰款 罰鍰 處罰'
  }
  // 金額口語查詢：「多少錢」「多少費用」
  if (/多少錢|多少費用|費用多少/.test(q)) {
    extra += ' 金額 費用'
  }
  // 差異/不同 查詢：補充「差異」關鍵字
  if (/有什麼不同|有何不同|差在哪|有差嗎/.test(q)) {
    extra += ' 差異'
  }
  return q + extra
}

// ── 縣市/園區清單（用於縣市優先加權）────────────────────────────────────────
// 格式：[查詢用前綴, 知識庫關鍵字全名]
const COUNTY_PAIRS: [string, string][] = [
  ['台北', '台北市'], ['臺北', '台北市'],
  ['新北', '新北市'],
  ['桃園', '桃園市'],
  ['台中', '台中市'], ['臺中', '台中市'],
  ['台南', '台南市'], ['臺南', '台南市'],
  ['高雄', '高雄市'],
  ['基隆', '基隆市'],
  ['新竹市', '新竹市'], ['新竹縣', '新竹縣'],
  ['新竹', '新竹市'],  // 寬鬆匹配（優先於縣）
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

/** 從查詢字串中偵測縣市前綴，回傳知識庫關鍵字全名（如「桃園」→「桃園市」）或 null。 */
function detectQueryCounty(q: string): string | null {
  // 依前綴長度由長到短排，避免「新竹」誤消費「新竹市」/「新竹縣」
  const sorted = [...COUNTY_PAIRS].sort((a, b) => b[0].length - a[0].length)
  for (const [prefix, fullName] of sorted) {
    if (q.includes(prefix)) return fullName
  }
  return null
}

/** 從條目 keywords 判斷該條目是否屬於特定縣市（回傳縣市名或 null 表示全國通用）。 */
function getEntryCounty(entry: KnowledgeEntry): string | null {
  const allCountyNames = new Set(COUNTY_PAIRS.map(([, name]) => name))
  for (const kw of entry.keywords) {
    if (allCountyNames.has(kw)) return kw
  }
  return null  // 全國通用
}

/** 計算單筆知識卡與查詢字串的相關度分數（靜態條目用）。
 *  - 關鍵字命中加分（長度×3，嵌入式命中乘0.1懲罰）
 *  - 答案內文語意加分（最長匹配詞長²×0.5，最短3字）
 *  - 縣市優先：查詢含縣市時，匹配縣市 +15，不同縣市 -12
 */
function scoreStaticEntry(q: string, entry: KnowledgeEntry, queryCounty: string | null): number {
  let score = 0

  // 展開同義詞後做關鍵字命中（用 qExp），文字語意加分仍用原始 q
  const qExp = expandQuerySynonyms(q)

  for (const kw of entry.keywords) {
    const kwl = kw.toLowerCase()
    const idx = qExp.indexOf(kwl)
    if (idx !== -1) {
      let s = kwl.length * 3
      // isEmbeddedInCompound 仍以原始 q 判斷（展開部分不做懲罰）
      const idxOrig = q.indexOf(kwl)
      if (idxOrig !== -1 && isEmbeddedInCompound(q, kwl, idxOrig)) s *= 0.1
      score += s
    }
  }

  // 縣市加權：查詢含縣市時，精準控制各縣市條目的分數
  if (queryCounty !== null) {
    const entryCounty = getEntryCounty(entry)
    if (entryCounty === queryCounty) {
      score += 15   // 同縣市：大幅加分
    } else if (entryCounty !== null) {
      score -= 12   // 不同縣市：大幅扣分（使其低於門檻）
    }
    // entryCounty === null（全國通用）：不加也不扣，保持中性
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

/** 計算單筆 PDF 條目的相關度分數（更寬鬆策略）。
 *
 *  PDF 文字由 pdfjs 自動萃取，常與使用者口語查詢用詞不一致，需要：
 *  1. 文字搜尋最短降為 2 字（允許「桃園」「申報」等 2 字詞命中）
 *  2. 每個查詢詞塊獨立計分並累加（鼓勵多詞部分命中）
 *  3. 使用更低分數門檻（由呼叫端控制）
 */
function scorePdfEntry(q: string, entry: KnowledgeEntry): number {
  let score = 0

  // 關鍵字命中（與靜態相同）
  for (const kw of entry.keywords) {
    const kwl = kw.toLowerCase()
    const idx = q.indexOf(kwl)
    if (idx !== -1) {
      let s = kwl.length * 3
      if (isEmbeddedInCompound(q, kwl, idx)) s *= 0.1
      score += s
    }
  }

  // 全文搜尋：每個查詢 CJK 詞塊各自找最長命中，累加所有詞塊得分
  const ans = entry.answer.toLowerCase()
  const cjkBlocks = q.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{2,}/g) ?? []
  for (const block of cjkBlocks) {
    let blockScore = 0
    for (let len = Math.min(6, block.length); len >= 2; len--) {
      let found = false
      for (let i = 0; i <= block.length - len; i++) {
        if (ans.includes(block.substring(i, i + len))) {
          blockScore = Math.max(blockScore, len * len * 0.5)
          found = true
          break
        }
      }
      if (found && len >= 3) break  // 找到 3+ 字匹配即停止往下找此塊
    }
    score += blockScore
  }
  return score
}

/**
 * 當查詢包含縣市名時，驗證查詢中「每一個」非縣市、非類組的主題詞都能在
 * 條目的關鍵字或全文中找到對應，避免縣市加分帶出完全不相關的條目。
 *
 * 判斷流程：
 * 1. 從查詢移除所有縣市前綴，取得主題部分
 * 2. 過濾類組代碼（H1/H2/B1 等）後，若無剩餘主題詞 → 不加額外限制
 * 3. 否則：主題部分的「每一個」詞都必須命中條目（ALL 語意，非 ANY）
 *    - 關鍵字命中：條目關鍵字與詞有共同前綴（至少 2 字）
 *    - 全文命中：詞（或長度 ≥3 的前綴）出現在條目答案中
 */
function hasTopicMatch(q: string, entry: KnowledgeEntry, queryCounty: string): boolean {
  let topicQ = q
  for (const [prefix, name] of COUNTY_PAIRS) {
    if (name === queryCounty) {
      topicQ = topicQ.split(prefix.toLowerCase()).join(' ')
    }
  }
  topicQ = topicQ.replace(/\s+/g, ' ').trim()

  // 類組代碼：H1、H2、B1、B2 等（單字母 + 單數字）排除在主題詞要求之外
  const isGroupCode = (s: string): boolean => /^[a-z][0-9]$/i.test(s)

  const cjkBlocks   = topicQ.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{2,}/g) ?? []
  const asciiTokens = (topicQ.match(/[a-z0-9]{2,}/gi) ?? []).filter(t => !isGroupCode(t))

  // 純縣市 / 類組查詢 → 不加額外限制
  if (cjkBlocks.length === 0 && asciiTokens.length === 0) return true

  const countyNames = new Set(COUNTY_PAIRS.map(([, n]) => n.toLowerCase()))
  const ans = entry.answer.toLowerCase()

  // 判斷單一主題詞是否命中此條目
  const tokenMatches = (token: string): boolean => {
    const tokenL = token.toLowerCase()

    // 關鍵字命中：條目關鍵字（非縣市、非類組）與 token 有共同前綴
    for (const kw of entry.keywords) {
      const kwl = kw.toLowerCase()
      if (kwl.length >= 2 && !countyNames.has(kwl) && !isGroupCode(kwl)) {
        if (kwl === tokenL || tokenL.startsWith(kwl) || kwl.startsWith(tokenL)) return true
      }
    }

    // 全文命中：token（或 ≥minLen 的前綴）出現在答案中
    const minLen = tokenL.length <= 2 ? 2 : 3
    for (let len = tokenL.length; len >= minLen; len--) {
      if (ans.includes(tokenL.substring(0, len))) return true
    }

    return false
  }

  // 每一個主題詞都必須命中（ALL，非 ANY）
  for (const block of cjkBlocks) {
    if (!tokenMatches(block)) return false
  }
  for (const token of asciiTokens) {
    if (!tokenMatches(token)) return false
  }

  return true
}

/**
 * 顯示搜尋結果所需的最低相關度分數。
 *
 * 分數說明：
 *   - 2 字關鍵字完整命中 = 6 分（過低，可能是偶發命中）
 *   - 3 字關鍵字完整命中 = 9 分
 *   - 4 字關鍵字完整命中 = 12 分
 *   - 縣市匹配加成       = +15 分
 *
 * 門檻設為 10，要求至少：4 字關鍵字命中，或 3 字命中 + 文字語意加分，
 * 或多個短關鍵字組合命中。單一 2 字關鍵字（分數 6）視為不足以顯示。
 */
export const SEARCH_SCORE_THRESHOLD = 10

/**
 * 語意搜尋：靜態知識庫與 PDF 條目分別評分後合併排序。
 *
 * @param minScore 靜態條目的最低顯示分數，預設 SEARCH_SCORE_THRESHOLD。
 *   PDF 條目固定使用較低門檻（4），因自動萃取文字與口語查詢存在用詞差距。
 */
export const searchKnowledge = (
  query: string,
  topK = 3,
  minScore = SEARCH_SCORE_THRESHOLD,
): KnowledgeEntry[] => {
  if (!query.trim()) return []

  const q = query.toLowerCase()
  const PDF_MIN = 4

  const queryCounty = detectQueryCounty(q)

  const staticScored = knowledgeBase
    .map(entry => ({ entry, score: scoreStaticEntry(q, entry, queryCounty) }))
    // 硬性縣市過濾：不同縣市的條目直接排除（不依賴扣分），通用條目保留
    .filter(x => {
      if (queryCounty === null) return true
      const ec = getEntryCounty(x.entry)
      return ec === null || ec === queryCounty
    })
    .filter(x => x.score >= minScore)
    .filter(x => queryCounty === null || hasTopicMatch(q, x.entry, queryCounty))

  const pdfScored = _pdfEntries
    .map(entry => ({ entry, score: scorePdfEntry(q, entry) }))
    .filter(x => x.score >= PDF_MIN)

  return [...staticScored, ...pdfScored]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(x => x.entry)
}

// ─────────────────────────────────────────────────────────────────────────────
// 過濾式搜尋
// ─────────────────────────────────────────────────────────────────────────────

/** 結構化篩選條件。未傳或傳 'all' 表示不限該維度。 */
export interface SearchFilters {
  /** 縣市全名，如「台北市」；'all' 或不傳表示不限 */
  county?: string
  /** 類組 ID，如 'H2' | 'U2' | '學校' | 'G類'；'all' 或不傳表示不限 */
  group?: string
  /** 階段 ID，如 '書表整理' | '現場檢查' | '申報' | '申報前'；'all' 或不傳表示不限 */
  stage?: string
  /** 審件風險等級，'高' | '中' | '低'；不傳表示不限 */
  risk?: string
}

// 階段 ID → 知識庫 metadata 中的階段值（一對多）
const FILTER_STAGE_MATCH: Record<string, string[]> = {
  '書表整理': ['書表整理', '現場檢查/書表整理'],
  '現場檢查': ['現場檢查', '現場檢查/書表整理'],
  '申報':     ['申報'],
  '申報前':   ['申報前／評選準備'],
}

const RISK_ORDER: Record<string, number> = { '高': 0, '中': 1, '低': 2 }

/** 從 answer 文字萃取條目所屬縣市（無則回傳「全國通用」）。 */
function parseEntryCounty(answer: string): string {
  return answer.match(/\*\*【([^】]+)】/)?.[1] ?? '全國通用'
}

/** 從 answer 尾部 metadata 行萃取類組、階段、審件風險。
 *  「類組：全」視為全類組通用，對應 group = null。
 */
function parseEntryMeta(answer: string) {
  const meta = answer.match(/_(WKB|BS)-\S+[^\n]*/)?.[0] ?? ''
  const rawGroup = meta.match(/類組：([^\s　_]+)/)?.[1] ?? null
  return {
    group: rawGroup === '全' ? null : rawGroup,
    stage: meta.match(/階段：([^\s　_\/]+(?:\/[^\s　_]+)?)/)?.[1] ?? '',
    risk:  meta.match(/審件風險：([^\s　_]+)/)?.[1] ?? '',
  }
}

/**
 * 過濾式搜尋：結構篩選 + 可選文字評分，只搜尋靜態知識庫。
 *
 * - 僅傳 filters：依風險等級排序後回傳全部符合條目
 * - 同時傳 query：先套用篩選，再依文字相關度排序（分數 < SEARCH_SCORE_THRESHOLD 者排除）
 * - topK：不傳表示回傳全部符合筆數
 */
export function searchKnowledgeFiltered(
  query: string,
  filters: SearchFilters = {},
  topK?: number,
): KnowledgeEntry[] {
  const { county, group, stage, risk } = filters
  const hasQuery = query.trim().length > 0
  const q = query.toLowerCase()
  const queryCounty = hasQuery ? detectQueryCounty(q) : null

  type Candidate = { entry: KnowledgeEntry; score: number; risk: string; group: string | null }

  const candidates: Candidate[] = []

  for (const entry of knowledgeBase) {
    const entryCounty = parseEntryCounty(entry.answer)
    const meta = parseEntryMeta(entry.answer)

    // ── 縣市篩選 ──
    if (county && county !== 'all') {
      if (entryCounty !== county && entryCounty !== '全國通用') continue
    }

    // ── 類組篩選：指定類組時，排除屬於其他類組的條目，保留通用條目（group === null） ──
    if (group && group !== 'all') {
      if (meta.group !== null && meta.group !== group) continue
    }

    // ── 階段篩選：指定階段時，排除 stage 不符的條目，空 stage 視為通用保留 ──
    if (stage && stage !== 'all') {
      const allowed = FILTER_STAGE_MATCH[stage] ?? []
      if (meta.stage !== '' && !allowed.includes(meta.stage)) continue
    }

    // ── 風險篩選 ──
    if (risk && meta.risk !== risk) continue

    const score = hasQuery ? scoreStaticEntry(q, entry, queryCounty) : 0
    candidates.push({ entry, score, risk: meta.risk, group: meta.group })
  }

  candidates.sort((a, b) => {
    if (hasQuery) {
      // 高分優先；同分時依風險排序
      if (b.score !== a.score) return b.score - a.score
    }
    const rDiff = (RISK_ORDER[a.risk] ?? 3) - (RISK_ORDER[b.risk] ?? 3)
    if (rDiff !== 0) return rDiff
    // 有指定類組的條目優先於通用條目
    return (a.group ? 0 : 1) - (b.group ? 0 : 1)
  })

  const out = hasQuery
    ? candidates.filter(x => x.score >= SEARCH_SCORE_THRESHOLD)
    : candidates

  return (topK !== undefined ? out.slice(0, topK) : out).map(x => x.entry)
}

