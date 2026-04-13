import type { Attachment } from '../types'

export const attachmentData: Attachment[] = [
  {
    id: 'att-001',
    name: '建築物使用執照影本',
    description: '建築主管機關核發之使用執照',
    required: true,
    categories: [
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
    ],
    fileTypes: ['PDF', 'JPG', 'PNG'],
    notes: '如建築物已逾25年，需附建築師出具之安全鑑定書',
  },
  {
    id: 'att-002',
    name: '消防安全設備檢修申報書',
    description: '消防設備師（士）出具之消防安全設備檢修申報書及合格證明',
    required: true,
    categories: [
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
    ],
    fileTypes: ['PDF'],
    notes: '每年定期申報，有效期限1年',
  },
  {
    id: 'att-003',
    name: '防火管理人遴用及訓練證明',
    description: '防火管理人遴用報備資料及消防機關認可之訓練機構結業證書',
    required: true,
    categories: [
      'A類-電影片映演場所',
      'B類-歌廳、舞廳、夜總會、俱樂部、酒家、酒吧',
      'C類-觀光旅館業及旅館業',
      'D類-遊藝場所、電子遊戲場',
      'F類-百貨商場、超級市場、零售市場',
      'H類-旅遊及運動休閒場所',
      'J類-三溫暖',
    ],
    fileTypes: ['PDF', 'JPG'],
    notes: '防火管理人每3年需複訓一次',
  },
  {
    id: 'att-004',
    name: '消防防護計畫書',
    description: '依消防法第13條規定制定之消防防護計畫',
    required: true,
    categories: [
      'A類-電影片映演場所',
      'B類-歌廳、舞廳、夜總會、俱樂部、酒家、酒吧',
      'C類-觀光旅館業及旅館業',
      'D類-遊藝場所、電子遊戲場',
      'F類-百貨商場、超級市場、零售市場',
      'H類-旅遊及運動休閒場所',
      'J類-三溫暖',
    ],
    fileTypes: ['PDF', 'DOC', 'DOCX'],
  },
  {
    id: 'att-005',
    name: '營業執照影本',
    description: '主管機關核發之營業登記證或許可執照',
    required: true,
    categories: [
      'A類-電影片映演場所',
      'B類-歌廳、舞廳、夜總會、俱樂部、酒家、酒吧',
      'C類-觀光旅館業及旅館業',
      'D類-遊藝場所、電子遊戲場',
      'E類-保齡球館、撞球場、溜冰場',
      'G類-餐廳、飲食店',
      'J類-三溫暖',
    ],
    fileTypes: ['PDF', 'JPG', 'PNG'],
  },
  {
    id: 'att-006',
    name: '建築物竣工圖說',
    description: '包含平面圖、立面圖、剖面圖等完整竣工圖',
    required: true,
    categories: [
      'A類-電影片映演場所',
      'B類-歌廳、舞廳、夜總會、俱樂部、酒家、酒吧',
      'C類-觀光旅館業及旅館業',
      'F類-百貨商場、超級市場、零售市場',
      'I類-總樓地板面積500平方公尺以上之室內停車場',
    ],
    fileTypes: ['PDF', 'DWG'],
    notes: '需由建築師簽證',
  },
  {
    id: 'att-007',
    name: '電氣設備檢驗合格證明',
    description: '電氣技術人員出具之電氣設備安全檢驗報告',
    required: true,
    categories: [
      'A類-電影片映演場所',
      'B類-歌廳、舞廳、夜總會、俱樂部、酒家、酒吧',
      'C類-觀光旅館業及旅館業',
      'D類-遊藝場所、電子遊戲場',
      'J類-三溫暖',
    ],
    fileTypes: ['PDF'],
    notes: '每年至少檢驗1次',
  },
  {
    id: 'att-008',
    name: '公共安全檢查簽證申報書',
    description: '建築物公共安全檢查簽證申報書（建築師或專業技師簽證）',
    required: true,
    categories: [
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
    ],
    fileTypes: ['PDF'],
    notes: '依建築法第77條每1至3年申報1次',
  },
  {
    id: 'att-009',
    name: '室內裝修合格證明',
    description: '建築物室內裝修許可或竣工查驗合格證明',
    required: false,
    categories: [
      'A類-電影片映演場所',
      'B類-歌廳、舞廳、夜總會、俱樂部、酒家、酒吧',
      'C類-觀光旅館業及旅館業',
      'J類-三溫暖',
    ],
    fileTypes: ['PDF', 'JPG'],
    notes: '如有進行室內裝修者須附',
  },
  {
    id: 'att-010',
    name: '機械遊樂設施安全檢查合格證',
    description: '目的事業主管機關核發之機械遊樂設施安全檢查合格證',
    required: true,
    categories: [
      'H類-旅遊及運動休閒場所',
    ],
    fileTypes: ['PDF', 'JPG'],
    notes: '每年定期檢查',
  },
  {
    id: 'att-011',
    name: '廚房排煙設備檢查紀錄',
    description: '廚房油煙排放設備定期清洗及檢查紀錄',
    required: true,
    categories: [
      'G類-餐廳、飲食店',
      'C類-觀光旅館業及旅館業',
    ],
    fileTypes: ['PDF', 'JPG'],
    notes: '每半年至少清洗1次',
  },
  {
    id: 'att-012',
    name: '停車場管理規則及收費標準',
    description: '室內停車場管理辦法及費率標準',
    required: true,
    categories: [
      'I類-總樓地板面積500平方公尺以上之室內停車場',
    ],
    fileTypes: ['PDF', 'DOC'],
  },
  {
    id: 'att-013',
    name: '游泳池水質檢驗報告',
    description: '水質定期檢驗合格報告',
    required: false,
    categories: [
      'C類-觀光旅館業及旅館業',
      'H類-旅遊及運動休閒場所',
    ],
    fileTypes: ['PDF'],
    notes: '設有游泳池者須附，每季至少檢驗1次',
  },
  {
    id: 'att-014',
    name: '鍋爐定期檢查合格證',
    description: '勞動部核發之鍋爐定期檢查合格證',
    required: false,
    categories: [
      'C類-觀光旅館業及旅館業',
      'J類-三溫暖',
    ],
    fileTypes: ['PDF'],
    notes: '設有鍋爐設備者須附',
  },
  {
    id: 'att-015',
    name: '食品業者登錄資料',
    description: '衛生福利部食品業者登錄資料',
    required: true,
    categories: [
      'G類-餐廳、飲食店',
    ],
    fileTypes: ['PDF', 'JPG'],
  },
]

export const getAttachmentsByFilter = (
  category?: string,
  keyword?: string
): Attachment[] => {
  return attachmentData.filter(att => {
    const matchCategory = !category || att.categories.some(c => c === category)
    const matchKeyword = !keyword ||
      att.name.includes(keyword) ||
      att.description.includes(keyword) ||
      (att.notes?.includes(keyword) ?? false)
    return matchCategory && matchKeyword
  })
}
