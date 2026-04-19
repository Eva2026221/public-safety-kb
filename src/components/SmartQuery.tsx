/**
 * SmartQuery — 雙入口智慧問答介面
 *
 * 入口 A：直接打字 → 自動識別縣市/類組/情境 → 顯示結果
 * 入口 B：點「不知道怎麼問」→ 三步驟引導選單 → 顯示結果
 *
 * 結果卡片統一格式：結論（最大）→ 原因 → 注意事項 → 法規依據
 */
import { useState, useRef, useEffect } from 'react'
import {
  Search, HelpCircle, ArrowLeft, ChevronRight,
  AlertTriangle, Info, BookOpen, CheckCircle2, X,
} from 'lucide-react'
import { knowledgeBaseEntries } from '../data/knowledgeBaseEntries'
import { searchKnowledge } from '../data/knowledgeBase'
import type { KnowledgeEntry } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// 資料定義
// ─────────────────────────────────────────────────────────────────────────────

const SIX_CITIES    = ['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市']
const OTHER_COUNTIES = [
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '台東縣', '澎湖縣', '金門縣', '馬祖',
]
const SPECIAL_ZONES = ['竹科', '中科', '交通局']

const GROUP_OPTIONS = [
  { id: 'H2',  sub: 'H2 集合住宅', color: 'bg-blue-50   border-blue-300   text-blue-800'   },
  { id: 'U2',  sub: 'U2 工業廠房', color: 'bg-orange-50 border-orange-300 text-orange-800' },
  { id: '學校', sub: '學校',        color: 'bg-green-50  border-green-300  text-green-800'  },
  { id: 'G類', sub: 'G類 餐廳飲食', color: 'bg-pink-50   border-pink-300   text-pink-800'   },
  { id: 'all', sub: '全部類組',     color: 'bg-gray-50   border-gray-300   text-gray-700'   },
]

const STAGE_OPTIONS = [
  { id: '書表整理', label: '書表整理',   desc: '報告書、附件、表單整理',   emoji: '📂' },
  { id: '現場檢查', label: '現場檢查',   desc: '到場勘驗、缺失認定',       emoji: '🔍' },
  { id: '申報',     label: '申報送件',   desc: '送件申報流程與相關規定',   emoji: '📬' },
  { id: '申報前',   label: '申報前準備', desc: '評選廠商、準備評估階段',   emoji: '📋' },
  { id: 'all',      label: '全部情境',   desc: '不限情境，顯示所有資料',   emoji: '🗂️' },
]

const STAGE_MATCH: Record<string, string[]> = {
  '書表整理': ['書表整理', '現場檢查/書表整理'],
  '現場檢查': ['現場檢查', '現場檢查/書表整理'],
  '申報':     ['申報'],
  '申報前':   ['申報前／評選準備'],
  'all':      [],
}

const QUICK_QUERIES = [
  '台北市H2分戶門缺失',
  '照片要合日期嗎',
  '桃園市H2附件清單',
  '安全梯格柵退件',
  '缺失認定標準',
  '書表整理照片規定',
]

// ─────────────────────────────────────────────────────────────────────────────
// 條目解析
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedEntry {
  raw: KnowledgeEntry
  id: string
  county: string
  topic: string
  scenario: string
  conclusion: string
  explanation: string
  deficiency: string
  prohibited: string
  group: string | null
  stage: string
  risk: string
}

function parseEntry(e: KnowledgeEntry): ParsedEntry {
  const a = e.answer
  const county      = a.match(/\*\*【([^】]+)】/)?.[1] ?? '全國通用'
  const topic       = a.match(/\*\*【[^】]+】\s*([^*\n]+?)(?:\*\*|\n)/)?.[1]?.trim() ?? ''
  const scenario    = (a.match(/\*\*情境：\*\*\s*(.+?)(?:\n|$)/)?.[1]
                    ?? a.match(/\*\*問：\*\*\s*(.+?)(?:\n|$)/)?.[1] ?? '').trim()
  const conclusion  = a.match(/\*\*判斷結論：\*\*\s*(.+?)(?:\n|$)/)?.[1]?.trim() ?? ''
  const explanation = a.match(/\*\*實務說明：\*\*\s*(.+?)(?:\n|$)/)?.[1]?.trim() ?? ''
  const deficiency  = a.match(/\*\*缺失認定標準：\*\*\s*(.+?)(?:\n|$)/)?.[1]?.trim() ?? ''
  const prohibited  = a.match(/\*\*禁止事項：\*\*\s*(.+?)(?:\n|$)/)?.[1]?.trim() ?? ''
  const meta        = a.match(/_(WKB|BS)-\S+[^\n]*/)?.[0] ?? ''
  const group       = meta.match(/類組：([^\s　_]+)/)?.[1] ?? null
  const stage       = meta.match(/階段：([^\s　_\/]+(?:\/[^\s　_]+)?)/)?.[1] ?? ''
  const risk        = meta.match(/審件風險：([^\s　_]+)/)?.[1] ?? ''
  const id          = meta.match(/(WKB|BS)-[\w-]+/)?.[0] ?? ''
  return { raw: e, id, county, topic, scenario, conclusion, explanation, deficiency, prohibited, group, stage, risk }
}

