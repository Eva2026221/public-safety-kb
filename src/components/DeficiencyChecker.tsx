import { useState } from 'react'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckSquare,
  Square,
  BarChart3,
  FileSearch,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from 'lucide-react'
import { deficiencyItems, deficiencyCategories } from '../data/deficiencies'
import type { DeficiencyItem } from '../types'

const SEVERITY_CONFIG = {
  critical: {
    label: '嚴重缺失',
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeColor: 'bg-red-100 text-red-700',
    icon: AlertTriangle,
  },
  major: {
    label: '重要缺失',
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    badgeColor: 'bg-orange-100 text-orange-700',
    icon: AlertCircle,
  },
  minor: {
    label: '一般缺失',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    badgeColor: 'bg-yellow-100 text-yellow-700',
    icon: Info,
  },
}

interface ChecklistItemProps {
  item: DeficiencyItem
  checked: boolean
  onToggle: () => void
}

function ChecklistItem({ item, checked, onToggle }: ChecklistItemProps) {
  const [expanded, setExpanded] = useState(false)
  const config = SEVERITY_CONFIG[item.severity]
  const Icon = config.icon

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all ${
        checked ? 'border-gray-200 bg-gray-50 opacity-60' : `${config.borderColor} ${config.bgColor}`
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        <button
          onClick={onToggle}
          className="flex-shrink-0 mt-0.5 text-police-600 hover:text-police-800 transition-colors"
        >
          {checked ? (
            <CheckSquare className="w-5 h-5" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badgeColor}`}>
              {config.label}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
              {item.category}
            </span>
          </div>
          <p className={`text-sm font-medium mt-1 ${checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {item.item}
          </p>
          {!checked && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
          )}
        </div>
        {!checked && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {expanded && !checked && (
        <div className="px-4 pb-3 space-y-2 border-t border-gray-200 pt-2">
          <div>
            <p className="text-xs font-medium text-gray-500">詳細說明</p>
            <p className="text-xs text-gray-700 mt-0.5">{item.description}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">法令依據</p>
            <p className="text-xs text-gray-700 mt-0.5">{item.regulation}</p>
          </div>
          {item.correctionDeadline && (
            <div className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-2 border border-gray-200">
              <Icon className={`w-3.5 h-3.5 ${config.textColor} flex-shrink-0`} />
              <p className="text-xs">
                <span className="font-medium text-gray-700">改善期限：</span>
                <span className={config.textColor}>{item.correctionDeadline}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DeficiencyChecker() {
  const [selectedCategory, setSelectedCategory] = useState<string>('全部')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [showSummary, setShowSummary] = useState(false)

  const filteredItems = deficiencyItems.filter(
    (item) => selectedCategory === '全部' || item.category === selectedCategory
  )

  const uncheckedItems = filteredItems.filter((item) => !checkedItems.has(item.id))
  const criticalCount = uncheckedItems.filter((i) => i.severity === 'critical').length
  const majorCount = uncheckedItems.filter((i) => i.severity === 'major').length
  const minorCount = uncheckedItems.filter((i) => i.severity === 'minor').length
  const checkedCount = filteredItems.filter((i) => checkedItems.has(i.id)).length

  const overallRisk =
    criticalCount > 0 ? 'high' : majorCount > 0 ? 'medium' : minorCount > 0 ? 'low' : 'none'

  const RISK_CONFIG = {
    high: { label: '高風險', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    medium: { label: '中風險', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    low: { label: '低風險', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    none: { label: '無缺失', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  }

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const resetAll = () => setCheckedItems(new Set())

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header Panel */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-police-600" />
            <h2 className="font-semibold text-gray-800">現場缺失判斷</h2>
          </div>
          <button
            onClick={resetAll}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            重設全部
          </button>
        </div>

        {/* Risk Summary */}
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 cursor-pointer transition-colors ${RISK_CONFIG[overallRisk].bg} ${RISK_CONFIG[overallRisk].border}`}
          onClick={() => setShowSummary(!showSummary)}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className={`w-4 h-4 ${RISK_CONFIG[overallRisk].color}`} />
            <span className={`text-sm font-semibold ${RISK_CONFIG[overallRisk].color}`}>
              整體評估：{RISK_CONFIG[overallRisk].label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {criticalCount > 0 && (
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                嚴重 {criticalCount}
              </span>
            )}
            {majorCount > 0 && (
              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                重要 {majorCount}
              </span>
            )}
            {minorCount > 0 && (
              <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                一般 {minorCount}
              </span>
            )}
            {showSummary ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            )}
          </div>
        </div>

        {showSummary && (
          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2 text-xs text-gray-600">
            <p className="font-medium text-gray-700">改善優先順序建議：</p>
            {criticalCount > 0 && (
              <p className="flex gap-2">
                <span className="text-red-500 flex-shrink-0">①</span>
                立即改善 {criticalCount} 項嚴重缺失（有立即危險）
              </p>
            )}
            {majorCount > 0 && (
              <p className="flex gap-2">
                <span className="text-orange-500 flex-shrink-0">②</span>
                1個月內改善 {majorCount} 項重要缺失
              </p>
            )}
            {minorCount > 0 && (
              <p className="flex gap-2">
                <span className="text-yellow-500 flex-shrink-0">③</span>
                3個月內改善 {minorCount} 項一般缺失
              </p>
            )}
            {checkedCount > 0 && (
              <p className="flex gap-2 text-green-600">
                <span className="flex-shrink-0">✓</span>
                已標記改善 {checkedCount} 項
              </p>
            )}
          </div>
        )}

        {/* Category Filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {['全部', ...deficiencyCategories].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
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

      {/* Checklist */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileSearch className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">無缺失項目</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              共 <span className="font-semibold text-police-600">{filteredItems.length}</span> 項檢查項目
              <span className="ml-1 text-gray-400">（勾選代表已改善或已確認符合規定）</span>
            </p>
            <div className="space-y-2">
              {/* Critical items first */}
              {uncheckedItems
                .filter((i) => i.severity === 'critical')
                .map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    checked={false}
                    onToggle={() => toggleItem(item.id)}
                  />
                ))}
              {uncheckedItems
                .filter((i) => i.severity === 'major')
                .map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    checked={false}
                    onToggle={() => toggleItem(item.id)}
                  />
                ))}
              {uncheckedItems
                .filter((i) => i.severity === 'minor')
                .map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    checked={false}
                    onToggle={() => toggleItem(item.id)}
                  />
                ))}
              {/* Checked items */}
              {filteredItems
                .filter((i) => checkedItems.has(i.id))
                .map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    checked={true}
                    onToggle={() => toggleItem(item.id)}
                  />
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
