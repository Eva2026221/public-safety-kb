'use strict';
/**
 * 遷移腳本：把舊格式 knowledgeBaseEntries.ts 解析成新結構化格式
 * 執行：node migrate.cjs
 */
const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, 'src/data/knowledgeBaseEntries.ts');
const outFile = path.join(__dirname, 'src/data/knowledgeBaseEntries.new.ts');

const content = fs.readFileSync(srcFile, 'utf8');

// ── 從原始 TS 文字抽取所有 entry 物件 ────────────────────────────────────────
// 策略：找每一個 { keywords: [...], answer: "...", source: "..." } 區塊
// answer 和 source 都是雙引號 JSON 字串（可能含 \n \t 等轉義）

const entries = [];
const entryRe = /\{\s*keywords:\s*(\[[^\]]*\])\s*,\s*answer:\s*("(?:[^"\\]|\\.)*")\s*,\s*source:\s*("(?:[^"\\]|\\.)*")\s*,?\s*\}/gs;
let m;
while ((m = entryRe.exec(content)) !== null) {
  try {
    const keywords = JSON.parse(m[1].replace(/'/g, '"'));
    const answer   = JSON.parse(m[2]);
    const source   = JSON.parse(m[3]);
    entries.push({ keywords, answer, source });
  } catch (e) {
    console.warn('Parse error, skipping entry:', m[1].slice(0, 40), e.message);
  }
}

console.log(`Found ${entries.length} entries`);

// ── 解析 answer markdown → 結構化欄位 ────────────────────────────────────────

function extractField(text, label) {
  // label 例如「判斷結論」「實務說明」等
  const re = new RegExp(`\\*\\*${label}[：:】]\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*|\\n_|$)`);
  const match = text.match(re);
  return match ? match[1].trim() : '';
}

function parseAnswer(answer, source) {
  // ── 縣市 ──
  const countyM = answer.match(/\*\*【([^】]+)】/);
  const county = countyM ? countyM[1] : '全國通用';

  // ── 主題（位於【縣市】後、**之前） ──
  const topicM = answer.match(/\*\*【[^】]+】([^*\n]+)\*\*/);
  const topic = topicM ? topicM[1].trim() : '';

  // ── 問題 ──
  const questionM = answer.match(/\*\*問[：:]?\*\*\s*([^\n]+)/);
  const question = questionM ? questionM[1].trim() : '';

  // ── 結論（可能多行，直到下一個 ** 或 _ 為止） ──
  const conclusionM = answer.match(/\*\*判斷結論[：:]?\*\*\s*([\s\S]*?)(?=\n\*\*|\n_)/);
  const conclusion = conclusionM ? conclusionM[1].trim() : '';

  // ── 實務說明 ──
  const detailM = answer.match(/\*\*實務說明[：:]?\*\*\s*([\s\S]*?)(?=\n\*\*|\n_)/);
  const detail = detailM ? detailM[1].trim() : '';

  // ── 缺失認定標準 ──
  const deficiencyM = answer.match(/\*\*缺失認定標準[：:]?\*\*\s*([\s\S]*?)(?=\n\*\*|\n_)/);
  const deficiency = deficiencyM ? deficiencyM[1].trim() : '';

  // ── 禁止事項 ──
  const prohibitedM = answer.match(/\*\*禁止事項[：:]?\*\*\s*([\s\S]*?)(?=\n\*\*|\n_)/);
  const prohibited = prohibitedM ? prohibitedM[1].trim() : '';

  // ── metadata 行：_WKB-009　類組：H2　階段：現場檢查　審件風險：高_ ──
  const metaM = answer.match(/_((?:WKB|BS)-[\w-]+)[^\n_]*_/);
  const id = metaM ? metaM[1] : '';

  const groupM  = answer.match(/類組：([^\s　_\n]+)/);
  const rawGroup = groupM ? groupM[1] : null;
  const group = (!rawGroup || rawGroup === '全') ? null : rawGroup;

  const stageM = answer.match(/階段：([^\s　_\n\/]+(?:\/[^\s　_\n]+)?)/);
  const stage = stageM ? stageM[1] : '';

  const riskM = answer.match(/審件風險：([^\s　_\n]+)/);
  const risk = riskM ? riskM[1] : '';

  // ── 備註 ──
  const notesM = answer.match(/_備註[：:]([^_]+)_/);
  const notes = notesM ? notesM[1].trim() : '';

  // ── conclusionType ──
  let conclusionType = 'info';
  const c = conclusion;
  if (/^(需要|是|可以|可|符合|合法|允許|應該|可以通過|通過|有效)/.test(c)) {
    conclusionType = 'yes';
  } else if (/^(不需要|不可以|不可|不得|不符|免|否|不適用|暫不|禁止|不能|無需|不用|不必)/.test(c)) {
    conclusionType = 'no';
  }

  return { id, county, group, stage, topic, question, conclusion, conclusionType,
           detail, deficiency, prohibited, risk, source, notes };
}

const parsed = entries.map(e => parseAnswer(e.answer, e.source));

// ── 統計 ──
const noId = parsed.filter(e => !e.id).length;
const noQuestion = parsed.filter(e => !e.question).length;
const noConclusion = parsed.filter(e => !e.conclusion).length;
console.log(`No ID: ${noId}, No question: ${noQuestion}, No conclusion: ${noConclusion}`);

// ── 產生新 TS 檔案 ────────────────────────────────────────────────────────────
function esc(str) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

const lines = [
  "import type { Entry } from '../types'",
  '',
  'export const entries: Entry[] = [',
];

for (const e of parsed) {
  lines.push('  {');
  lines.push(`    id: \`${esc(e.id)}\`,`);
  lines.push(`    county: \`${esc(e.county)}\`,`);
  lines.push(`    group: ${e.group === null ? 'null' : `\`${esc(e.group)}\``},`);
  lines.push(`    stage: \`${esc(e.stage)}\`,`);
  lines.push(`    topic: \`${esc(e.topic)}\`,`);
  lines.push(`    question: \`${esc(e.question)}\`,`);
  lines.push(`    conclusion: \`${esc(e.conclusion)}\`,`);
  lines.push(`    conclusionType: '${e.conclusionType}',`);
  lines.push(`    detail: \`${esc(e.detail)}\`,`);
  lines.push(`    deficiency: \`${esc(e.deficiency)}\`,`);
  lines.push(`    prohibited: \`${esc(e.prohibited)}\`,`);
  lines.push(`    risk: '${e.risk}',`);
  lines.push(`    source: \`${esc(e.source)}\`,`);
  lines.push(`    notes: \`${esc(e.notes)}\`,`);
  lines.push('  },');
}

lines.push(']');
lines.push('');

fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log(`Written to ${outFile}`);

// ── 驗證樣本 ──
console.log('\n=== 樣本驗證 ===');
for (const e of parsed.slice(0, 3)) {
  console.log(`${e.id} [${e.county}] ${e.topic}`);
  console.log(`  結論(${e.conclusionType}): ${e.conclusion}`);
  console.log(`  階段: ${e.stage} | 類組: ${e.group} | 風險: ${e.risk}`);
  console.log('');
}
