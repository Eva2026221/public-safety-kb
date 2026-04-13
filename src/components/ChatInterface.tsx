import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, RefreshCw, Lightbulb } from 'lucide-react'
import type { ChatMessage } from '../types'
import { generateAIResponse } from '../data/knowledgeBase'

const QUICK_QUESTIONS = [
  '防火管理人如何遴用？',
  '消防安全設備多久申報一次？',
  '安全門被鎖上怎麼處理？',
  '自動撒水設備設置規定？',
  '公共安全申報週期為何？',
  '違規罰鍰金額是多少？',
]

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-police-600' : 'bg-slate-600'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-police-600 text-white rounded-tr-sm'
            : 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <FormattedMessage content={message.content} />
        )}
        <p
          className={`text-xs mt-1.5 ${
            isUser ? 'text-police-200' : 'text-gray-400'
          }`}
        >
          {message.timestamp.toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p key={i} className="font-semibold text-police-700">
              {line.slice(2, -2)}
            </p>
          )
        }
        if (line.includes('**')) {
          const parts = line.split(/\*\*(.*?)\*\*/g)
          return (
            <p key={i}>
              {parts.map((part, j) =>
                j % 2 === 1 ? (
                  <strong key={j} className="font-semibold text-police-700">
                    {part}
                  </strong>
                ) : (
                  part
                )
              )}
            </p>
          )
        }
        if (line.startsWith('- ')) {
          return (
            <p key={i} className="flex gap-2">
              <span className="text-police-500 flex-shrink-0">•</span>
              <span>{line.slice(2)}</span>
            </p>
          )
        }
        if (line.match(/^\d+\. /)) {
          return (
            <p key={i} className="flex gap-2">
              <span className="text-police-500 font-medium flex-shrink-0">
                {line.match(/^(\d+\.)/)?.[1]}
              </span>
              <span>{line.replace(/^\d+\. /, '')}</span>
            </p>
          )
        }
        if (line === '---') {
          return <hr key={i} className="border-gray-200 my-1" />
        }
        if (line.trim() === '') {
          return <div key={i} className="h-1" />
        }
        return <p key={i}>{line}</p>
      })}
    </div>
  )
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `您好！我是公安知識庫 AI 助理 👮

我可以協助您查詢：
- **消防法規**：設備設置、申報規定
- **建築安全**：逃生通道、公安申報
- **管理制度**：防火管理人、滅火演練
- **違規裁罰**：罰鍰標準、改善期限

請直接輸入您的問題，或點選下方快速問題開始查詢。`,
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // 模擬 AI 思考延遲
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 600))

    const response = generateAIResponse(text)
    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, aiMessage])
    setIsLoading(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome-new',
        role: 'assistant',
        content: '對話已清除。請問有什麼公安法規問題需要查詢？',
        timestamp: new Date(),
      },
    ])
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-sm font-medium text-gray-700">AI 助理在線</span>
        </div>
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          清除對話
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex gap-1 items-center h-5">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Questions */}
      <div className="px-4 py-2 bg-white border-t border-gray-100">
        <div className="flex items-center gap-1.5 mb-2">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs text-gray-500 font-medium">快速問題</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 rounded-full bg-police-50 text-police-700 border border-police-200 hover:bg-police-100 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入您的問題... (Enter 送出，Shift+Enter 換行)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-police-500 focus:border-transparent max-h-32 overflow-auto"
            style={{ minHeight: '42px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = Math.min(target.scrollHeight, 128) + 'px'
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-police-600 text-white flex items-center justify-center hover:bg-police-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
