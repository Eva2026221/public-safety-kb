/**
 * 黃金測試集 — 使用真實 Fuse.js 搜尋引擎
 * 執行：npx tsx test-search.ts
 */
import { search, classify, detectCounty, detectGroup } from './src/data/knowledgeBase'

// ─── 測試案例定義 ─────────────────────────────────────────────────────────────
interface Case {
  q: string
  label: string
  // expectId: 字串 = 必須在前3名; 陣列 = 其中一個在前3名; null = 至少1筆; 'EMPTY' = 必須0筆
  expectId: string | string[] | null | 'EMPTY'
}

const CASES: Case[] = [
  // ── 台北市 H2 ──────────────────────────────────────────────────────────────
  { q: '台北市H2分戶門缺失',            expectId: 'WKB-009',              label: '台北市 H2 分戶門缺失' },
  { q: '台北市H2安全梯格柵退件',         expectId: ['WKB-010','WKB-109'],  label: '台北市 H2 安全梯格柵' },
  { q: '台北市H2改善計畫書格式',         expectId: 'WKB-006',              label: '台北市改善計畫書格式' },
  { q: '台北市書表缺失照片圖面標示',     expectId: 'WKB-005',              label: '台北市缺失照片圖面標示' },
  { q: '台北市H2昇降機間管道間區劃缺失', expectId: 'WKB-007',             label: '台北市管道間區劃' },
  { q: '台北市H2戶外安全梯加窗圖面標示', expectId: ['WKB-010','WKB-119'],  label: '台北市戶外安全梯加窗' },

  // ── 新北市 H2 ──────────────────────────────────────────────────────────────
  { q: '新北市H2分戶防火門門弓器',       expectId: ['WKB-011','WKB-110'],  label: '新北市 H2 門弓器' },

  // ── 桃園市 ────────────────────────────────────────────────────────────────
  { q: '桃園市H2附件清單',               expectId: null,                   label: '桃園市 H2 附件清單（任何）' },
  { q: '桃園市照片要合日期嗎',           expectId: null,                   label: '桃園市照片合日期' },

  // ── 新竹市 ────────────────────────────────────────────────────────────────
  { q: '新竹市H2防火門門檻反光條',       expectId: 'WKB-008',              label: '新竹市防火門門檻反光條' },

  // ── 竹科 ──────────────────────────────────────────────────────────────────
  { q: '竹科前次缺失件二次申報照片',     expectId: ['WKB-004','BS-296'],   label: '竹科二次申報照片' },

  // ── 全國通用 ──────────────────────────────────────────────────────────────
  { q: '防空避難設備容納人數未達500申報', expectId: 'WKB-001',             label: '防空避難設備申報資格' },
  { q: 'H2直通樓梯裝修材料缺失',         expectId: 'WKB-003',              label: 'H2直通樓梯裝修材料' },
  { q: '簽證人需要到場照片嗎',           expectId: 'BS-200',               label: '簽證人到場照片' },
  { q: '申報份數欄位要填嗎',             expectId: null,                   label: '申報份數（任何）' },
  { q: '委託書要附嗎',                   expectId: null,                   label: '委託書（任何）' },

  // ── 口語化查詢 ────────────────────────────────────────────────────────────
  { q: '台北市H2分戶門要不要列缺失',     expectId: 'WKB-009',              label: '口語：分戶門要列缺失嗎' },
  { q: '安全梯有格柵要退件嗎',           expectId: ['WKB-010','WKB-109'],  label: '口語：安全梯格柵退件' },
  { q: '要附簽證人照片嗎',               expectId: 'BS-200',               label: '口語：要附簽證人照片' },
  { q: '桃園市H2書表要附什麼',           expectId: null,                   label: '口語：桃園H2書表附件' },
  { q: '改善計畫書怎麼寫',               expectId: null,                   label: '口語：改善計畫書怎麼寫' },
  { q: '退件原因有哪些',                 expectId: null,                   label: '口語：退件原因' },
  { q: '缺失照片要附什麼',               expectId: null,                   label: '口語：缺失照片' },

  // ── 無縣市查詢（應回傳全國通用或問縣市）─────────────────────────────────
  { q: 'H2分戶門門弓器',                 expectId: null,                   label: '無縣市：H2門弓器' },
  { q: '安全梯缺失認定',                 expectId: null,                   label: '無縣市：安全梯缺失' },
  { q: '書表整理注意事項',               expectId: null,                   label: '無縣市：書表整理注意' },
  { q: '申報前需要準備什麼',             expectId: null,                   label: '無縣市：申報前準備' },
  { q: '昇降設備停用申報',               expectId: null,                   label: '無縣市：昇降設備停用' },

  // ── 附件/書表相關 ─────────────────────────────────────────────────────────
  { q: '台北市需要附委託書嗎',           expectId: null,                   label: '台北市委託書' },
  { q: '彰化縣委託書日期規定',           expectId: null,                   label: '彰化縣委託書' },
  { q: '嘉義縣委託書',                   expectId: null,                   label: '嘉義縣委託書' },
  { q: '金門縣委託書面積',               expectId: null,                   label: '金門縣委託書面積' },
  { q: 'G類保單需要附嗎',                expectId: null,                   label: 'G類保單（任何）' },
  { q: '台南市G類公共意外責任險',        expectId: null,                   label: '台南市G類保單' },
  { q: '負責人身分證要附嗎',             expectId: null,                   label: '負責人身分證（任何）' },

  // ── 具體法規查詢 ──────────────────────────────────────────────────────────
  { q: '台北市H2新查核表114年',          expectId: 'WKB-006',              label: '台北市114年新查核表' },
  { q: '新北市學校委外廠商申報',         expectId: 'WKB-002',              label: '新北市學校委外申報' },
  { q: '新竹市申報份數免填',             expectId: null,                   label: '新竹市申報份數免填' },

  // ── 防火門類 ──────────────────────────────────────────────────────────────
  { q: '防火門未關閉是否一定列缺失',     expectId: 'WKB-483',              label: '防火門未關閉列缺失' },
  { q: '防火門沒有關要列缺失嗎',         expectId: 'WKB-483',              label: '口語：防火門沒關列缺失' },

  // ── 申報資格/制度 ─────────────────────────────────────────────────────────
  { q: 'H2集合住宅6樓以上是否需要公安申報',  expectId: 'WKB-484',          label: 'H2 6層以上申報資格' },
  { q: '建築物樓層應以使用執照還是現況填報', expectId: ['WKB-485','WKB-029'], label: '樓層使用執照vs現況' },
  { q: '安全梯堆放雜物是否必須列為缺失',    expectId: 'WKB-486',           label: '安全梯堆放雜物缺失' },
  { q: '桃園市是否允許外開鐵門不拆',        expectId: 'WKB-487',           label: '桃園市外開鐵門' },
  { q: '同一建築多用途應如何判定類組',       expectId: 'WKB-488',           label: '多用途類組判定' },
  { q: '公安申報逾期是否可補申報',           expectId: 'WKB-489',           label: '逾期補申報' },
  { q: '地下室是否計入申報樓層',            expectId: 'WKB-490',           label: '地下室計入樓層' },
  { q: '申報退件後應重新送件還是補件',       expectId: 'WKB-491',           label: '退件後補件' },
  { q: '未申報責任是否在管委會',            expectId: 'WKB-492',           label: '未申報責任管委會' },

  // ── 安全梯/防火門進階 ─────────────────────────────────────────────────────
  { q: '集合住宅安全梯出口設置住戶鐵門且為外開門是否符合公共安全檢查規定', expectId: 'WKB-493', label: '安全梯出口外開鐵門規定' },
  { q: '一棟集合住宅原本五樓違建加蓋至七樓是否需要辦理公共安全檢查申報',  expectId: 'WKB-494', label: '違建加蓋後申報資格' },
  { q: '安全梯間防火門長期被楔子固定為開啟狀態是否屬公共安全檢查缺失',   expectId: 'WKB-495', label: '防火門楔子固定開啟缺失' },
  { q: '管委會拒絕改善公共區域缺失檢查單位是否仍可完成申報',             expectId: 'WKB-496', label: '管委會拒絕改善仍可申報' },
  { q: '集合住宅幾樓以上需要辦理公共安全檢查申報',                       expectId: 'WKB-484', label: '幾樓以上需申報' },
  { q: '集合住宅公共安全檢查的申報頻率是否每年都要申報',                  expectId: 'WKB-497', label: '申報頻率每年' },
  { q: '公共安全檢查申報一定要合格才能送件嗎有缺失可以送件申報嗎',        expectId: 'WKB-498', label: '有缺失可送件申報' },
  { q: '住戶外開鐵門符合公寓大廈管理條例但影響逃生動線應依哪個法規',      expectId: 'WKB-499', label: '建築法vs公寓條例競合' },
  { q: '公共安全檢查應以使用執照為準還是現場實際使用狀況',               expectId: 'WKB-500', label: '使照vs現況檢查標準' },

  // ── 一定要回傳空的查詢 ────────────────────────────────────────────────────
  { q: '水族箱展覽活動',                 expectId: 'EMPTY',                label: '不相關：水族箱展覽' },
  { q: '汽車保養廠開幕',                 expectId: 'EMPTY',                label: '不相關：汽車保養廠' },
  { q: '餐廳菜單設計',                   expectId: 'EMPTY',                label: '不相關：餐廳菜單' },
  { q: '股票投資理財',                   expectId: 'EMPTY',                label: '不相關：股票投資' },
  { q: '天氣預報今天下雨嗎',             expectId: 'EMPTY',                label: '不相關：天氣預報' },
]

