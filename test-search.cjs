'use strict';
/**
 * 搜尋品質自動測試（v2：支援 type 欄位過濾）
 */
const fs = require('fs');
const src = fs.readFileSync('./src/data/knowledgeBaseEntries.ts', 'utf8');

// 解析 entries
const entryBlockRe = /\{[\s\S]*?id: `([^`]*)`,\s*type: '([^']*)',\s*county: `([^`]*)`,\s*group: (null|`[^`]*`),\s*stage: `([^`]*)`,\s*topic: `([^`]*)`,\s*question: `([^`]*)`,\s*conclusion: `([^`]*)`[\s\S]*?\},/g;
const entries = [];
let m;
while ((m = entryBlockRe.exec(src)) !== null) {
  entries.push({
    id: m[1], type: m[2], county: m[3],
    group: m[4] === 'null' ? null : m[4].slice(1,-1),
    stage: m[5], topic: m[6], question: m[7], conclusion: m[8],
  });
}
console.log(`載入 ${entries.length} 筆（qa: ${entries.filter(e=>e.type==='qa').length}, regulation: ${entries.filter(e=>e.type==='regulation').length}）\n`);

// 縣市偵測
const COUNTY_MAP = [
  ['台北市','台北市'],['臺北市','台北市'],['台北','台北市'],
  ['新北市','新北市'],['新北','新北市'],
  ['桃園市','桃園市'],['桃園','桃園市'],
  ['台中市','台中市'],['台中','台中市'],
  ['台南市','台南市'],['台南','台南市'],
  ['高雄市','高雄市'],['高雄','高雄市'],
  ['基隆','基隆市'],['新竹市','新竹市'],['新竹縣','新竹縣'],['新竹','新竹市'],
  ['苗栗','苗栗縣'],['彰化','彰化縣'],['南投','南投縣'],['雲林','雲林縣'],
  ['嘉義市','嘉義市'],['嘉義縣','嘉義縣'],['嘉義','嘉義市'],
  ['屏東','屏東縣'],['宜蘭','宜蘭縣'],['花蓮','花蓮縣'],
  ['台東','台東縣'],['澎湖','澎湖縣'],['金門','金門縣'],['馬祖','馬祖'],
  ['竹科','竹科'],['中科','中科'],['交通局','交通局'],
].sort((a,b) => b[0].length - a[0].length);

function detectCounty(q) {
  for (const [p,f] of COUNTY_MAP) if (q.includes(p)) return f;
  return null;
}
function detectGroup(q) {
  if (/H2|集合住宅/.test(q)) return 'H2';
  if (/U2|工業廠房/.test(q)) return 'U2';
  if (/學校/.test(q)) return '學校';
  if (/G類|餐廳/.test(q)) return 'G類';
  return null;
}

// 模擬搜尋（模擬新的 search() 邏輯：qa 優先，再 regulation）
function cjkSim(query, text) {
  const blocks = query.match(/[一-鿿]{2,}/g) || [];
  let score = 0;
  for (const b of blocks) {
    for (let len = Math.min(b.length,8); len >= 2; len--) {
      for (let i = 0; i <= b.length-len; i++) {
        const sub = b.substring(i,i+len);
        if (text.includes(sub)) { score = Math.max(score, len*len); break; }
      }
    }
  }
  return score;
}

function scoreQA(q, e) {
  return cjkSim(q, e.question) * 2.5 + cjkSim(q, e.topic) * 2.0 + cjkSim(q, e.conclusion) * 0.5;
}
function scoreReg(q, e) {
  return cjkSim(q, e.topic) * 2.0 + cjkSim(q, e.question) * 0.5;
}

function runQuery(query, overrideCounty) {
  const county = overrideCounty !== undefined ? overrideCounty : detectCounty(query);
  const group  = detectGroup(query);

  let pool = county
    ? entries.filter(e => e.county === county || e.county === '全國通用')
    : entries;
  if (group) pool = pool.filter(e => !e.group || e.group === group);

  const qaPool  = pool.filter(e => e.type === 'qa');
  const regPool = pool.filter(e => e.type === 'regulation');

  const QA_THRESH = 4; // 最低分數門檻
  const qaHits = qaPool
    .map(e => ({ e, s: scoreQA(query, e) }))
    .filter(x => x.s >= QA_THRESH)
    .sort((a,b) => b.s - a.s)
    .slice(0,5)
    .map(x => x.e);

  if (qaHits.length >= 3) return qaHits;

  const regHits = regPool
    .map(e => ({ e, s: scoreReg(query, e) }))
    .filter(x => x.s >= QA_THRESH)
    .sort((a,b) => b.s - a.s)
    .slice(0, 3 - qaHits.length)
    .map(x => x.e);

  return [...qaHits, ...regHits];
}

// ── 測試案例 ─────────────────────────────────────────────────────────────────
const TEST_CASES = [
  { q: '台北市H2分戶門缺失',           expectId: 'WKB-009', label: '台北市 H2 分戶門缺失' },
  { q: '台北市H2安全梯格柵退件',        expectId: ['WKB-010','WKB-109'], label: '台北市 H2 安全梯格柵退件' },
  { q: '桃園市H2附件清單',              expectId: null,       label: '桃園市 H2 附件清單（任何）' },
  { q: '新北市H2分戶防火門門弓器',      expectId: 'WKB-011', label: '新北市 H2 分戶門弓器' },
  { q: '台北市H2改善計畫書格式',        expectId: 'WKB-006', label: '台北市改善計畫書' },
  { q: '簽證人需要到場照片嗎',          expectId: 'BS-200',  label: '簽證人到場照片' },
  { q: '竹科前次缺失件二次申報照片',    expectId: ['WKB-004','BS-296'], label: '竹科二次申報照片' },
  { q: '防空避難設備容納人數未達500申報', expectId: 'WKB-001', label: '防空避難設備申報資格' },
  { q: '缺失認定標準安全梯',            expectId: null,       label: '安全梯缺失認定（任何）' },
  { q: '台北市書表缺失照片圖面標示',    expectId: 'WKB-005', label: '台北市缺失照片圖面' },
  { q: '新竹市H2防火門有門檻反光條',   expectId: 'WKB-008', label: '新竹市防火門門檻反光條' },
  { q: '台北市H2分戶門要不要列缺失',   expectId: 'WKB-009', label: '口語：分戶門列缺失嗎' },
  { q: '安全梯有格柵要退件嗎',          expectId: 'WKB-010', label: '口語：安全梯格柵退件' },
  { q: '要附簽證人照片嗎',              expectId: 'BS-200',  label: '口語：要附簽證人照片' },
  { q: '台北市H2缺失照片',              expectId: 'WKB-005', label: '台北市H2缺失照片' },
  // 假陽性（應回傳空）
  { q: '水族箱展覽活動',                expectId: 'EMPTY',   label: '不相關：水族箱展覽' },
  { q: '台北市停車場規費',              expectId: 'EMPTY',   label: '不相關：停車場規費' },
];

let pass = 0, fail = 0;
const failures = [];

for (const tc of TEST_CASES) {
  const results = runQuery(tc.q);

  if (tc.expectId === 'EMPTY') {
    if (results.length === 0) { console.log(`✅ PASS [空] ${tc.label}`); pass++; }
    else {
      console.log(`❌ FAIL [不應有結果] ${tc.label}`);
      console.log(`       但找到：${results.slice(0,3).map(e=>`${e.id}(${e.type})`).join(', ')}`);
      fail++; failures.push({ ...tc, got: results });
    }
  } else if (tc.expectId === null) {
    if (results.length > 0) { console.log(`✅ PASS [有] ${tc.label} → ${results[0].id}`); pass++; }
    else { console.log(`❌ FAIL [找不到] ${tc.label}`); fail++; failures.push({ ...tc, got: [] }); }
  } else {
    const ids = Array.isArray(tc.expectId) ? tc.expectId : [tc.expectId];
    const rank = results.findIndex(e => ids.includes(e.id));
    if (rank !== -1 && rank < 3) {
      console.log(`✅ PASS [#${rank+1}] ${tc.label} → ${results[rank].id}`); pass++;
    } else {
      console.log(`❌ FAIL [${ids.join('|')} 未在前3] ${tc.label}`);
      const got = results.slice(0,3).map(e=>`${e.id}(${e.topic.slice(0,15)})`).join(', ')||'（無結果）';
      console.log(`       找到：${got}`);
      fail++; failures.push({ ...tc, got: results });
    }
  }
}

console.log(`\n============================`);
console.log(`總計：${pass} 通過 / ${fail} 失敗 / ${TEST_CASES.length} 筆`);
console.log(`通過率：${Math.round(pass/TEST_CASES.length*100)}%`);

if (failures.length) {
  console.log('\n── 失敗細節 ──');
  for (const f of failures) {
    console.log(`\n查詢「${f.q}」→ 預期 ${f.expectId}`);
    f.got.slice(0,3).forEach((e,i) =>
      console.log(`  ${i+1}. ${e.id}[${e.type}] ${e.county} | ${e.topic.slice(0,30)} | ${e.conclusion.slice(0,40)}`)
    );
    if (!f.got.length) console.log('  （無結果）');
  }
}
