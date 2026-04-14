/**
 * 引導式查詢介面
 * 步驟：選縣市 → 選類組 → 選情境 → 結果
 */
import { useState, useMemo } from 'react'
import {
  ChevronRight, ArrowLeft,
  AlertTriangle, Info, BookOpen, CheckCircle2,
} from 'lucide-react'
import { knowledgeBaseEntries } from '../data/knowledgeBaseEntries'
import type { KnowledgeEntry } from '../types'

// ── 縣市清單 ──────────────────────────────────────────────────────────────────
const SIX_CITIES  = ['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市']
const OTHER_COUNTIES = [
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '台東縣', '澎湖縣', '金門縣', '馬祖',
]
const SPECIAL_ZONES = ['竹科', '中科', '交通局']

// ── 類組清單 ──────────────────────────────────────────────────────────────────
const GROUP_OPTIONS = [
  { id: 'H2',  label: 'H2',  sub: '集合住宅', desc: '公寓、大廈、社區等住宅類', color: 'bg-blue-50 border-blue-300 text-blue-800' },
  { id: 'U2',  label: 'U2',  sub: '工業廠房', desc: '工業區廠辦、倉儲', color: 'bg-orange-50 border-orange-300 text-orange-800' },
  { id: '學校', label: '學',   sub: '學校',   desc: '各級學校及附屬設施', color: 'bg-green-50 border-green-300 text-green-800' },
  { id: 'G類', label: 'G',   sub: '餐廳飲食', desc: '餐廳、飲食店等', color: 'bg-pink-50 border-pink-300 text-pink-800' },
  { id: 'all', label: '全',   sub: '全部類組', desc: '不限類組顯示所有', color: 'bg-gray-50 border-gray-300 text-gray-700' },
]

// ── 情境清單 ──────────────────────────────────────────────────────────────────
const STAGE_OPTIONS = [
  { id: '書表整理',      label: '書表整理',   desc: '報告書、附件、表單整理送件', emoji: '📂' },
  { id: '現場檢查',      label: '現場檢查',   desc: '到場勘驗、缺失認定注意事項', emoji: '🔍' },
  { id: '申報',          label: '申報送件',   desc: '送件申報流程與相關規定',     emoji: '📬' },
  { id: '申報前',        label: '申報前準備', desc: '評選廠商、準備評估階段',     emoji: '📋' },
  { id: 'all',           label: '全部情境',   desc: '不限情境，顯示所有資料',     emoji: '🗂️' },
]

// 情境精確匹配表（避免「申報」誤命中「申報前／評選準備」）
const STAGE_MATCH: Record<string, string[]> = {
  '書表整理': ['書表整理', '現場檢查/書表整理'],
  '現場檢查': ['現場檢查', '現場檢查/書表整理'],
  '申報':     ['申報'],
  '申報前':   ['申報前／評選準備'],
  'all':      [],
}

// ── 條目解析 ──────────────────────────────────────────────────────────────────
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

