/**
 * 网页主流程 DNA 装配测试。
 *
 * 重点：
 * 1. 属性推导必须是确定性的，且永远落在合法区间
 * 2. quiz-only 与 quiz+github 两种装配都要通过契约校验
 * 3. 配料与装备只能来自真实存在的 GitHub 数据，不能凭空出现
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWebDna,
  deriveAttributes,
  languageToEquipment,
  toppingColor,
  toppingsToIngredients,
} from '../src/burger-dna/web-dna.ts';
import { validateBurgerDna } from '../src/burger-dna/dna.ts';
import { PERSONAS } from '../src/persona/personas.ts';
import { toppingsFromProfile } from '../src/github/toppings.ts';

const persona = PERSONAS[0];
const vecZero = [0, 0, 0, 0, 0];
const vecAllPlus = [1, 1, 1, 1, 1];
const vecAllMinus = [-1, -1, -1, -1, -1];

const baseProfile = {
  username: 'quzhiii',
  publicRepos: 12,
  followers: 3,
  languages: ['TypeScript', 'Python'],
  totalStars: 34,
  topRepo: 'demo',
};

/* ---------- 属性推导 ---------- */

test('属性推导：确定性与合法区间', () => {
  for (const vec of [vecZero, vecAllPlus, vecAllMinus, [1, -1, 0, 1, -1]]) {
    const a = deriveAttributes(vec);
    const b = deriveAttributes(vec);
    assert.deepEqual(a, b, '同向量必须得到同属性');
    for (const key of ['code', 'creative', 'stamina']) {
      assert.ok(Number.isInteger(a[key]), `${key} 应为整数`);
      assert.ok(a[key] >= 8 && a[key] <= 95, `${key} 超出区间：${a[key]}`);
    }
  }
});

test('属性推导：不同向量的结果应可区分', () => {
  const zero = deriveAttributes(vecZero);
  const plus = deriveAttributes(vecAllPlus);
  assert.notDeepEqual(zero, plus, '全 +1 与全 0 不应得到同一组属性');
  // 社交能量越高续航越高；休息需求越高续航越低（公式口径的显式断言）
  assert.ok(
    deriveAttributes([1, 0, 0, -1, 0]).stamina >
      deriveAttributes([-1, 0, 0, 1, 0]).stamina,
    'E 高 R 低的续航应高于 E 低 R 高',
  );
});

/* ---------- 配料与装备 ---------- */

test('虚拟配料 → DNA 配料：颜色合法且确定', () => {
  const toppings = toppingsFromProfile(baseProfile);
  assert.ok(toppings.length > 0);
  const list = toppingsToIngredients(toppings);
  assert.ok(list.length <= 6, '最多 6 层');
  for (const [i, ing] of list.entries()) {
    assert.equal(ing.source, 'github', '网页端配料来源只能是 github');
    assert.equal(ing.layer, i, 'layer 应依次递增');
    assert.match(ing.color, /^#[0-9a-f]{6}$/i, `颜色格式不合法：${ing.color}`);
    assert.equal(ing.color, toppingColor(toppings[i]), '颜色应与 toppingColor 一致');
  }
});

test('装备只在有 GitHub 语言数据时出现', () => {
  assert.equal(languageToEquipment(null).length, 0);
  assert.equal(languageToEquipment({ ...baseProfile, languages: [] }).length, 0);
  const eq = languageToEquipment(baseProfile);
  assert.equal(eq.length, 1);
  assert.equal(eq[0].slot, 'hand');
  assert.equal(eq[0].source, 'github');
});

/* ---------- 装配入口 ---------- */

test('quiz-only：无配料无装备，完整度 25，契约校验通过', () => {
  const dna = buildWebDna({ persona, vec: vecZero, toppings: [], github: null });
  assert.deepEqual(validateBurgerDna(dna), [], '生成的 DNA 必须通过契约校验');
  assert.equal(dna.completeness, 25);
  assert.equal(dna.ingredients.length, 0);
  assert.equal(dna.equipment.length, 0);
  assert.ok(!('github' in dna.sources), '没加料就不应携带 github 源');
  assert.ok(dna.level.level >= 1 && dna.level.level <= 10);
});

test('quiz+github：配料来源正确，完整度 50，契约校验通过', () => {
  const toppings = toppingsFromProfile(baseProfile);
  const dna = buildWebDna({ persona, vec: vecZero, toppings, github: baseProfile });
  assert.deepEqual(validateBurgerDna(dna), []);
  assert.equal(dna.completeness, 50);
  assert.ok(dna.ingredients.length > 0);
  assert.equal(dna.equipment.length, 1);
  assert.ok(dna.sources.github, '应携带 github 源');
  assert.equal(dna.sources.github.username, 'quzhiii');
});

test('配料加成会实际改变属性（数据改变结果）', () => {
  const toppings = toppingsFromProfile(baseProfile);
  const quizOnly = buildWebDna({ persona, vec: vecZero, toppings: [], github: null });
  const withGithub = buildWebDna({ persona, vec: vecZero, toppings, github: baseProfile });
  assert.ok(
    withGithub.attributes.code > quizOnly.attributes.code,
    '带 GitHub 配料的 code 应高于纯答题',
  );
});

test('装配完全确定：同输入两次结果一致', () => {
  const toppings = toppingsFromProfile(baseProfile);
  const a = buildWebDna({ persona, vec: vecZero, toppings, github: baseProfile });
  const b = buildWebDna({ persona, vec: vecZero, toppings, github: baseProfile });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
