import { useState, useMemo } from 'react'
import { Search, FileText, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import type { VenueCategory } from '../types'
import { attachmentData } from '../data/attachments'

const CATEGORIES: VenueCategory[] = [
  'A類-電影片映演場所',
  'B類-歌廳、舞廳、夜總會、俱樂部、酒家、酒吧',
  'C類-觀光旅館業及旅館業',
  'D類-遊藝場所、電子遊戲場',
  'E類-保齡球館、撞球場、溜冰場',
  'F類-百貨商場、超級市場、零售市場',
  'G類-餐廳、飲食店',
  'H類-旅遊及運動休閒場所',
  'I類-總樓地板面積500平方公尺以上之室內停車場',
  'J類-三溫暖',
]

const CATEGORY_COLORS: Record<string, string> = {
  'A類': 'bg-red-100 text-red-700 border-red-200',
  'B類': 'bg-orange-100 text-orange-700 border-orange-200',
  'C類': 'bg-amber-100 text-amber-700 border-amber-200',
  'D類': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'E類': 'bg-lime-100 text-lime-700 border-lime-200',
  'F類': 'bg-green-100 text-green-700 border-green-200',
  'G類': 'bg-teal-100 text-teal-700 border-teal-200',
  'H類': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'I類': 'bg-blue-100 text-blue-700 border-blue-200',
  'J類': 'bg-purple-100 text-purple-700 border-purple-200',
}

function getCategoryColor(category: string): string {
  const prefix = category.substring(0, 2)
  return CATEGORY_COLORS[prefix] || 'bg-gray-100 text-gray-700 border-gray-200'
}

interface AttachmentCardProps {
  attachment: {
    id: string
    name: string
    description: string
    required: boolean
    categories: VenueCategory[]
    fileTypes: string[]
    notes?: string
  }
}

function AttachmentCard({ attachment }: AttachmentCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`mt-0.5 flex-shrink-0 ${attachment.required ? 'text-red-500' : 'text-gray-400'}`}>
          {attachment.required ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <CheckCircle className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-gray-800 text-sm">{attachment.name}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                attachment.required
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200'
              }`}
            >
              {attachment.required ? '必備' : '視情況'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{attachment.description}</p>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {attachment.fileTypes.map((ft) => (
              <span key={ft} className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono">
                .{ft.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 text-gray-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">適用場所類組</p>
            <div className="flex flex-wrap gap-1">
              {attachment.categories.map((cat) => (
                <span
                  key={cat}
                  className={`text-xs px-2 py-0.5 rounded border ${getCategoryColor(cat)}`}
                >
                  {cat.substring(0, 2)}
                </span>
              ))}
            </div>
          </div>
          {attachment.notes && (
            <div className="flex gap-2 bg-amber-50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{attachment.notes}</p>
            </div>
          )}
          <p className="text-xs text-gray-600 leading-relaxed">{attachment.description}</p>
        </div>
      )}
    </div>
  )
}

export default function AttachmentQuery() {
  const [selectedCategory, setSelectedCategory] = useState<VenueCategory | ''>('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [showRequired, setShowRequired] = useState<'all' | 'required' | 'optional'>('all')

  const filteredAttachments = useMemo(() => {
    return attachmentData.filter((att) => {
      const matchCategory =
        !selectedCategory || att.categories.includes(selectedCategory as VenueCategory)
      const matchKeyword =
        !searchKeyword ||
        att.name.includes(searchKeyword) ||
        att.description.includes(searchKeyword) ||
        (att.notes?.includes(searchKeyword) ?? false)
      const matchRequired =
        showRequired === 'all' ||
        (showRequired === 'required' && att.required) ||
        (showRequired === 'optional' && !att.required)
      return matchCategory && matchKeyword && matchRequired
    })
  }, [selectedCategory, searchKeyword, showRequired])

  const requiredCount = filteredAttachments.filter((a) => a.required).length
  const optionalCount = filteredAttachments.filter((a) => !a.required).length

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Filter Panel */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4 text-police-600" />
          <h2 className="font-semibold text-gray-800">附件清單查詢</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋附件名稱或說明..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-police-500 focus:border-transparent"
          />
        </div>

        {/* Category Select */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">場所類組</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as VenueCategory | '')}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-police-500 bg-white"
          >
            <option value="">全部類組</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { id: 'all', label: `全部 (${filteredAttachments.length})` },
            { id: 'required', label: `必備 (${requiredCount})` },
            { id: 'optional', label: `選繳 (${optionalCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setShowRequired(tab.id as 'all' | 'required' | 'optional')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showRequired === tab.id
                  ? 'bg-police-600 text-white border-police-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredAttachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">查無符合條件的附件</p>
            <p className="text-gray-400 text-xs mt-1">請調整篩選條件後再試</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              共 <span className="font-semibold text-police-600">{filteredAttachments.length}</span> 項附件
              {selectedCategory && (
                <span className="ml-1">
                  — 適用於 <span className="font-medium text-gray-700">{selectedCategory.substring(0, 2)}</span>
                </span>
              )}
            </p>
            <div className="space-y-2">
              {filteredAttachments.map((att) => (
                <AttachmentCard key={att.id} attachment={att} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white border-t border-gray-100 px-4 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          <span className="text-xs text-gray-500">必備文件</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">視情況提供</span>
        </div>
      </div>
    </div>
  )
}