function parseEntry(entry: KnowledgeEntry): ParsedEntry {
  const a = entry.answer
  const county     = a.match(/\*\*【([^】]+)】/)?.[1] ?? '全國通用'
  // topic：【縣市】 後面、換行或 ** 前的文字
  const topic      = a.match(/\*\*【[^】]+】\s*([^*\n]+?)(?:\*\*|\n)/)?.[1]?.trim() ?? ''
  const scenario   = (a.match(/\*\*情境：\*\*\s*(.+?)(?:\n|$)/)?.[1] ??
                      a.match(/\*\*問：\*\*\s*(.+?)(?:\n|$)/)?.[1] ?? '').trim()
  const conclusion = a.match(/\*\*判斷結論：\*\*\s*(.+?)(?:\n|$)/)?.[1]?.trim() ?? ''
  const explanation= a.match(/\*\*實務說明：\*\*\s*(.+?)(?:\n|$)/)?.[1]?.trim() ?? ''
  const deficiency = a.match(/\*\*缺失認定標準：\*\*\s*(.+?)(?:\n|$)/)?.[1]?.trim() ?? ''
  const prohibited = a.match(/\*\*禁止事項：\*\*\s*(.+?)(?:\n|$)/)?.[1]?.trim() ?? ''
  const metaLine   = a.match(/_(WKB|BS)-\S+[^\n]*/)?.[0] ?? ''
  const group      = metaLine.match(/類組：([^\s　_]+)/)?.[1] ?? null
  const stage      = metaLine.match(/階段：([^\s　_／]+(?:／[^\s　_]+)?)/)?.[1] ?? ''
  const risk       = metaLine.match(/審件風險：([^\s　_]+)/)?.[1] ?? ''
  const id         = metaLine.match(/(WKB|BS)-\d+[^\s　]*/)?.[0] ?? ''
  return { raw: entry, id, county, topic, scenario, conclusion, explanation, deficiency, prohibited, group, stage, risk }
}

const PARSED = knowledgeBaseEntries.map(parseEntry)

