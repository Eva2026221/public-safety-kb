/**
 * PDF 知識庫模組
 * 負責：PDF 文字解析、關鍵字萃取、localStorage 持久化、知識條目管理
 */
import * as pdfjsLib from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { KnowledgeEntry, PdfDocument } from '../types'
import { setPdfEntries } from './knowledgeBase'

// ── Worker 設定（Vite ESM 方式）──────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

const STORAGE_KEY = 'pdf-knowledge-db'

// ── 中文停用字（虛詞、助詞、高頻通用字） ───────────────────────────────────
const STOP_CHARS = new Set([
  '的', '了', '是', '在', '有', '和', '與', '或', '及', '等', '其', '也', '都',
  '但', '而', '且', '因', '為', '所', '以', '如', '之', '於', '被', '將', '已',
  '並', '由', '對', '從', '到', '向', '不', '沒', '無', '未', '非', '可', '應',
  '須', '需', '得', '能', '會', '第', '項', '款', '條', '章', '節', '本', '該',
  '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '萬',
])

// ── 關鍵字萃取：從文字取出高頻代表性詞彙 ─────────────────────────────────
function extractKeywords(text: string, topN = 12): string[] {
  // 取連續中文字段（自然詞彙單位）
  const segments = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{2,12}/g) ?? []

  const freq = new Map<string, number>()
  for (const seg of segments) {
    if ([...seg].some(ch => STOP_CHARS.has(ch))) continue
    freq.set(seg, (freq.get(seg) ?? 0) + 1)
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] * b[0].length - a[1] * a[0].length) // 頻率 × 長度加權
    .slice(0, topN)
    .map(([term]) => term)
}

// ── 清理 PDF 萃取文字 ──────────────────────────────────────────────────────
// pdfjs 常見問題：每個中文字之間都有空格（如「類 組 建 築 物」）。
// 只移除 CJK 字元之間的橫向空白（空格/Tab），保留換行以維持段落結構。
function cleanText(raw: string): string {
  const CJK = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/
  let text = raw
  let prev = ''
  // 迭代替換直到穩定（「桃 園 市」需三次才能完全合併）
  while (text !== prev) {
    prev = text
    text = text.replace(
      new RegExp(`(${CJK.source})[ \\t](${CJK.source})`, 'g'),
      '$1$2'
    )
  }
  return text
    .replace(/[ \t]{2,}/g, ' ')  // 合併多餘橫向空白
    .replace(/\n{2,}/g, '\n')     // 合併多餘換行
    .trim()
}

// ── PDF 解析進度回調型別 ────────────────────────────────────────────────────
export type ParseProgressCallback = (current: number, total: number) => void

// ── 解析 PDF 檔案，回傳各頁文字 ────────────────────────────────────────────
export async function parsePdf(
  file: File,
  onProgress?: ParseProgressCallback
): Promise<PdfDocument> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages = pdf.numPages

  const entries: KnowledgeEntry[] = []
  let totalChars = 0
  let parsedPages = 0

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages)

    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    // 過濾出有文字的 item（TextItem 有 str 屬性）
    const rawText = textContent.items
      .filter((item): item is TextItem => 'str' in item)
      .map(item => item.str)
      .join(' ')

    const text = cleanText(rawText)
    if (text.length < 30) continue // 跳過幾乎空白的頁面

    // 如果單頁超過 800 字，切分為多個條目
    const chunks = splitIntoChunks(text, 700)
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunkText = chunks[ci]
      const chunkLabel = chunks.length > 1 ? ` 第${pageNum}頁 (${ci + 1}/${chunks.length})` : ` 第${pageNum}頁`
      entries.push({
        keywords: extractKeywords(chunkText),
        answer: `**【${file.name}】${chunkLabel}**\n\n${chunkText}`,
        source: `${file.name}，第 ${pageNum} 頁（PDF 上傳）`,
      })
      totalChars += chunkText.length
    }
    parsedPages++
  }

  return {
    id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    filename: file.name,
    uploadedAt: new Date().toISOString(),
    pageCount: totalPages,
    parsedPages,
    totalChars,
    entries,
  }
}

// ── 長文切分（依段落標記或固定字數）────────────────────────────────────────
function splitIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  // 優先在句末分割
  const sentenceEnds = /(?<=[。！？\n])/g
  const parts = text.split(sentenceEnds)

  let current = ''
  for (const part of parts) {
    if (current.length + part.length > maxLen && current.length > 0) {
      chunks.push(current.trim())
      current = part
    } else {
      current += part
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.length ? chunks : [text.substring(0, maxLen)]
}

// ── localStorage 持久化 ────────────────────────────────────────────────────
let _docs: PdfDocument[] = []

export function loadPdfKnowledge(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    _docs = raw ? (JSON.parse(raw) as PdfDocument[]) : []
  } catch {
    _docs = []
  }
  _syncToKnowledgeBase()
}

export function savePdfDocument(doc: PdfDocument): void {
  _docs = [..._docs.filter(d => d.id !== doc.id), doc]
  _persist()
  _syncToKnowledgeBase()
}

export function deletePdfDocument(id: string): void {
  _docs = _docs.filter(d => d.id !== id)
  _persist()
  _syncToKnowledgeBase()
}

export function getPdfDocuments(): PdfDocument[] {
  return _docs
}

function _persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_docs))
  } catch (e) {
    // localStorage 滿時提示（但不中斷程式）
    console.warn('localStorage 儲存失敗，可能已達容量上限', e)
  }
}

// 將所有 PDF 條目注入到 knowledgeBase 的搜尋引擎
function _syncToKnowledgeBase(): void {
  const allEntries = _docs.flatMap(d => d.entries)
  setPdfEntries(allEntries)
}
