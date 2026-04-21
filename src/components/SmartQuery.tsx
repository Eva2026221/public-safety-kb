import { useState, useRef, useEffect } from 'react'
import { Search, ArrowLeft, ChevronDown, ChevronUp, CheckCircle2, XCircle, Info } from 'lucide-react'
import { classify, search } from '../data/knowledgeBase'
import type { Entry, SearchPhase } from '../types'

// ── 快捷查詢 ──────────────────────────────────────────────────────────────────
const QUICK_QUERIES = [
  '台北市 H2 分戶門缺失',
  '桃園市 H2 附件清單',
  '安全梯格柵退件',
  '簽證人需要到場照片嗎',
  '缺失認定標準',
  '改善計畫書格式',
]

// ── 結論類型圖示 ─────────────────────────────────────────────────────────────
function ConclusionIcon({ type }: { type: Entry['conclusionType'] }) {
  if (type === 'yes') return <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
  if (type === 'no')  return <XCircle      className="w-6 h-6 text-red-600   shrink-0" />
  return                     <Info         className="w-6 h-6 text-blue-600  shrink-0" />
}

function riskColor(risk: string) {
  if (risk === '高') return 'bg-red-100 text-red-700'
  if (risk === '中') return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

// ── 答案卡片 ─────────────────────────────────────────────────────────────────
function AnswerCard({ entry }: { entry: Entry }) {
  const [expanded, setExpanded] = useState(false)

  const hasDetail = entry.detail || entry.deficiency || entry.prohibited

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* 結論區 */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <ConclusionIcon type={entry.conclusionType} />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-gray-900 leading-snug">
              {entry.conclusion || '（資料待補）'}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {entry.county !== '全國通用' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {entry.county}
                </span>
              )}
              {entry.group && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  {entry.group}
                </span>
              )}
              {entry.stage && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                  {entry.stage}
                </span>
              )}
              {entry.risk && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${riskColor(entry.risk)}`}>
                  審件風險：{entry.risk}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 法規依據 */}
        {entry.source && (
          <p className="mt-3 text-xs text-gray-500 border-t pt-3">
            📋 依據：{entry.source}
          </p>
        )}
        {entry.notes && (
          <p className="mt-1 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
            ⚠️ {entry.notes}
          </p>
        )}
      </div>

      {/* 展開詳細 */}
      {hasDetail && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm text-gray-600 border-t transition-colors"
          >
            <span>{expanded ? '收起詳細' : '展開詳細說明'}</span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expanded && (
            <div className="px-5 pb-5 pt-4 space-y-4 text-sm text-gray-700 border-t bg-white">
              {entry.detail && (
                <div>
                  <p className="font-semibold text-gray-800 mb-1">實務說明</p>
                  <p className="whitespace-pre-wrap">{entry.detail}</p>
                </div>
              )}
              {entry.deficiency && (
                <div>
                  <p className="font-semibold text-gray-800 mb-1">缺失認定標準</p>
                  <p className="whitespace-pre-wrap">{entry.deficiency}</p>
                </div>
              )}
              {entry.prohibited && (
                <div>
                  <p className="font-semibold text-red-700 mb-1">禁止事項</p>
                  <p className="whitespace-pre-wrap text-red-800">{entry.prohibited}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── 找不到畫面 ───────────────────────────────────────────────────────────────
function NotFoundView({ query, onReset }: { query: string; onReset: () => void }) {
  return (
    <div className="text-center py-10 px-4">
      <p className="text-2xl mb-2">🔍</p>
      <p className="font-semibold text-gray-700 mb-1">找不到「{query}」的相關資料</p>
      <p className="text-sm text-gray-500 mb-6">建議換個關鍵字試試</p>

      <div className="text-left max-w-sm mx-auto mb-4 bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-700 mb-2">換字建議：</p>
        <p>• 加上縣市（台北市、桃園市…）</p>
        <p>• 加上類組（H2、U2、G類…）</p>
        <p>• 加上情境（書表整理、現場檢查…）</p>
        <p>• 使用正式名稱（防火門、安全梯間…）</p>
      </div>

      <div className="text-left max-w-sm mx-auto mb-6 bg-blue-50 rounded-lg p-4 text-sm text-blue-800 space-y-1">
        <p className="font-medium mb-2">或直接聯絡主管機關：</p>
        <p>• 建管機關（各縣市建管處）</p>
        <p>• 消防機關（各縣市消防局）</p>
      </div>

      <button
        onClick={onReset}
        className="text-sm text-blue-600 hover:text-blue-800 underline"
      >
        重新搜尋
      </button>
    </div>
  )
}

// ── 相關條目 ─────────────────────────────────────────────────────────────────
function RelatedEntries({ entry, onSelect }: { entry: Entry; onSelect: (e: Entry) => void }) {
  const related = search(entry.topic, {
    county: entry.county !== '全國通用' ? entry.county : null,
    topK: 4,
  }).filter(e => e.id !== entry.id)

  if (related.length === 0) return null

  return (
    <div className="mt-2">
      <p className="text-xs text-gray-500 mb-2">相關條目</p>
      <div className="space-y-2">
        {related.map(e => (
          <button
            key={e.id}
            onClick={() => onSelect(e)}
            className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm transition-colors"
          >
            <span className="font-medium text-gray-800">{e.topic}</span>
            <span className="text-gray-500 ml-2 text-xs">{e.county}</span>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{e.conclusion}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 主元件 ───────────────────────────────────────────────────────────────────
export default function SmartQuery() {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<SearchPhase>({ kind: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function runSearch(q: string, county?: string | null) {
    if (!q.trim()) return
    const result = classify(q, county)
    setPhase(result)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    runSearch(query)
  }

  function handleQuick(q: string) {
    setQuery(q)
    runSearch(q)
  }

  function handleCountySelect(county: string) {
    runSearch(query, county)
  }

  function handleTopicSelect(topic: string) {
    if (phase.kind !== 'ambiguous') return
    const match = phase.candidates.find(e => e.topic === topic)
    if (match) setPhase({ kind: 'answer', entry: match })
  }

  function handleReset() {
    setQuery('')
    setPhase({ kind: 'idle' })
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 搜尋列 */}
      <div className="bg-white border-b px-4 py-3 shadow-sm">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="輸入問題，例如：台北市H2分戶門要列缺失嗎？"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            搜尋
          </button>
        </form>
      </div>

      {/* 內容區 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* 初始頁 */}
          {phase.kind === 'idle' && (
            <>
              <p className="text-sm text-gray-500 text-center pt-2 pb-1">常見問題快速查詢</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_QUERIES.map(q => (
                  <button
                    key={q}
                    onClick={() => handleQuick(q)}
                    className="text-left text-sm px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-gray-700 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 澄清問題 */}
          {phase.kind === 'ambiguous' && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <p className="font-semibold text-gray-800 mb-1">
                {phase.question.type === 'county' ? '您的場所在哪個縣市？' : '請選擇您要查詢的項目'}
              </p>
              <p className="text-xs text-gray-500 mb-4">找到多筆相關資料，請選擇以縮小範圍</p>
              <div className="flex flex-wrap gap-2">
                {phase.question.options.map(opt => (
                  <button
                    key={opt}
                    onClick={() =>
                      phase.question.type === 'county'
                        ? handleCountySelect(opt)
                        : handleTopicSelect(opt)
                    }
                    className="px-3 py-1.5 rounded-full border border-blue-300 bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 transition-colors"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 答案 */}
          {phase.kind === 'answer' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">查詢結果</p>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-3 h-3" />
                  重新查詢
                </button>
              </div>
              <AnswerCard entry={phase.entry} />
              <RelatedEntries entry={phase.entry} onSelect={e => setPhase({ kind: 'answer', entry: e })} />
            </>
          )}

          {/* 找不到 */}
          {phase.kind === 'not_found' && (
            <NotFoundView query={phase.query} onReset={handleReset} />
          )}

        </div>
      </div>
    </div>
  )
}
