// 縣市類型
export type County =
  | '台北市' | '新北市' | '桃園市' | '台中市' | '台南市' | '高雄市'
  | '基隆市' | '新竹市' | '嘉義市' | '新竹縣' | '苗栗縣' | '彰化縣'
  | '南投縣' | '雲林縣' | '嘉義縣' | '屏東縣' | '宜蘭縣' | '花蓮縣'
  | '台東縣' | '澎湖縣' | '金門縣' | '連江縣'

// 場所類組
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

// 附件文件
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

// 聊天訊息
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  attachments?: string[]
}

// 現場缺失項目
export interface DeficiencyItem {
  id: string
  category: string
  item: string
  regulation: string
  severity: 'critical' | 'major' | 'minor'
  description: string
  correctionDeadline?: string
}

// 查詢附件的篩選條件
export interface AttachmentFilter {
  county?: County
  category?: VenueCategory
  searchKeyword?: string
}

// 缺失檢查結果
export interface DeficiencyCheckResult {
  totalItems: number
  criticalCount: number
  majorCount: number
  minorCount: number
  items: DeficiencyItem[]
  overallRisk: 'high' | 'medium' | 'low'
  recommendations: string[]
}

// 導航頁面
export type PageView = 'chat' | 'attachments' | 'deficiency' | 'regulations' | 'pdf-upload'

// 知識庫條目（靜態 + PDF 來源共用）
export interface KnowledgeEntry {
  keywords: string[]
  answer: string
  source?: string
}

// PDF 上傳後的文件紀錄
export interface PdfDocument {
  id: string
  filename: string
  uploadedAt: string   // ISO date string
  pageCount: number
  parsedPages: number  // 有實際文字內容的頁數
  totalChars: number
  entries: KnowledgeEntry[]
}

// 法規資料
export interface Regulation {
  id: string
  title: string
  number: string
  content: string
  category: string
  effectiveDate: string
  relatedCategories: VenueCategory[]
}
