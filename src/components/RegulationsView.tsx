import { useState } from 'react'
import { BookOpen, Search, ChevronDown, ChevronUp, Calendar, Tag } from 'lucide-react'
import { regulations } from '../data/regulations'

const CATEGORY_COLORS: Record<string, string> = {
  '消防法規': 'bg-red-50 text-red-700 border-red-200',
  '建築法規': 'bg-blue-50 text-blue-700 border-blue-200',
}

function RegulationCard({ reg }: { reg: (typeof regulations)[0] }) {
  const [expanded, setExpanded] = useState(false)
  const colorClass = CATEGORY_COLORS[reg.category] || 'bg-gray-50 text-gray-700 border-gray-200'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colorClass}`}>
                {reg.category}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {reg.effectiveDate}
              </span>
            </div>
            <h3 className="font-semibold text-gray-800 text-sm">{reg.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{reg.number}</p>
          </div>
          <div className="flex-shrink-0 text-gray-400">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-2">
          {reg.relatedCategories.slice(0, 3).map((cat) => (
            <span key={cat} className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" />
              {cat.substring(0, 2)}
            </span>
          ))}
          {reg.relatedCategories.length > 3 && (
            <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
              +{reg.relatedCategories.length - 3}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-500 mb-1.5">適用場所類組</p>
            <div className="flex flex-wrap gap-1">
              {reg.relatedCategories.map((cat) => (
                <span key={cat} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                  {cat}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">條文內容</p>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-line font-mono">
              {reg.content}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RegulationsView() {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('全部')

  const filtered = regulations.filter((reg) => {
    const matchKeyword =
      !searchKeyword ||
      reg.title.includes(searchKeyword) ||
      reg.content.includes(searchKeyword) ||
      reg.number.includes(searchKeyword)
    const matchCategory = selectedCategory === '全部' || reg.category === selectedCategory
    return matchKeyword && matchCategory
  })

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-police-600" />
          <h2 className="font-semibold text-gray-800">法規查閱</h2>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋法規名稱或條文..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-police-500"
          />
        </div>

        <div className="flex gap-2">
          {['全部', '消防法規', '建築法規'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                selectedCategory === cat
                  ? 'bg-police-600 text-white border-police-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">查無符合條件的法規</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              共 <span className="font-semibold text-police-600">{filtered.length}</span> 筆法規資料
            </p>
            <div className="space-y-2">
              {filtered.map((reg) => (
                <RegulationCard key={reg.id} reg={reg} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
