import { useState, useEffect } from 'react'
import Header from './components/Header'
import ChatInterface from './components/ChatInterface'
import AttachmentQuery from './components/AttachmentQuery'
import DeficiencyChecker from './components/DeficiencyChecker'
import RegulationsView from './components/RegulationsView'
import PdfUploader from './components/PdfUploader'
import { loadPdfKnowledge } from './data/pdfKnowledge'
import type { PageView } from './types'

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageView>('chat')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // 啟動時從 localStorage 載入 PDF 知識庫，注入搜尋引擎
  useEffect(() => {
    loadPdfKnowledge()
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return <ChatInterface />
      case 'attachments':
        return <AttachmentQuery />
      case 'deficiency':
        return <DeficiencyChecker />
      case 'regulations':
        return <RegulationsView />
      case 'pdf-upload':
        return <PdfUploader />
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <Header
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuToggle={() => setMobileMenuOpen((v) => !v)}
      />
      <main className="flex-1 overflow-hidden">
        <div className="h-full max-w-3xl mx-auto">{renderPage()}</div>
      </main>
    </div>
  )
}
