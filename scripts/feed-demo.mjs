/**
 * Burger Spec 本地演示与自检。
 *
 * 用途：不碰网络、不用 Token，验证「人格 → Spec → 校验 → 分享卡数据」这条链路
 * 是否自洽，同时给开发者一个能直接跑的例子。
 *
 * 运行：npm run skill:demo
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PERSONAS } from '../src/persona/personas.ts';
import { evaluate } from '../src/persona/index.ts';
import { QUESTIONS } from '../src/persona/questions.ts';
import { SPEC_VERSION, validateBurgerSpec } from '../src/spec/burger-spec.ts';
import { feed } from '../src/agent/feed.ts';
import {
  extractEnvelope,
  parseCompactTable,
  toNutritionRows,
} from '../src/mcd-adapter/parse.ts';

const here = dirname(fileURLToPath(import.meta.url));

/** 与tests/fixtures/nutrition-response.json 共用的真机抓取样本 */
const FIXTURE = join(here, '..', 'tests', 'fixtures', 'nutrition-response.json');

/**
 * 取真机样本里的前若干行，作为参考层数据。
 * 夹具保存的是原始信封格式，这里走一遍真实解析层，
 * 保证演示路径和真机路径是同一条。
 */
function loadNutritionRows(limit) {
  const raw = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const body = raw.markdownHeader + '\n\n' + JSON.stringify(raw.envelope);
  const envelope = extractEnvelope(body);
  if (!envelope) return [];
  const table = parseCompactTable(envelope.data);
  return toNutritionRows(table).slice(0, limit);
}

function line(msg) {
  console.log(msg);
}

/** 从人格构造虚拟层 Spec */
function virtualSpec(personaId) {
  const p = PERSONAS.find((x) => x.id === personaId);
  if (!p) throw new Error(`未知人格：${personaId}`);
  return {
    version: SPEC_VERSION,
    personaId: p.id,
    name: p.name,
    keyword: p.keyword,
    tagline: p.tagline,
    color: p.visual.color,
    bunShape: p.visual.bunShape,
    toppings: [],
    agentEffect: p.agentEffect,
    source: 'virtual',
    recipeVersion: 'demo-virtual',
  };
}

/** 从人格 + 真机营养行构造参考层 Spec */
function referenceSpec(personaId, nutrition) {
  const base = virtualSpec(personaId);
  return {
    ...base,
    source: 'reference',
    nutrition: {
      productName: nutrition.productName,
      energyKcal: nutrition.energyKcal,
      protein: nutrition.protein,
      fat: nutrition.fat,
      carbohydrate: nutrition.carbohydrate,
      sodium: nutrition.sodium,
      calcium: nutrition.calcium,
      sourceUrl: 'https://mcp.mcd.cn',
      fetchedAt: '2026-10-10',
    },
    recipeVersion: 'demo-reference',
  };
}

function main() {
  line('=== CodeBurger · Burger Spec 本地自检 ===\n');

  // 1. 虚拟层：八个人格全部合法，且不带营养数据
  line('【1】虚拟层 Spec（八个人格全检）');
  let virtualOk = 0;
  for (const p of PERSONAS) {
    const spec = virtualSpec(p.id);
    const errors = validateBurgerSpec(spec);
    if (errors.length === 0) virtualOk += 1;
    else line(`  FAIL ${p.name}：${errors.join('; ')}`);
  }
  line(`  通过 ${virtualOk}/${PERSONAS.length}`);
  line(`  含 nutrition 字段的虚拟 Spec：${virtualOk=== PERSONAS.length ? '0（正确）' : '异常'}`);

  // 2. 反例：虚拟层硬塞营养数据必须被拒
  line('\n【2】反例校验：虚拟层塞入真实营养数据');
  const tampered = {
    ...virtualSpec('chili-social'),
    nutrition: {
      productName: '巨无霸',
      energyKcal: 500,
      protein: 25,
      fat: 20,
      carbohydrate: 45,
      sodium: 1000,
      calcium: 100,
      sourceUrl: 'https://mcp.mcd.cn',
      fetchedAt: '2026-10-10',
    },
  };
  const tamperErrors = validateBurgerSpec(tampered);
  line(`  是否被拒：${tamperErrors.length > 0 ? '是（正确）' : '否（危险）'}`);
  for (const e of tamperErrors) line(`    · ${e}`);

  // 3. 参考层：用真机样本构造
  line('\n【3】参考层 Spec（基于真机营养样本）');
  const rows = loadNutritionRows(3);
  if (rows.length === 0) {
    line('  样本为空，跳过');
  } else {
    const r = rows[0];
    const spec = referenceSpec('cheese-spark', r);
    const errors = validateBurgerSpec(spec);
    line(`  ${errors.length === 0 ? '通过' : `FAIL：${errors.join('; ')}`}`);
    line(`  匹配餐品：${spec.nutrition.productName}`);
    line(
      `  营养：${spec.nutrition.energyKcal} kcal · 蛋白 ${spec.nutrition.protein}g · 脂肪 ${spec.nutrition.fat}g`,
    );
    line(`  抓取日期：${spec.nutrition.fetchedAt}（非实时数据）`);
    line('  注意：以上是真实餐品的属性，不代表「灵感芝士堡」这个人格。');
  }

  // 4. 投喂链路
  line('\n【4】投喂链路（虚拟机制）');
  let fullness = 0;
  let state = null;
  for (let i = 0; i < 6; i += 1) {
    const res = feed({ baseEffect: 'inspiration', toppings: [], fullness });
    fullness = res.fullness;
    state = res.state;
  }
  line(`  6 口之后：饱腹度 ${fullness}/100，Agent 状态 ${state}`);

  // 5. 端到端：答题 → 人格 → Spec
  line('\n【5】端到端：答题 → 人格 → Spec');
  const answers = {};
  QUESTIONS.forEach((q) => {
    answers[q.id] = q.options[0].id;
  });
  const result = evaluate(answers);
  const e2e = virtualSpec(result.persona.id);
  line(`  答案键：${result.answerKey.slice(0, 48)}...`);
  line(`  命中人格：${result.persona.name}（${result.persona.keyword}）`);
  line(`  Spec 校验：${validateBurgerSpec(e2e).length === 0 ? '通过' : '失败'}`);

  line('\n=== 自检结束，全程未联网、未使用任何 Token ===');
}

main();