/**
 * Burger Spec 契约测试。
 *
 * 重点验证「分层诚实」这条硬约束：虚拟人格绝不允许携带真实营养数据。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGENT_STATE_META,
  SPEC_VERSION,
  buildSpec,
  validateBurgerSpec,
} from '../src/spec/burger-spec.ts';
import { PERSONAS } from '../src/persona/personas.ts';

const baseSpec = () =>
  buildSpec({
    persona: {
      id: PERSONAS[0].id,
      name: PERSONAS[0].name,
      keyword: PERSONAS[0].keyword,
      tagline: PERSONAS[0].tagline,
      visual: PERSONAS[0].visual,
      agentEffect: PERSONAS[0].agentEffect,
    },
  });

test('buildSpec 产出的结构通过校验', () => {
  const errors = validateBurgerSpec(baseSpec());
  assert.deepEqual(errors, [], `不应有校验错误：${errors.join('; ')}`);
});

test('版本号必须与契约一致', () => {
  const spec = baseSpec();
  assert.equal(spec.version, SPEC_VERSION);
  assert.equal(validateBurgerSpec({ ...spec, version: '9.9' }).length > 0, true);
});

test('虚拟层携带 nutrition 时必须被拒绝', () => {
  const spec = baseSpec();
  const bad = {
    ...spec,
    source: 'virtual',
    nutrition: {
      productName: '巨无霸',
      energyKcal: 500,
      protein: 25,
      fat: 20,
      carbohydrate: 45,
      sodium: 1000,
      calcium: 100,
      sourceUrl: 'https://example.com',
      fetchedAt: '2026-10-10',
    },
  };
  const errors = validateBurgerSpec(bad);
  assert.ok(
    errors.some((e) => e.includes('虚拟角色不承载真实营养数值')),
    `应拒绝虚拟层带 nutrition，实际错误：${errors.join('; ')}`,
  );
});

test('参考层缺nutrition 时必须被拒绝', () => {
  const errors = validateBurgerSpec({ ...baseSpec(), source: 'reference' });
  assert.ok(
    errors.some((e) => e.includes('必须包含 nutrition')),
    `应要求 nutrition，实际：${errors.join('; ')}`,
  );
});

test('参考层 nutrition 缺来源或日期时被拒绝', () => {
  const spec = { ...baseSpec(), source: 'reference' };
  const full = {
    productName: '猪柳蛋麦满分',
    energyKcal: 387,
    protein: 23,
    fat: 21,
    carbohydrate: 25,
    sodium: 846,
    calcium: 243,
    sourceUrl: 'https://mcp.mcd.cn',
    fetchedAt: '2026-10-10',
  };
  assert.deepEqual(validateBurgerSpec({ ...spec, nutrition: full }), []);

  const noDate = validateBurgerSpec({
    ...spec,
    nutrition: { ...full, fetchedAt: '' },
  });
  assert.ok(noDate.some((e) => e.includes('fetchedAt')));

  const noUrl = validateBurgerSpec({
    ...spec,
    nutrition: { ...full, sourceUrl: '' },
  });
  assert.ok(noUrl.some((e) => e.includes('sourceUrl')));

  const badNumber = validateBurgerSpec({
    ...spec,
    nutrition: { ...full, energyKcal: '三百八十七' },
  });
  assert.ok(badNumber.some((e) => e.includes('energyKcal')));
});

test('source 只接受 virtual / reference 两种值', () => {
  assert.ok(validateBurgerSpec({ ...baseSpec(), source: 'official' }).length > 0);
  assert.ok(validateBurgerSpec({ ...baseSpec(), source: '' }).length > 0);
});

test('配料缺字段时被逐条指出', () => {
  const errors = validateBurgerSpec({
    ...baseSpec(),
    toppings: [{ id: 'x', label: '', flavor: 'a', glyph: 'X' }],
  });
  assert.ok(
    errors.some((e) => e.includes('toppings[0].label')),
    `应指出具体配料字段，实际：${errors.join('; ')}`,
  );
});

test('非对象输入不抛异常，返回明确错误', () => {
  for (const bad of [null, undefined, 42, 'string', []]) {
    const errors = validateBurgerSpec(bad);
    assert.ok(errors.length > 0, `输入 ${JSON.stringify(bad)} 应被拒绝`);
  }
});

test('八个人格都能生成合法 Spec', () => {
  for (const p of PERSONAS) {
    const errors = validateBurgerSpec(
      buildSpec({
        persona: {
          id: p.id,
          name: p.name,
          keyword: p.keyword,
          tagline: p.tagline,
          visual: p.visual,
          agentEffect: p.agentEffect,
        },
      }),
    );
    assert.deepEqual(errors, [], `${p.name} 的 Spec 应合法：${errors.join('; ')}`);
  }
});

test('Agent 状态元数据覆盖全部六种状态，且都有中文名与台词', () => {
  const states = ['idle', 'focus', 'inspiration', 'bug', 'slack', 'full'];
  for (const s of states) {
    const meta = AGENT_STATE_META[s];
    assert.ok(meta, `缺少 ${s} 的元数据`);
    assert.ok(meta.label.length > 0);
    assert.ok(meta.line.length > 0);
    assert.match(meta.color, /^#[0-9a-f]{6}$/i);
  }
});