// ── 結論顏色 ──────────────────────────────────────────────────────────────────
function conclusionVariant(text: string): { bar: string; bg: string; text: string } {
  if (/不需要|免申報|不必|無需|不用|免提|暫不/.test(text))
    return { bar: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-900' }
  if (/不可|禁止|不得|不能/.test(text))
    return { bar: 'bg-red-500',     bg: 'bg-red-50',     text: 'text-red-900' }
  if (/待確認|待函示|尚未確認/.test(text))
    return { bar: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-900' }
  if (/需要|必須|應|需附|需列|需繳|須/.test(text))
    return { bar: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-900' }
  return   { bar: 'bg-slate-400',   bg: 'bg-slate-50',   text: 'text-slate-900' }
}

function riskStyle(risk: string) {
  if (risk === '高') return 'bg-red-100 text-red-700 border border-red-200'
  if (risk === '中') return 'bg-amber-100 text-amber-700 border border-amber-200'
  if (risk === '低') return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  return ''
}

// ── 步驟指示器 ────────────────────────────────────────────────────────────────
type Step = 0 | 1 | 2 | 3

const STEP_LABELS = ['縣市', '類組', '情境', '結果']

function StepBar({ step, county, group, stage, onGoTo }: {
  step: Step
  county: string; group: string; stage: string
  onGoTo: (s: Step) => void
}) {
  const labels = [
    county || '縣市',
    GROUP_OPTIONS.find(g => g.id === group)?.sub || '類組',
    STAGE_OPTIONS.find(s => s.id === stage)?.label || '情境',
    '結果',
  ]
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-1">
      {STEP_LABELS.map((_, i) => (
        <div key={i} className="flex items-center gap-1 min-w-0">
          <button
            disabled={i > step}
            onClick={() => i <= step ? onGoTo(i as Step) : undefined}
            className={[
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors truncate',
              i === step
                ? 'bg-police-600 text-white'
                : i < step
                ? 'bg-police-100 text-police-700 hover:bg-police-200 cursor-pointer'
                : 'bg-gray-100 text-gray-400 cursor-default',
            ].join(' ')}
          >
            <span className={[
              'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
              i === step ? 'bg-white text-police-600' : i < step ? 'bg-police-300 text-white' : 'bg-gray-300 text-gray-500',
            ].join(' ')}>
              {i < step ? '✓' : i + 1}
            </span>
            <span className="hidden sm:inline truncate max-w-[80px]">{i < step ? labels[i] : STEP_LABELS[i]}</span>
          </button>
          {i < 3 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
        </div>
      ))}
    </div>
  )
}

// ── 主元件 ────────────────────────────────────────────────────────────────────
export default function GuidedQuery() {
  const [step, setStep] = useState<Step>(0)
  const [county, setCounty] = useState('')
  const [group, setGroup]   = useState('')
  const [stage, setStage]   = useState('')

  const goTo = (s: Step) => setStep(s)

  const pick = {
    county: (c: string) => { setCounty(c); setStep(1) },
    group:  (g: string) => { setGroup(g);  setStep(2) },
    stage:  (s: string) => { setStage(s);  setStep(3) },
  }

  const results = useMemo((): ParsedEntry[] => {
    if (step < 3) return []
    return PARSED.filter(e => {
      const countyOk = county === 'all'
        ? true
        : e.county === county || e.county === '全國通用'

      const groupOk = group === 'all'
        ? true
        : e.group === group || e.group === null

      const stageOk = stage === 'all'
        ? true
        : e.stage === ''
        || (STAGE_MATCH[stage] ?? []).includes(e.stage)

      return countyOk && groupOk && stageOk
    }).sort((a, b) => {
      const r: Record<string, number> = { '高': 0, '中': 1, '低': 2, '': 3 }
      const rd = (r[a.risk] ?? 3) - (r[b.risk] ?? 3)
      if (rd !== 0) return rd
      // 同風險：有 group 標籤的排前面
      return (a.group ? 0 : 1) - (b.group ? 0 : 1)
    })
  }, [step, county, group, stage])

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <StepBar step={step} county={county} group={group} stage={stage} onGoTo={goTo} />

      <div className="flex-1 overflow-y-auto">
        {/* ── Step 0: 縣市 ── */}
        {step === 0 && (
          <div className="p-4 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-800">選擇縣市</h2>
              <p className="text-xs text-gray-500 mt-0.5">選擇場所所在縣市，以載入對應地方規定</p>
            </div>

            <button
              onClick={() => pick.county('all')}
              className="w-full py-3 rounded-xl bg-police-50 border-2 border-police-300 text-police-700 font-semibold text-sm hover:bg-police-100 active:bg-police-200 transition-colors"
            >
              🌐　不限縣市（顯示全部）
            </button>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">六都直轄市</p>
              <div className="grid grid-cols-3 gap-2">
                {SIX_CITIES.map(c => (
                  <button key={c} onClick={() => pick.county(c)}
                    className="py-3 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-police-50 hover:border-police-400 hover:text-police-700 active:bg-police-100 transition-colors shadow-sm">
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">其他縣市</p>
              <div className="grid grid-cols-4 gap-1.5">
                {OTHER_COUNTIES.map(c => (
                  <button key={c} onClick={() => pick.county(c)}
                    className="py-2 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-police-50 hover:border-police-400 hover:text-police-700 active:bg-police-100 transition-colors shadow-sm">
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">科學園區 / 特殊單位</p>
              <div className="grid grid-cols-3 gap-2">
                {SPECIAL_ZONES.map(c => (
                  <button key={c} onClick={() => pick.county(c)}
                    className="py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm font-semibold text-amber-700 hover:bg-amber-100 active:bg-amber-200 transition-colors shadow-sm">
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 1: 類組 ── */}
        {step === 1 && (
          <div className="p-4 space-y-4">
            <button onClick={() => goTo(0)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> 返回
            </button>
            <div>
              <h2 className="text-base font-bold text-gray-800">選擇類組</h2>
              <p className="text-xs text-gray-500 mt-0.5">選擇場所的建物類組</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GROUP_OPTIONS.map(g => (
                <button key={g.id} onClick={() => pick.group(g.id)}
                  className={`flex flex-col items-center p-5 rounded-2xl border-2 ${g.color} hover:opacity-90 active:opacity-75 transition-all shadow-sm`}>
                  <span className={`text-4xl font-black mb-1.5 ${g.color.split(' ')[2]}`}>{g.label}</span>
                  <span className="text-sm font-bold">{g.sub}</span>
                  <span className="text-[11px] opacity-70 mt-1 text-center leading-tight">{g.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: 情境 ── */}
        {step === 2 && (
          <div className="p-4 space-y-4">
            <button onClick={() => goTo(1)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> 返回
            </button>
            <div>
              <h2 className="text-base font-bold text-gray-800">選擇情境</h2>
              <p className="text-xs text-gray-500 mt-0.5">目前作業處於哪個階段？</p>
            </div>
            <div className="space-y-2.5">
              {STAGE_OPTIONS.map(s => (
                <button key={s.id} onClick={() => pick.stage(s.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-white border-2 border-gray-200 hover:border-police-400 hover:bg-police-50 active:bg-police-100 transition-all shadow-sm text-left">
                  <span className="text-3xl flex-shrink-0">{s.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 text-sm">{s.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: 結果 ── */}
        {step === 3 && (
          <div className="p-4 space-y-4">
            {/* 篩選條件摘要 */}
            <div className="flex items-center justify-between">
              <button onClick={() => goTo(2)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> 重新選擇
              </button>
              <span className="text-xs text-gray-400">共 {results.length} 筆</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <FilterTag icon="📍"
                label={county === 'all' ? '全部縣市' : county} />
              <FilterTag icon="🏢"
                label={GROUP_OPTIONS.find(g => g.id === group)?.sub ?? group} />
              <FilterTag icon="📋"
                label={STAGE_OPTIONS.find(s => s.id === stage)?.label ?? stage} />
            </div>

            {results.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <div className="text-5xl mb-4">🔍</div>
                <p className="font-medium text-gray-500">找不到符合條件的資料</p>
                <p className="text-sm mt-1">請返回調整篩選條件</p>
                <button onClick={() => goTo(0)}
                  className="mt-4 px-4 py-2 rounded-lg bg-police-600 text-white text-sm hover:bg-police-700 transition-colors">
                  重新查詢
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((e, i) => <ResultCard key={e.id || i} entry={e} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 篩選標籤 ──────────────────────────────────────────────────────────────────
function FilterTag({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-police-100 text-police-700 text-xs font-medium">
      <span>{icon}</span>{label}
    </span>
  )
}

// ── 結果卡片 ──────────────────────────────────────────────────────────────────
function ResultCard({ entry }: { entry: ParsedEntry }) {
  const { topic, scenario, conclusion, explanation, deficiency, prohibited, risk, id } = entry
  const cv = conclusionVariant(conclusion)
  const hasNotes = deficiency || prohibited

  return (
    <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* 卡頭：ID + 主題 + 風險 */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          {id && (
            <span className="font-mono text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 flex-shrink-0">
              {id}
            </span>
          )}
          {topic && (
            <span className="text-xs font-semibold text-gray-600 truncate">{topic}</span>
          )}
        </div>
        {risk && (
          <span className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${riskStyle(risk)}`}>
            風險 {risk}
          </span>
        )}
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        {/* 情境問題 */}
        {scenario && (
          <p className="text-xs text-gray-500 leading-relaxed">{scenario}</p>
        )}

        {/* 結論 — 最醒目 */}
        {conclusion && (
          <div className={`rounded-xl overflow-hidden border border-opacity-30 ${cv.bg}`}>
            <div className={`h-1 ${cv.bar}`} />
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${cv.text} opacity-70`} />
                <span className={`text-[11px] font-bold uppercase tracking-widest ${cv.text} opacity-60`}>結論</span>
              </div>
              <p className={`text-lg font-black leading-snug ${cv.text}`}>{conclusion}</p>
            </div>
          </div>
        )}

        {/* 原因說明 */}
        {explanation && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-500">原因說明</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed pl-5">{explanation}</p>
          </div>
        )}

        {/* 注意事項 */}
        {hasNotes && (
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

        {/* 法規依據 */}
        {entry.raw.source && (
          <div className="flex items-start gap-1.5 pt-1 border-t border-gray-100">
            <BookOpen className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-400 leading-relaxed">{entry.raw.source}</p>
          </div>
        )}
      </div>
    </article>
  )
}
