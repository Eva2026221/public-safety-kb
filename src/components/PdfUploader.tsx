import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Upload, FileText, Trash2, CheckCircle, AlertCircle,
  Loader2, BookOpen, ChevronDown, ChevronRight, Tag,
} from 'lucide-react'
import {
  parsePdf,
  savePdfDocument,
  deletePdfDocument,
  getPdfDocuments,
} from '../data/pdfKnowledge'
import { searchKnowledge } from '../data/knowledgeBase'
import type { PdfDocument } from '../types'

type UploadStatus = 'idle' | 'parsing' | 'done' | 'error'

interface ParseProgress {
  current: number
  total: number
}

export default function PdfUploader() {
  const [docs, setDocs] = useState<PdfDocument[]>(() => getPdfDocuments())
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState<ParseProgress>({ current: 0, total: 0 })
  const [errorMsg, setErrorMsg] = useState('')
  const [lastAdded, setLastAdded] = useState<PdfDocument | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 拖曳事件處理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, []) // eslint-disable-line

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // 清空 input 以便同一檔案可重複上傳
    e.target.value = ''
  }

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setStatus('error')
      setErrorMsg('僅支援 PDF 格式的檔案')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setStatus('error')
      setErrorMsg('檔案大小不可超過 50 MB')
      return
    }

    setStatus('parsing')
    setErrorMsg('')
    setLastAdded(null)
    setProgress({ current: 0, total: 0 })

    try {
      const doc = await parsePdf(file, (current, total) => {
        setProgress({ current, total })
      })

      if (doc.parsedPages === 0) {
        setStatus('error')
        setErrorMsg('此 PDF 無法萃取文字內容（可能為掃描圖片型 PDF，請先進行 OCR 處理）')
        return
      }

      savePdfDocument(doc)
      setDocs(getPdfDocuments())
      setLastAdded(doc)
      setStatus('done')
    } catch (err) {
      console.error(err)
      setStatus('error')
      setErrorMsg('PDF 解析失敗，請確認檔案未加密或損毀')
    }
  }

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      deletePdfDocument(id)
      setDocs(getPdfDocuments())
      setDeleteConfirm(null)
      if (lastAdded?.id === id) setLastAdded(null)
    } else {
      setDeleteConfirm(id)
    }
  }

  // 點擊其他地方取消刪除確認
  useEffect(() => {
    if (!deleteConfirm) return
    const handler = () => setDeleteConfirm(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [deleteConfirm])

  const progressPct =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
        {/* ── 頁首說明 ── */}
        <div className="flex items-start gap-3">
          <div className="bg-police-600 p-2 rounded-lg flex-shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">PDF 知識庫匯入</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              上傳公文、函釋或法規 PDF，系統自動解析並加入智慧問答知識庫
            </p>
          </div>
        </div>

        {/* ── 上傳區 ── */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => status !== 'parsing' && fileInputRef.current?.click()}
          className={[
            'relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer select-none',
            isDragOver
              ? 'border-police-500 bg-police-50'
              : 'border-gray-300 bg-white hover:border-police-400 hover:bg-police-50',
            status === 'parsing' ? 'cursor-not-allowed opacity-80' : '',
          ].join(' ')}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={status === 'parsing'}
          />

          {status === 'idle' || status === 'done' || status === 'error' ? (
            <>
              <Upload
                className={`w-10 h-10 mx-auto mb-3 ${
                  isDragOver ? 'text-police-500' : 'text-gray-400'
                }`}
              />
              <p className="text-sm font-medium text-gray-700">
                拖放 PDF 到此，或
                <span className="text-police-600 font-semibold"> 點擊選取檔案</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">支援 PDF 格式，最大 50 MB</p>
            </>
          ) : (
            /* 解析中 */
            <div className="py-2">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-police-500 animate-spin" />
              <p className="text-sm font-medium text-gray-700">
                正在解析第 {progress.current} / {progress.total} 頁…
              </p>
              <div className="mt-3 mx-auto max-w-xs bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-police-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">{progressPct}%</p>
            </div>
          )}
        </div>

        {/* ── 狀態提示 ── */}
        {status === 'done' && lastAdded && (
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800 w-full">
              <p className="font-semibold">解析完成！</p>
              <p className="text-green-700 mt-0.5">
                已從 <span className="font-medium">{lastAdded.filename}</span> 萃取{' '}
                <span className="font-medium">{lastAdded.parsedPages}</span> 頁、共{' '}
                <span className="font-medium">{lastAdded.totalChars.toLocaleString()}</span>{' '}
                個字元，建立{' '}
                <span className="font-medium">{lastAdded.entries.length}</span>{' '}
                個知識條目，現可在「智慧問答」中查詢此 PDF 內容。
              </p>
              {lastAdded.entries[0]?.keywords.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-green-600 font-medium mb-1">第一頁萃取關鍵字：</p>
                  <div className="flex flex-wrap gap-1">
                    {lastAdded.entries[0].keywords.slice(0, 8).map(kw => (
                      <span key={kw} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-semibold">上傳失敗</p>
              <p className="text-red-700 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* ── 已上傳 PDF 列表 ── */}
        {docs.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">
              已匯入的 PDF（{docs.length} 份）
            </h3>
            <div className="space-y-2">
              {[...docs].reverse().map(doc => (
                <PdfDocCard
                  key={doc.id}
                  doc={doc}
                  confirmingDelete={deleteConfirm === doc.id}
                  onDelete={(e) => {
                    e.stopPropagation()
                    handleDelete(doc.id)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {docs.length === 0 && status === 'idle' && (
          <div className="text-center py-6 text-gray-400 text-sm">
            尚無已匯入的 PDF，上傳後即可在智慧問答中查詢內容
          </div>
        )}

        {/* ── 索引測試工具 ── */}
        {docs.length > 0 && <IndexTester />}
      </div>
    </div>
  )
}

// ── 單筆 PDF 文件卡片（含關鍵字展開） ────────────────────────────────────
interface PdfDocCardProps {
  doc: PdfDocument
  confirmingDelete: boolean
  onDelete: (e: React.MouseEvent) => void
}

function PdfDocCard({ doc, confirmingDelete, onDelete }: PdfDocCardProps) {
  const [expanded, setExpanded] = useState(false)
  const uploadDate = new Date(doc.uploadedAt).toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  // 彙整所有頁面的關鍵字（去重，最多顯示 20 個）
  const allKeywords = [...new Set(doc.entries.flatMap(e => e.keywords))].slice(0, 20)
  // 診斷：若關鍵字全為空，代表文字解析有問題
  const hasNoKeywords = allKeywords.length === 0
  const hasSpacedText = doc.entries.some(e =>
    /[\u4e00-\u9fff] [\u4e00-\u9fff]/.test(e.answer)
  )

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* 主列 */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="bg-red-100 p-2 rounded-lg flex-shrink-0">
          <FileText className="w-4 h-4 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate" title={doc.filename}>
            {doc.filename}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {uploadDate}・{doc.parsedPages} 頁・{doc.entries.length} 條知識
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
          className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="查看索引詳情"
        >
          {expanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />}
        </button>
        <button
          onClick={onDelete}
          title={confirmingDelete ? '再次點擊確認刪除' : '刪除此 PDF'}
          className={[
            'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            confirmingDelete
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50',
          ].join(' ')}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {confirmingDelete ? '確認刪除' : '刪除'}
        </button>
      </div>

      {/* 展開區：索引詳情 */}
      {expanded && (
        <div className="px-4 pb-3 pt-0 border-t border-gray-100 bg-gray-50">
          {/* 診斷警告 */}
          {(hasNoKeywords || hasSpacedText) && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 mt-3">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <p className="font-semibold">此 PDF 可能是在舊版本下上傳的</p>
                <p className="mt-0.5">
                  {hasSpacedText
                    ? '偵測到中文字之間含有空格（pdfjs 解析問題），導致關鍵字萃取不完整，建議重新上傳此 PDF 以套用修正。'
                    : '關鍵字為空，建議刪除後重新上傳以重新建立索引。'}
                </p>
              </div>
            </div>
          )}

          {/* 關鍵字列表 */}
          <div className="mt-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Tag className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">
                索引關鍵字（{allKeywords.length} 個）
              </span>
            </div>
            {allKeywords.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {allKeywords.map(kw => (
                  <span key={kw} className="text-xs bg-police-50 text-police-700 border border-police-200 px-2 py-0.5 rounded-full">
                    {kw}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">無關鍵字（請重新上傳）</p>
            )}
          </div>

          {/* 文字預覽 */}
          {doc.entries[0] && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 mb-1">第一頁內容預覽：</p>
              <p className="text-xs text-gray-500 bg-white rounded border border-gray-200 p-2 max-h-20 overflow-y-auto whitespace-pre-line leading-relaxed">
                {doc.entries[0].answer.replace(/\*\*.*?\*\*/g, '').trim().slice(0, 250)}
                {doc.entries[0].answer.length > 250 ? '…' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 索引測試工具 ──────────────────────────────────────────────────────────
function IndexTester() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ReturnType<typeof searchKnowledge>>([])
  const [tested, setTested] = useState(false)

  const runTest = () => {
    if (!query.trim()) return
    setResults(searchKnowledge(query))
    setTested(true)
  }

  // 篩選出 PDF 來源的結果
  const pdfResults = results.filter(r => r.source?.includes('PDF 上傳'))
  const otherResults = results.filter(r => !r.source?.includes('PDF 上傳'))

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">索引查詢測試</p>
        <p className="text-xs text-gray-400 mt-0.5">輸入問題，驗證 PDF 內容是否可被查詢到</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runTest()}
            placeholder="例：桃園H2申報需要附哪些文件"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-police-500"
          />
          <button
            onClick={runTest}
            disabled={!query.trim()}
            className="px-4 py-2 bg-police-600 text-white text-sm rounded-lg hover:bg-police-700 disabled:opacity-50 transition-colors"
          >
            測試
          </button>
        </div>

        {tested && (
          <div>
            {results.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>未找到任何結果，請確認 PDF 已正確上傳（若是舊版上傳，請重新上傳）</span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  找到 {results.length} 個結果
                  {pdfResults.length > 0 && <span className="text-police-600 font-medium">，其中 {pdfResults.length} 個來自 PDF</span>}
                </p>
                {pdfResults.map((r, i) => (
                  <div key={i} className="text-xs bg-police-50 border border-police-200 rounded-lg p-2.5">
                    <p className="font-medium text-police-700 truncate">{r.source}</p>
                    <p className="text-gray-600 mt-1 line-clamp-2">
                      {r.answer.replace(/\*\*.*?\*\*\n\n/g, '').slice(0, 120)}…
                    </p>
                  </div>
                ))}
                {otherResults.length > 0 && (
                  <p className="text-xs text-gray-400">另有 {otherResults.length} 個來自靜態知識庫</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
