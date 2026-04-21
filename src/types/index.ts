// ─── 知識庫條目（新結構） ────────────────────────────────────────────────────
export interface Entry {
  id: string              // "WKB-009" | "BS-200"
  county: string          // "台北市" | "全國通用" | "新北市" ...
  group: string | null    // "H2" | "U2" | "學校" | "G類" | null（null = 全類組適用）
  stage: string           // "現場檢查" | "書表整理" | "申報" | "申報前" | ""
  topic: string           // "分戶門門弓器"（一句話主題）
  question: string        // "台北市H2分戶門無門弓器，使照後需列缺失嗎？"
  conclusion: string      // "需要列缺失"（結論一句話）
  conclusionType: 'yes' | 'no' | 'info'
  detail: string          // 實務說明
  deficiency: string      // 缺失認定標準
  prohibited: string      // 禁止事項
  risk: '高' | '中' | '低' | ''
  source: string          // 來源
  notes: string           // 備註
}

// ─── 搜尋結果分類 ────────────────────────────────────────────────────────────
export type SearchPhase =
  | { kind: 'answer';     entry: Entry }
  | { kind: 'ambiguous';  question: AmbigQuestion; candidates: Entry[] }
  | { kind: 'not_found';  query: string }
  | { kind: 'idle' }

export interface AmbigQuestion {
  type: 'county' | 'topic'
  options: string[]
}

// ─── 導航頁面 ────────────────────────────────────────────────────────────────
export type PageView = 'chat' | 'attachments' | 'deficiency' | 'regulations' | 'pdf-upload'

// ─── 舊型別（保留，供 PdfUploader / pdfKnowledge 使用） ──────────────────────
export interface KnowledgeEntry {
  keywords: string[]
  answer: string
  source?: string
}

export interface PdfDocument {
  id: string
  filename: string
  uploadedAt: string
  pageCount: number
  parsedPages: number
  totalChars: number
  entries: KnowledgeEntry[]
}

// ─── 聊天訊息 ────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  attachments?: string[]
}

// ─── 以下保留供其他頁面使用 ──────────────────────────────────────────────────
export type County =
  | '台北市' | '新北市' | '桃園市' | '台中市' | '台南市' | '高雄市'
  | '基隆市' | '新竹市' | '嘉義市' | '新竹縣' | '苗栗縣' | '彰化縣'
  | '南投縣' | '雲林縣' | '嘉義縣' | '屏東縣' | '宜蘭縣' | '花蓮縣'
  | '台東縣' | '澎湖縣' | '金門縣' | '連江縣'

export type VenueCategory =
  | 'A類-電影片映演場所'
  | 'B類-歌廳、舞廳、夜總會、俱樂部、酒家、酒吧'
  | 'C類-觀光旅館業及旅館業'
  | 'D類-遊藝場所、電子遊戲場'
  | 'E類-保齡球館、撞球場、溜冰場'
  | 'F類-百貨商場、超級市場、零售市場'
  | 'G類-餐廳、飲食店'
  | 'H類-旅遊及運動休閒場所'
  | 'I類-總樓地板面積500平方公尺以上之室內停車場'
  | 'J類-三溫暖'

export interface Attachment {
  id: string
  name: string
  description: string
  required: boolean
  counties?: County[]
  categories: VenueCategory[]
  fileTypes: string[]
  notes?: string
}

export interface AttachmentFilter {
  county?: County
  category?: VenueCategory
  searchKeyword?: string
}

export interface DeficiencyItem {
  id: string
  category: string
  item: string
  regulation: string
  severity: 'critical' | 'major' | 'minor'
  description: string
  correctionDeadline?: string
}

export interface DeficiencyCheckResult {
  totalItems: number
  criticalCount: number
  majorCount: number
  minorCount: number
  items: DeficiencyItem[]
  overallRisk: 'high' | 'medium' | 'low'
  recommendations: string[]
}

export interface Regulation {
  id: string
  title: string
  number: string
  content: string
  category: string
  effectiveDate: string
  relatedCategories: VenueCategory[]
}
