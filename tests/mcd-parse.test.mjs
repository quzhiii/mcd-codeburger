import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractEnvelope,
  parseCompactTable,
  toNutritionRows,
  parseNutritionResponse,
} from '../src/mcd-adapter/parse.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(path.join(here, 'fixtures', 'nutrition-response.json'), 'utf8'));

/** 把夹具拼成前端真正拿到的那段文本 */
function buildRawText() {
  return fixture.markdownHeader + '\n\n' + JSON.stringify(fixture.envelope);
}

test('信封：能从 markdown 外壳里取出 JSON', () => {
  const env = extractEnvelope(buildRawText());
  assert.ok(env, '必须解析出信封');
  assert.equal(env.success, true);
  assert.equal(env.code, 200);
  assert.equal(typeof env.data, 'string');
});

test('信封：裸 JSON 也能解析', () => {
  const env = extractEnvelope(JSON.stringify(fixture.envelope));
  assert.ok(env);
  assert.equal(env.code, 200);
});

test('信封：空输入与垃圾输入返回 null，不抛异常', () => {
  assert.equal(extractEnvelope(''), null);
  assert.equal(extractEnvelope('   '), null);
  assert.equal(extractEnvelope('这不是 JSON'), null);
});

test('紧凑表格：表头声明行数与字段名正确', () => {
  const t = parseCompactTable(fixture.envelope.data);
  assert.equal(t.declaredCount, 160);
  assert.deepEqual(t.fieldNames, [
    'productName',
    'nutritionDescription',
    'energyKj',
    'energyKcal',
    'protein',
    'fat',
    'carbohydrate',
    'sodium',
    'calcium',
  ]);
  assert.equal(t.rows.length, 3);
});

test('紧凑表格：声明的行数与实际行数不一致时要留痕，不静默通过', () => {
  const t = parseCompactTable(fixture.envelope.data);
  // 夹具故意只留 3 行，但表头写 160 → 必须产出告警
  assert.equal(t.warnings.length, 1, '行数不一致必须恰好产生一条告警');
  assert.match(t.warnings[0], /160/);
});

test('紧凑表格：null 转成 null，数字转成 number', () => {
  const rows = toNutritionRows(parseCompactTable(fixture.envelope.data));
  assert.equal(rows.length, 3);
  const first = rows[0];
  assert.equal(first.productName, '猪柳麦满分');
  assert.equal(first.nutritionDescription, null);
  assert.equal(first.energyKj, 1288);
  assert.equal(first.energyKcal, 308);
  assert.equal(first.protein, 16);
  assert.equal(first.fat, 16);
  assert.equal(first.carbohydrate, 24);
  assert.equal(first.sodium, 781);
  assert.equal(first.calcium, 213);
});

test('紧凑表格：字段数多于表头时把多出来的并回首个字段', () => {
  const t = parseCompactTable('[2]{a,b,c}:\n  甲,乙,丙\n  带,逗,号,的,名,字,x,y');
  assert.equal(t.rows.length, 2);
  assert.equal(t.rows[0].join('|'), '甲|乙|丙');
  // 6 个多余片段 + 2 个真实值 = 8 段，超出 3 个字段共 5 段，全部并回第 1 个字段
  assert.equal(t.rows[1][0], '带,逗,号,的,名,字');
  assert.equal(t.rows[1][1], 'x');
  assert.equal(t.rows[1][2], 'y');
});

test('紧凑表格：没有表头时返回空并留痕', () => {
  const t = parseCompactTable('随便一段没有表头的东西');
  assert.equal(t.rows.length, 0);
  assert.ok(t.warnings.length > 0);
});

test('端到端：一段真机原文 → 结构化营养行', () => {
  const r = parseNutritionResponse(buildRawText());
  assert.equal(r.envelope?.code, 200);
  assert.equal(r.table?.declaredCount, 160);
  assert.equal(r.rows.length, 3);
  assert.equal(r.rows[1].productName, '猪柳蛋麦满分');
  assert.equal(r.rows[1].energyKcal, 387);
});

test('端到端：data 不是字符串时给出告警而非崩溃', () => {
  const env = { success: true, code: 200, message: '请求成功', data: { foo: 1 } };
  const r = parseNutritionResponse('## Original Response\n\n' + JSON.stringify(env));
  assert.equal(r.rows.length, 0);
  assert.match(r.warnings[0], /data 字段不是字符串/);
});

test('解析层是纯函数：同一输入两次结果完全一致', () => {
  const a = JSON.stringify(parseNutritionResponse(buildRawText()));
  const b = JSON.stringify(parseNutritionResponse(buildRawText()));
  assert.equal(a, b);
});
