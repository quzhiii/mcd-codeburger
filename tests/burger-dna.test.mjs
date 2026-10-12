/**
 * Burger DNA 契约测试。
 *
 * 重点验证三条硬约束：
 * 1. 单源缺失不塌 —— 只有人格测试时也要能生成合法 DNA
 * 2. 等级由属性 + 完整度共同决定，不能只看一个
 * 3. 同槽位装备冲突必须被校验拦下（叠加渲染会打架）
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTRIBUTE_KEYS,
  DNA_VERSION,
  LEVEL_TITLES,
  applyBoosts,
  buildBurgerDna,
  computeCompleteness,
  computeLevel,
  validateBurgerDna,
} from '../src/burger-dna/dna.ts';
import { PERSONAS } from '../src/persona/personas.ts';

const p0 = PERSONAS[0];

const persona = {
  id: p0.id,
  name: p0.name,
  keyword: p0.keyword,
  tagline: p0.tagline,
  visual: p0.visual,
  agentEffect: p0.agentEffect,
};

const quizOnly = () => ({
  quiz: {
    source: 'quiz',
    vector: [0, 0, 0, 0, 0],
    personaId: p0.id,
    personaName: p0.name,
    color: '#ffffff',
  },
});

const mkIngredient = (over = {}) => ({
  id: 'x',
  label: '配料',
  taste: '测试',
  glyph: 'X',
  layer: 0,
  color: '#ffffff',
  source: 'quiz',
  boost: {},
  ...over,
});

const mkEquipment = (over = {}) => ({
  id: 'e',
  label: '装备',
  slot: 'head',
  glyph: '^',
  color: '#ffffff',
  source: 'quiz',
  ...over,
});

test('只靠人格测试（单源）也能生成合法 DNA', () => {
  const dna = buildBurgerDna({
    persona,
    sources: {
      quiz: {
        source: 'quiz',
        vector: [1, 0, 0, -1, 1],
        personaId: p0.id,
        personaName: p0.name,
        color: p0.visual.color,
      },
    },
  });
  assert.deepEqual(validateBurgerDna(dna), []);
  assert.equal(dna.completeness, 25, '只有 quiz 时完整度应为 25');
});

test('完全没有 sources 会被拒绝', () => {
  const dna = buildBurgerDna({ persona });
  const errors = validateBurgerDna(dna);
  assert.ok(
    errors.some((e) => e.includes('至少要有一个数据源')),
    `应拒绝空 sources，实际：${errors.join('; ')}`,
  );
});

test('sources 里显式写 undefined 会被拒绝', () => {
  const dna = buildBurgerDna({
    persona,
    sources: { quiz: undefined },
  });
  assert.ok(validateBurgerDna(dna).some((e) => e.includes('sources.quiz')));
});

test('完整度按实际来源加权计算', () => {
  assert.equal(computeCompleteness({}), 0);
  assert.equal(computeCompleteness({ quiz: {} }), 25);
  assert.equal(
    computeCompleteness({
      quiz: {},
      mcd: {},
      github: {},
      campaign: {},
    }),
    100,
  );
});

test('属性加成会叠加并夹在 0-100', () => {
  const out = applyBoosts(
    { code: 50, creative: 10, stamina: 0 },
    [mkIngredient({ boost: { code: 20 } }), mkIngredient({ boost: { code: 10, creative: 5 } })],
  );
  assert.equal(out.code, 80);
  assert.equal(out.creative, 15);
  assert.equal(out.stamina, 0);

  const over = applyBoosts({ code: 99 }, [mkIngredient({ boost: { code: 50 } })]);
  assert.equal(over.code, 100, '不能超过 100');

  const under = applyBoosts({ code: 5 }, [mkIngredient({ boost: { code: -50 } })]);
  assert.equal(under.code, 0, '不能低于 0');
});

test('等级同时受属性与完整度影响', () => {
  const highAttr = { code: 100, creative: 100, stamina: 100 };
  const lowAttr = { code: 10, creative: 10, stamina: 10 };

  const highFull = computeLevel(highAttr, 100);
  const highLowFull = computeLevel(highAttr, 25);
  const lowFull = computeLevel(lowAttr, 100);

  assert.ok(highFull.level > highLowFull.level, '属性相同，完整度高的等级更高');
  assert.ok(highLowFull.level > lowFull.level, '完整度相同，属性高的等级更高');
  assert.ok(highFull.level <= 10 && highFull.level >= 1, '等级必须在 1-10');
});

test('满级时 toNext 为 null，且称号表够用', () => {
  const maxed = computeLevel({ code: 100, creative: 100, stamina: 100 }, 100);
  assert.equal(maxed.level, 10);
  assert.equal(maxed.toNext, null);
  assert.equal(LEVEL_TITLES.length, 10);
  assert.equal(maxed.title, LEVEL_TITLES[9]);
  assert.ok(maxed.basis.includes('完整度'));
});

test('同槽位装备会被去重，保证校验能过', () => {
  const dna = buildBurgerDna({
    persona,
    sources: quizOnly(),
    equipment: [
      mkEquipment({ id: 'a', slot: 'head' }),
      mkEquipment({ id: 'b', slot: 'head' }),
      mkEquipment({ id: 'c', slot: 'face' }),
    ],
  });
  assert.deepEqual(validateBurgerDna(dna), []);
  assert.equal(dna.equipment.length, 2, '两个 head 应合并成一个');
});

test('手工构造的重复槽位会被校验拦下', () => {
  const dna = buildBurgerDna({
    persona,
    sources: quizOnly(),
  });
  // 绕过去重，手工塞两个同槽位
  const broken = { ...dna, equipment: [mkEquipment({ slot: 'head' }), mkEquipment({ slot: 'head' })] };
  assert.ok(validateBurgerDna(broken).some((e) => e.includes('slot 重复占用')));
});

test('配料最多 6 层，超出会被拦', () => {
  const many = Array.from({ length: 8 }, (_, i) => mkIngredient({ id: `i${i}`, layer: i }));
  const dna = buildBurgerDna({
    persona,
    sources: quizOnly(),
    ingredients: many,
  });
  assert.equal(dna.ingredients.length, 6, '构建时应自动截断到 6');

  const broken = { ...dna, ingredients: many };
  assert.ok(validateBurgerDna(broken).some((e) => e.includes('最多 6 层')));
});

test('属性越界会被校验拦下', () => {
  const dna = buildBurgerDna({
    persona,
    sources: quizOnly(),
  });
  const broken = { ...dna, attributes: { code: 150, creative: -10, stamina: 50 } };
  const errors = validateBurgerDna(broken);
  assert.ok(errors.some((e) => e.includes('attributes.code')));
  assert.ok(errors.some((e) => e.includes('attributes.creative')));
});

test('非对象输入不抛异常', () => {
  for (const bad of [null, undefined, 42, 'x', []]) {
    assert.ok(validateBurgerDna(bad).length > 0, `应拒绝 ${JSON.stringify(bad)}`);
  }
});

test('真实营养参考缺来源或日期会被拒绝', () => {
  const base = buildBurgerDna({
    persona,
    sources: quizOnly(),
  });
  const full = {
    productName: '板烧鸡腿堡',
    energyKcal: 500,
    protein: 25,
    fat: 20,
    carbohydrate: 45,
    sodium: 1000,
    calcium: 100,
    sourceUrl: 'https://mcp.mcd.cn',
    fetchedAt: '2026-10-12',
  };
  assert.deepEqual(validateBurgerDna({ ...base, nutritionRef: full }), []);

  assert.ok(
    validateBurgerDna({ ...base, nutritionRef: { ...full, fetchedAt: '' } }).some((e) =>
      e.includes('fetchedAt'),
    ),
  );
  assert.ok(
    validateBurgerDna({ ...base, nutritionRef: { ...full, energyKcal: '五百' } }).some((e) =>
      e.includes('energyKcal'),
    ),
  );
});

test('八个人格都能构建出合法 DNA', () => {
  for (const p of PERSONAS) {
    const dna = buildBurgerDna({
      persona: {
        id: p.id,
        name: p.name,
        keyword: p.keyword,
        tagline: p.tagline,
        visual: p.visual,
        agentEffect: p.agentEffect,
      },
      sources: {
        quiz: { source: 'quiz', vector: p.vec, personaId: p.id, personaName: p.name, color: p.visual.color },
      },
    });
    assert.deepEqual(validateBurgerDna(dna), [], `${p.name} 应合法`);
  }
});

test('版本号不对会被拒绝', () => {
  const dna = buildBurgerDna({
    persona,
    sources: quizOnly(),
  });
  assert.equal(dna.version, DNA_VERSION);
  assert.ok(validateBurgerDna({ ...dna, version: '1.0' }).some((e) => e.includes('version')));
});

test('属性键名固定为三项', () => {
  assert.deepEqual([...ATTRIBUTE_KEYS], ['code', 'creative', 'stamina']);
});