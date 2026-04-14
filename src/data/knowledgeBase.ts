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
 */
function isEmbeddedInCompound(text: string, keyword: string, idx: number): boolean {
  const charBefore = idx > 0 ? text[idx - 1] : ''
  const charAfter = idx + keyword.length < text.length ? text[idx + keyword.length] : ''
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
  // 附件查詢意圖：文件、需要附、附什麼、附哪些、附清單
  if (/需要附|附什麼|附哪些|哪些文件|什麼文件|所需文件|附件清單|要附什麼|要附哪/.test(q)) {
    extra += ' 附件'
  }
  // 書表/表單查詢意圖
  if (/要繳|繳什麼|送件要|送件需|要準備|準備什麼/.test(q)) {
    extra += ' 附件 書表'
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
 * 語意搜尋：靜態知識庫與 PDF 條目分別評分後合併排序。
 *
 * 靜態條目：MIN_SCORE = 6（嚴格，避免雜訊）
 * PDF 條目：MIN_SCORE = 4（寬鬆，因自動萃取文字與口語查詢存在用詞差距）
 */
export const searchKnowledge = (query: string): KnowledgeEntry[] => {
  if (!query.trim()) return []

  const q = query.toLowerCase()
  const STATIC_MIN = 6
  const PDF_MIN = 4

  const queryCounty = detectQueryCounty(q)

  const staticScored = knowledgeBase
    .map(entry => ({ entry, score: scoreStaticEntry(q, entry, queryCounty) }))
    .filter(x => x.score >= STATIC_MIN)

  const pdfScored = _pdfEntries
    .map(entry => ({ entry, score: scorePdfEntry(q, entry) }))
    .filter(x => x.score >= PDF_MIN)

  return [...staticScored, ...pdfScored]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.entry)
}

export const generateAIResponse = (query: string): string => {
  const results = searchKnowledge(query)

  if (results.length === 0) {
    // 通用回應
    if (query.includes('你好') || query.includes('哈囉') || query.includes('嗨')) {
      return `您好！我是公安知識庫 AI 助理，專門提供公共安全法規查詢服務。

我可以協助您：
- **消防法規查詢**：滅火器、撒水頭、火警設備等設置規定
- **建築安全規定**：逃生通道、安全門、公共安全申報等
- **附件清單查詢**：依場所類組查詢所需備齊文件
- **現場缺失判斷**：協助評估場所是否有違規缺失

請問您有什麼問題需要協助？`
    }

    if (query.includes('謝') || query.includes('感謝')) {
      return '不客氣！如有任何公安法規相關問題，歡迎隨時提問。保持場所安全，保護每一位使用者！'
    }

    return `感謝您的提問。根據您詢問的「${query.substring(0, 20)}${query.length > 20 ? '...' : ''}」，目前知識庫尚無完全匹配的資料。

**建議您可以嘗試：**
- 使用更具體的關鍵字，如「消防安全設備」、「防火管理人」、「公共安全申報」等
- 切換到「附件查詢」頁面，依場所類組查詢所需文件
- 使用「缺失判斷」功能評估現場安全狀況

如需進一步協助，建議洽詢當地消防機關或建管機關。`
  }

  if (results.length === 1) {
    return results[0].answer + (results[0].source ? `\n\n📋 **法規依據：** ${results[0].source}` : '')
  }

  // 多個結果時合併
  let response = `根據您的查詢，找到以下相關資訊：\n\n`
  results.slice(0, 2).forEach((result, index) => {
    response += `${index + 1}. ${result.answer}\n\n`
    if (result.source) {
      response += `📋 **法規依據：** ${result.source}\n\n`
    }
    if (index < results.slice(0, 2).length - 1) {
      response += '---\n\n'
    }
  })

  return response
}