// ─── 執行測試 ─────────────────────────────────────────────────────────────────
let pass = 0, fail = 0
const failures: { label: string; q: string; expectId: unknown; got: ReturnType<typeof search> }[] = []

for (const tc of CASES) {
  const results = search(tc.q, { topK: 5 })

  let ok = false

  if (tc.expectId === 'EMPTY') {
    ok = results.length === 0
  } else if (tc.expectId === null) {
    ok = results.length > 0
  } else {
    const ids = Array.isArray(tc.expectId) ? tc.expectId : [tc.expectId]
    const rank = results.slice(0, 3).findIndex(e => ids.includes(e.id))
    ok = rank !== -1
    if (ok) {
      const hit = results.find(e => ids.includes(e.id))!
      const rankNum = results.findIndex(e => ids.includes(e.id)) + 1
      console.log(`✅ PASS [#${rankNum}] ${tc.label} → ${hit.id}`)
      pass++
      continue
    }
  }

  if (ok) {
    if (tc.expectId === 'EMPTY') {
      console.log(`✅ PASS [空] ${tc.label}`)
    } else {
      console.log(`✅ PASS [有] ${tc.label} → ${results[0]?.id}`)
    }
    pass++
  } else {
    const gotStr = results.slice(0, 3).map(e => `${e.id}(${e.topic.slice(0, 12)})`).join(', ') || '（無結果）'
    console.log(`❌ FAIL  ${tc.label}`)
    console.log(`         期待: ${JSON.stringify(tc.expectId)}  |  實際: ${gotStr}`)
    fail++
    failures.push({ label: tc.label, q: tc.q, expectId: tc.expectId, got: results })
  }
}

console.log(`\n${'='.repeat(50)}`)
console.log(`總計：${pass} 通過 / ${fail} 失敗 / ${CASES.length} 筆`)
console.log(`通過率：${(pass / CASES.length * 100).toFixed(1)}%`)

if (failures.length) {
  console.log('\n── 失敗詳細 ──────────────────────────────────────────')
  for (const f of failures) {
    console.log(`\n查詢：「${f.q}」`)
    console.log(`預期：${JSON.stringify(f.expectId)}`)
    if (f.got.length > 0) {
      f.got.slice(0, 4).forEach((e, i) =>
        console.log(`  ${i + 1}. ${e.id} [${e.type}] [${e.county}] ${e.topic.slice(0, 25)} | ${e.conclusion.slice(0, 35)}`)
      )
    } else {
      console.log('  （無任何結果）')
    }
  }
}