// 全量預解析，避免每次查詢重複解析
const ALL_PARSED = knowledgeBaseEntries.map(parseEntry)

// ─────────────────────────────────────────────────────────────────────────────
// 搜尋邏輯
// ─────────────────────────────────────────────────────────────────────────────

/** Entry A：文字查詢 — 使用評分引擎，只取分數最高的 1 筆 */
function searchByText(query: string): ParsedEntry | null {
  const rawResults = searchKnowledge(query, 1)
  const found = rawResults[0]
  if (!found) return null
  return ALL_PARSED.find(p => p.raw === found) ?? null
}

/** Entry B：引導篩選 — 縣市/類組/情境三層過濾，按風險排序 */
function filterBySelection(county: string, group: string, stage: string): ParsedEntry[] {
  return ALL_PARSED.filter(e => {
    const countyOk = county === 'all'
      ? true : e.county === county || e.county === '全國通用'
    const groupOk = group === 'all'
      ? true : e.group === group || e.group === null
    const stageOk = stage === 'all'
      ? true : e.stage === '' || (STAGE_MATCH[stage] ?? []).includes(e.stage)
    return countyOk && groupOk && stageOk
  }).sort((a, b) => {
    const r: Record<string, number> = { '高': 0, '中': 1, '低': 2, '': 3 }
    const diff = (r[a.risk] ?? 3) - (r[b.risk] ?? 3)
    return diff !== 0 ? diff : (a.group ? 0 : 1) - (b.group ? 0 : 1)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 自動識別（Entry A 標籤）
// ─────────────────────────────────────────────────────────────────────────────

const COUNTY_PAIRS: [string, string][] = [
  ['台北','台北市'], ['臺北','台北市'], ['新北','新北市'], ['桃園','桃園市'],
  ['台中','台中市'], ['臺中','台中市'], ['台南','台南市'], ['臺南','台南市'],
  ['高雄','高雄市'], ['基隆','基隆市'], ['新竹市','新竹市'], ['新竹縣','新竹縣'],
  ['新竹','新竹市'], ['苗栗','苗栗縣'], ['彰化','彰化縣'], ['南投','南投縣'],
  ['雲林','雲林縣'], ['嘉義市','嘉義市'], ['嘉義縣','嘉義縣'], ['嘉義','嘉義市'],
  ['屏東','屏東縣'], ['宜蘭','宜蘭縣'], ['花蓮','花蓮縣'],
  ['台東','台東縣'], ['臺東','台東縣'], ['澎湖','澎湖縣'], ['金門','金門縣'],
  ['馬祖','馬祖'], ['竹科','竹科'], ['中科','中科'], ['交通局','交通局'],
]

function detectCounty(q: string): string | null {
  const sorted = [...COUNTY_PAIRS].sort((a, b) => b[0].length - a[0].length)
  for (const [prefix, name] of sorted) if (q.includes(prefix)) return name
  return null
}

function detectGroup(q: string): string | null {
  if (/h2|集合住宅|公寓|大廈|社區/.test(q)) return 'H2'
  if (/u2|工業|廠房|廠辦/.test(q)) return 'U2'
  if (/學校|禮堂|球場|游泳池/.test(q)) return '學校'
  if (/g類|餐廳|飲食店/.test(q)) return 'G類'
  return null
}

function detectStage(q: string): string | null {
  if (/現場|勘驗|缺失|門弓|防火門|安全梯|格柵/.test(q)) return '現場檢查'
  if (/書表|照片|附件|要附|附什麼|附哪些|合日期|條碼|簽證人/.test(q)) return '書表整理'
  if (/申報前|評選|準備/.test(q)) return '申報前'
  if (/申報|送件|申請/.test(q)) return '申報'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// 結論視覺
// ─────────────────────────────────────────────────────────────────────────────

function conclusionTheme(text: string) {
  if (/不需要|免申報|不必|無需|不用|免提|暫不/.test(text))
    return { accent: 'bg-emerald-500', card: 'bg-emerald-50  border-emerald-200', text: 'text-emerald-900', label: 'text-emerald-600' }
  if (/不可|禁止|不得|不能/.test(text))
    return { accent: 'bg-red-500',     card: 'bg-red-50     border-red-200',     text: 'text-red-900',     label: 'text-red-600'     }
  if (/待確認|待函示|尚未/.test(text))
    return { accent: 'bg-amber-400',   card: 'bg-amber-50   border-amber-200',   text: 'text-amber-900',   label: 'text-amber-600'   }
  if (/需要|必須|應|需附|需列|需繳|須/.test(text))
    return { accent: 'bg-blue-500',    card: 'bg-blue-50    border-blue-200',    text: 'text-blue-900',    label: 'text-blue-600'    }
  return   { accent: 'bg-slate-400',   card: 'bg-slate-50   border-slate-200',   text: 'text-slate-900',   label: 'text-slate-600'   }
}

function riskCls(risk: string) {
  if (risk === '高') return 'bg-red-100    text-red-700    border border-red-200'
  if (risk === '中') return 'bg-amber-100  text-amber-700  border border-amber-200'
  if (risk === '低') return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  return ''
}

// ─────────────────────────────────────────────────────────────────────────────
// 結果卡片
// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({ entry }: { entry: ParsedEntry }) {
  const { topic, scenario, conclusion, explanation, deficiency, prohibited, risk, id } = entry
  const t = conclusionTheme(conclusion)

  return (
    <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* 卡頭 */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          {id && (
            <span className="font-mono text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-400 flex-shrink-0">
              {id}
            </span>
          )}
          {topic && <span className="text-xs font-semibold text-gray-600 truncate">{topic}</span>}
        </div>
        {risk && (
          <span className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${riskCls(risk)}`}>
            退件風險 {risk}
          </span>
        )}
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        {/* 情境 */}
        {scenario && (
          <p className="text-xs text-gray-500 leading-relaxed">{scenario}</p>
        )}

        {/* ── 結論 — 最大最醒目 ── */}
        {conclusion && (
          <div className={`rounded-xl border ${t.card} overflow-hidden`}>
            <div className={`h-1.5 ${t.accent}`} />
            <div className="px-4 py-3">
              <div className={`flex items-center gap-1.5 mb-2`}>
                <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${t.label}`} />
                <span className={`text-[11px] font-bold uppercase tracking-widest ${t.label}`}>結論</span>
              </div>
              <p className={`text-xl font-black leading-snug ${t.text}`}>{conclusion}</p>
            </div>
          </div>
        )}

        {/* ── 原因 ── */}
        {explanation && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-500">原因</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed pl-5">{explanation}</p>
          </div>
        )}

        {/* ── 注意事項 ── */}
        {(deficiency || prohibited) && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-500">注意事項</span>
            </div>
            <div className="pl-5 space-y-2">
              {deficiency && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <p className="text-[11px] font-bold text-amber-700 mb-0.5">缺失認定</p>
                  <p className="text-xs text-amber-800 leading-relaxed">{deficiency}</p>
                </div>
              )}
              {prohibited && (
                <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <p className="text-[11px] font-bold text-red-700 mb-0.5">禁止事項</p>
                  <p className="text-xs text-red-800 leading-relaxed">{prohibited}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 法規依據 ── */}
        {entry.raw.source && (
          <div className="flex items-start gap-1.5 pt-2 border-t border-gray-100">
            <BookOpen className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-400 leading-relaxed">{entry.raw.source}</p>
          </div>
        )}
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 結果頁面
// ─────────────────────────────────────────────────────────────────────────────

interface ResultsViewProps {
  entries: ParsedEntry[]
  tags: { label: string; icon: string }[]
  mode: 'text' | 'guided'
  onBack: () => void
  onGuided: () => void
  onNewSearch: (q: string) => void
}

function ResultsView({ entries, tags, mode, onBack, onGuided, onNewSearch }: ResultsViewProps) {
  const [q, setQ] = useState('')

  const submit = () => {
    if (q.trim()) { onNewSearch(q.trim()); setQ('') }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 頂部列 */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            返回
          </button>
          {/* 引導模式才顯示筆數 */}
          {mode === 'guided' && (
            <span className="text-xs text-gray-400">共 {entries.length} 筆</span>
          )}
        </div>
        {/* 識別標籤 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, i) => (
              <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-police-100 text-police-700 text-xs font-medium">
                <span>{t.icon}</span>{t.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 結果區 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {entries.length === 0 ? (
          /* ── 找不到 ── */
          mode === 'text' ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Search className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-base font-bold text-gray-700">找不到相關資料</p>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                請換個方式描述問題，<br />例如加上縣市名稱或更具體的情境
              </p>
              <button onClick={onGuided}
                className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-police-600 text-white text-sm font-semibold hover:bg-police-700 transition-colors">
                <HelpCircle className="w-4 h-4" />
                改用引導查詢
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <p className="font-semibold text-gray-500">找不到符合條件的資料</p>
              <p className="text-sm text-gray-400 mt-1">請返回調整篩選條件</p>
            </div>
          )
        ) : (
          entries.map((e, i) => <ResultCard key={e.id || i} entry={e} />)
        )}
      </div>

      {/* 底部輸入列 */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex gap-2 items-center">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="繼續輸入問題…"
            className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-police-500 focus:border-transparent"
          />
          <button onClick={submit} disabled={!q.trim()}
            className="w-9 h-9 rounded-xl bg-police-600 text-white flex items-center justify-center hover:bg-police-700 transition-colors disabled:opacity-40">
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 引導選單（Entry B）
// ─────────────────────────────────────────────────────────────────────────────

interface GuidedViewProps {
  onResult: (county: string, group: string, stage: string) => void
  onCancel: () => void
}

function GuidedView({ onResult, onCancel }: GuidedViewProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [county, setCounty] = useState('')
  const [group, setGroup]   = useState('')

  const pick = {
    county: (c: string) => { setCounty(c); setStep(1) },
    group:  (g: string) => { setGroup(g);  setStep(2) },
    stage:  (s: string) => onResult(county, group, s),
  }

  const STEP_LABELS = ['縣市', '類組', '情境']

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 引導頁頂部 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">引導查詢</span>
          <button onClick={onCancel}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* 步驟指示 */}
        <div className="flex items-center gap-1">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <button
                disabled={i >= step}
                onClick={() => i < step ? setStep(i as 0 | 1 | 2) : undefined}
                className={[
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  i === step   ? 'bg-police-600 text-white'
                  : i < step  ? 'bg-police-100 text-police-700 cursor-pointer hover:bg-police-200'
                              : 'bg-gray-100 text-gray-400',
                ].join(' ')}>
                <span className={[
                  'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold',
                  i === step ? 'bg-white text-police-600' : i < step ? 'bg-police-300 text-white' : 'bg-gray-300 text-gray-500',
                ].join(' ')}>
                  {i < step ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < 2 && <ChevronRight className="w-3 h-3 text-gray-300" />}
            </div>
          ))}
        </div>
      </div>

      {/* 步驟內容 */}
      <div className="flex-1 overflow-y-auto">
        {/* Step 0 — 縣市 */}
        {step === 0 && (
          <div className="p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500">選擇場所所在縣市</p>
            <button onClick={() => pick.county('all')}
              className="w-full py-3 rounded-xl bg-police-50 border-2 border-police-300 text-police-700 font-semibold text-sm hover:bg-police-100 transition-colors">
              🌐　不限縣市（顯示全部）
            </button>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">六都直轄市</p>
              <div className="grid grid-cols-3 gap-2">
                {SIX_CITIES.map(c => (
                  <button key={c} onClick={() => pick.county(c)}
                    className="py-3 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-police-50 hover:border-police-400 hover:text-police-700 transition-colors shadow-sm">
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">其他縣市</p>
              <div className="grid grid-cols-4 gap-1.5">
                {OTHER_COUNTIES.map(c => (
                  <button key={c} onClick={() => pick.county(c)}
                    className="py-2 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-police-50 hover:border-police-400 hover:text-police-700 transition-colors shadow-sm">
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">科學園區 / 特殊單位</p>
              <div className="grid grid-cols-3 gap-2">
                {SPECIAL_ZONES.map(c => (
                  <button key={c} onClick={() => pick.county(c)}
                    className="py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors shadow-sm">
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1 — 類組 */}
        {step === 1 && (
          <div className="p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500">選擇場所建物類組</p>
            <div className="grid grid-cols-2 gap-3">
              {GROUP_OPTIONS.map(g => (
                <button key={g.id} onClick={() => pick.group(g.id)}
                  className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 ${g.color} hover:opacity-90 active:opacity-75 transition-all shadow-sm`}>
                  <span className="text-lg font-black">{g.id === 'all' ? '全部' : g.id}</span>
                  <span className="text-xs font-semibold mt-1 text-center leading-tight">{g.sub.replace(/^[A-Z0-9類]+ /, '')}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — 情境 */}
        {step === 2 && (
          <div className="p-4 space-y-2.5">
            <p className="text-xs font-semibold text-gray-500">目前作業處於哪個階段？</p>
            {STAGE_OPTIONS.map(s => (
              <button key={s.id} onClick={() => pick.stage(s.id)}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-white border-2 border-gray-200 hover:border-police-400 hover:bg-police-50 transition-all shadow-sm text-left">
                <span className="text-2xl flex-shrink-0">{s.emoji}</span>
                <div className="min-w-0">
                  <div className="font-semibold text-gray-800 text-sm">{s.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 首頁
// ─────────────────────────────────────────────────────────────────────────────

interface HomeViewProps {
  onSearch: (q: string) => void
  onGuided: () => void
}

function HomeView({ onSearch, onGuided }: HomeViewProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textareaRef.current?.focus() }, [])

  const submit = () => {
    if (input.trim()) { onSearch(input.trim()); setInput('') }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {/* 標題 */}
        <div className="text-center pt-2">
          <p className="text-2xl font-black text-police-700">公安知識庫</p>
          <p className="text-sm text-gray-400 mt-1">輸入問題，直接取得結論</p>
        </div>

        {/* 搜尋框 */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm focus-within:border-police-400 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            placeholder={'例如：台北市H2分戶門沒有門弓器要列缺失嗎？\n      桃園市申報需要附哪些文件？'}
            rows={3}
            className="w-full px-4 pt-4 pb-2 text-sm text-gray-800 bg-transparent resize-none focus:outline-none leading-relaxed placeholder-gray-400"
          />
          <div className="flex items-center justify-end px-3 pb-3">
            <button
              onClick={submit}
              disabled={!input.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-police-600 text-white text-sm font-semibold hover:bg-police-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Search className="w-3.5 h-3.5" />
              查詢
            </button>
          </div>
        </div>

        {/* 引導入口 */}
        <button
          onClick={onGuided}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white border-2 border-dashed border-police-200 text-police-700 hover:bg-police-50 hover:border-police-400 transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-police-100 flex items-center justify-center group-hover:bg-police-200 transition-colors">
              <HelpCircle className="w-4.5 h-4.5 text-police-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">不知道怎麼問？</p>
              <p className="text-xs text-police-500 mt-0.5">引導選擇縣市 → 類組 → 情境</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-police-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* 常見查詢 */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">常見查詢</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUERIES.map(q => (
              <button key={q} onClick={() => onSearch(q)}
                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium hover:bg-police-100 hover:text-police-700 transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────────────────────────────────────

type View = 'home' | 'results' | 'guided'

interface ResultState {
  entries: ParsedEntry[]
  tags: { label: string; icon: string }[]
  mode: 'text' | 'guided'
}

export default function SmartQuery() {
  const [view, setView]         = useState<View>('home')
  const [results, setResults]   = useState<ResultState | null>(null)

  // ── Entry A：文字查詢 — 只取分數最高 1 筆 ──
  const handleTextSearch = (query: string) => {
    const entry = searchByText(query)
    const entries = entry ? [entry] : []
    const tags: { label: string; icon: string }[] = []

    const q = query.toLowerCase()
    const county = detectCounty(q)
    const group  = detectGroup(q)
    const stage  = detectStage(q)

    if (county) tags.push({ icon: '📍', label: county })
    if (group)  tags.push({ icon: '🏢', label: group  })
    if (stage)  tags.push({ icon: '📋', label: STAGE_OPTIONS.find(s => s.id === stage)?.label ?? stage })

    setResults({ entries, tags, mode: 'text' })
    setView('results')
  }

  // ── Entry B：引導查詢完成 ──
  const handleGuidedResult = (county: string, group: string, stage: string) => {
    const entries = filterBySelection(county, group, stage)
    const tags: { label: string; icon: string }[] = [
      { icon: '📍', label: county === 'all' ? '全部縣市' : county },
      { icon: '🏢', label: GROUP_OPTIONS.find(g => g.id === group)?.sub.replace(/^[A-Z0-9類]+ /, '') ?? group },
      { icon: '📋', label: STAGE_OPTIONS.find(s => s.id === stage)?.label ?? stage },
    ]
    setResults({ entries, tags, mode: 'guided' })
    setView('results')
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {view === 'home' && (
        <HomeView
          onSearch={handleTextSearch}
          onGuided={() => setView('guided')}
        />
      )}
      {view === 'results' && results && (
        <ResultsView
          entries={results.entries}
          tags={results.tags}
          mode={results.mode}
          onBack={() => setView('home')}
          onGuided={() => setView('guided')}
          onNewSearch={handleTextSearch}
        />
      )}
      {view === 'guided' && (
        <GuidedView
          onResult={handleGuidedResult}
          onCancel={() => setView('home')}
        />
      )}
    </div>
  )
}
