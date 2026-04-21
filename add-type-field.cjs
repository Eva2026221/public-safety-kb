'use strict';
/**
 * 為現有 entries 加入 type 欄位 + 改善籠統 topic
 * 執行：node add-type-field.cjs
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/data/knowledgeBaseEntries.ts');
const src  = fs.readFileSync(file, 'utf8');

// ── 判定 type ─────────────────────────────────────────────────────────────────
function isRegulation(topic, question, source) {
  // 明確解釋函
  if (/解釋函/.test(topic)) return true;
  // 申報制度Q&A / 申報制度問答（但這些實際上是Q&A，保留 qa）
  if (/問\d+$/.test(topic)) return false;
  // 長問題 + 沒有「嗎」「嗎？」「嗎?」「嗎」 → 法條引用
  if (question.length > 80 && !/嗎[？?]?$/.test(question)) return true;
  return false;
}

// ── 籠統 topic 對照表 ──────────────────────────────────────────────────────────
// 如果 topic 是以下籠統分類標題，嘗試從 question 萃取更具體的主題
const GENERIC_TOPICS = new Set([
  '申報資格','書表整理','現場檢查','申報','照片規定','附件',
  '系統作業','缺失認定','改善計畫書','申報份數','附件清單',
]);

function deriveTopicFromQuestion(question) {
  if (!question) return '';
  // 移除縣市前綴
  let q = question.replace(/^(台北市|新北市|桃園市|台中市|台南市|高雄市|基隆市|新竹市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|澎湖縣|金門縣|馬祖|竹科|中科|交通局)\s*(H2|U2|學校|G類|B類)?\s*/g, '');
  // 取問號或句尾前的主題段（第一個頓號或逗號之前）
  q = q.replace(/[，,][^，,]*[嗎?？]?$/, '').replace(/[嗎?？]+$/, '').trim();
  if (q.length > 20) q = q.slice(0, 20);
  return q;
}

// ── 解析並更新每筆 entry ──────────────────────────────────────────────────────
// 在 TS 樣板字串格式下，每筆 entry 是：
//   {
//     id: `...`,
//     county: `...`,
//     group: null | `...`,
//     stage: `...`,
//     topic: `...`,
//     question: `...`,
//     ...
//   },

function getField(block, name) {
  const r = new RegExp(`\\b${name}:\\s*\`([^\`]*)\``);
  const m = block.match(r);
  return m ? m[1] : '';
}
function getNullableField(block, name) {
  const r = new RegExp(`\\b${name}:\\s*(null|\`([^\`]*)\`)`);
  const m = block.match(r);
  if (!m) return null;
  return m[1] === 'null' ? null : m[2];
}

// 找每個 entry block（{ ... },）並加入 type 欄位
let count = 0, regCount = 0, topicFixed = 0;
const updated = src.replace(
  /(\s*\{)\s*(id: `[^`]*`,\s*county: `[^`]*`,\s*group: (?:null|`[^`]*`),\s*stage: `[^`]*`,\s*topic: `([^`]*)`[^}]*\},)/gs,
  (fullMatch, open, body, topicVal) => {
    count++;

    const topic    = topicVal;
    const question = getField(body, 'question');
    const source   = getField(body, 'source');
    const type     = isRegulation(topic, question, source) ? 'regulation' : 'qa';

    if (type === 'regulation') regCount++;

    // 改善籠統 topic
    let finalTopic = topic;
    if (type === 'qa' && GENERIC_TOPICS.has(topic)) {
      const derived = deriveTopicFromQuestion(question);
      if (derived && derived.length > 2) {
        finalTopic = derived;
        topicFixed++;
      }
    }

    // 替換 topic 並加入 type 欄位（緊接在 id 後）
    let newBody = body.replace(
      /\btype: '(?:qa|regulation)',\s*/g, ''  // 移除舊有 type（如果已有）
    );
    // 在 id 欄位後插入 type
    newBody = newBody.replace(
      /(id: `[^`]*`,)/,
      `$1\n    type: '${type}',`
    );
    // 更新 topic
    if (finalTopic !== topic) {
      newBody = newBody.replace(
        /topic: `[^`]*`,/,
        `topic: \`${finalTopic}\`,`
      );
    }

    return `${open}\n    ${newBody.trimStart()}`;
  }
);

fs.writeFileSync(file, updated, 'utf8');
console.log(`處理 ${count} 筆`);
console.log(`標記 regulation：${regCount} 筆`);
console.log(`改善 topic：${topicFixed} 筆`);
