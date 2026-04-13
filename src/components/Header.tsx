import { Shield, Menu, X } from 'lucide-react'
import type { PageView } from '../types'

interface HeaderProps {
  currentPage: PageView
  onPageChange: (page: PageView) => void
  mobileMenuOpen: boolean
  onMobileMenuToggle: () => void
}

const navItems: { id: PageView; label: string }[] = [
  { id: 'chat', label: '智慧問答' },
  { id: 'attachments', label: '附件查詢' },
  { id: 'deficiency', label: '缺失判斷' },
  { id: 'regulations', label: '法規查閱' },
  { id: 'pdf-upload', label: 'PDF 匯入' },
]

export default function Header({
  currentPage,
  onPageChange,
  mobileMenuOpen,
  onMobileMenuToggle,
}: HeaderProps) {
  return (
    <header className="bg-police-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-police-600 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">公安知識庫</h1>
              <p className="text-xs text-police-300 leading-tight">AI Agent 查詢系統</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === item.id
                    ? 'bg-police-600 text-white'
                    : 'text-police-200 hover:bg-police-800 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg text-police-200 hover:bg-police-800"
            onClick={onMobileMenuToggle}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-3 border-t border-police-700 mt-2 pt-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onPageChange(item.id)
                  onMobileMenuToggle()
                }}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
                  currentPage === item.id
                    ? 'bg-police-600 text-white'
                    : 'text-police-200 hover:bg-police-800 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
