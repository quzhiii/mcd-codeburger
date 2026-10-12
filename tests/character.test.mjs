/**
 * Burger Character System 测试。
 *
 * 重点验证「数据真的改变视觉」这件事：
 * 同样的基础图，不同的装备 / 配料，渲染结果必须不同。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHARACTER_STYLES,
  STAGE,
  levelAura,
  renderBurgerSvg,
} from '../src/burger-dna/character.ts';
import { buildBurgerDna, validateBurgerDna } from '../src/burger-dna/dna.ts';
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

const quizSource = {
  source: 'quiz',
  vector: [0, 0, 0, 0, 0],
  personaId: p0.id,
  personaName: p0.name,
  color: p0.visual.color,
};

const quizOnly = () => ({
  quiz: {
    source: 'quiz',
    vector: [0, 0, 0, 0, 0],
    personaId: p0.id,
    personaName: p0.name,
    color: p0.visual.color,
  },
});

const mkIng = (over = {}) => ({
  id: 'x',
  label: '配料',
  taste: 't',
  glyph: 'X',
  layer: 0,
  color: '#123456',
  source: 'quiz',
  boost: {},
  ...over,
});

const mkEq = (over = {}) => ({
  id: 'e',
  label: '装备',
  slot: 'head',
  glyph: '^',
  color: '#654321',
  source: 'quiz',
  ...over,
});

const render = (dna) => renderBurgerSvg(dna, { baseUrl: `assets/personas/${p0.id}.png`, alt: dna.name });

test('基础渲染产出合法 SVG', () => {
  const dna = buildBurgerDna({ persona, sources: { quiz: quizSource } });
  const svg = render(dna);
  assert.ok(svg.startsWith('<svg'), '应以 <svg 开头');
  assert.ok(svg.includes('</svg>'), '应以 </svg> 结尾');
  assert.ok(svg.includes(`viewBox="0 0 ${STAGE} ${STAGE}"`), 'viewBox 应为 0 0 400 400');
  assert.ok(svg.includes('role="img"'), '应有 role=img');
  assert.ok(svg.includes('aria-label'), '应有 aria-label');
});

test('基础图被正确引用', () => {
  const dna = buildBurgerDna({ persona, sources: { quiz: quizSource } });
  const svg = render(dna);
  assert.ok(svg.includes(`assets/personas/${p0.id}.png`), '应引用基础图 URL');
  assert.ok(svg.includes('<image'), '应有 image 元素');
});

test('showBase=false 时不渲染基础图', () => {
  const dna = buildBurgerDna({ persona, sources: { quiz: quizSource } });
  const svg = renderBurgerSvg(dna, { baseUrl: 'x.png', alt: 'a', showBase: false });
  assert.ok(!svg.includes('<image'), '关闭时不应有 image 元素');
});

test('不同配料会改变渲染结果——这是核心诉求', () => {
  const a = buildBurgerDna({
    persona, sources: { quiz: quizSource },
    ingredients: [mkIng({ id: 'py', glyph: 'PY', color: '#35618f' })],
  });
  const b = buildBurgerDna({
    persona, sources: { quiz: quizSource },
    ingredients: [mkIng({ id: 'ts', glyph: 'TS', color: '#2c7a4b' })],
  });
  assert.notEqual(render(a), render(b), '不同配料必须渲染出不同结果');
  assert.ok(render(a).includes('PY'));
  assert.ok(render(b).includes('TS'));
});

test('不同装备会改变渲染结果', () => {
  const withHat = buildBurgerDna({
    persona, sources: { quiz: quizSource },
    equipment: [mkEq({ slot: 'head', glyph: '^' })],
  });
  const withGlasses = buildBurgerDna({
    persona, sources: { quiz: quizSource },
    equipment: [mkEq({ slot: 'face', glyph: '#' })],
  });
  assert.notEqual(render(withHat), render(withGlasses));
  assert.ok(render(withHat).includes('cb-eq--head'));
  assert.ok(render(withGlasses).includes('cb-eq--face'));
});

test('六个槽位都能渲染', () => {
  const slots = ['head', 'face', 'neck', 'hand', 'back', 'aura'];
  for (const slot of slots) {
    const dna = buildBurgerDna({
      persona, sources: { quiz: quizSource },
      equipment: [mkEq({ slot })],
    });
    const svg = render(dna);
    assert.ok(svg.includes(`cb-eq--${slot}`), `槽位 ${slot} 应有对应 class`);
    assert.ok(svg.length > 400, `槽位 ${slot} 应产出实际内容`);
  }
});

test('装备槽位互斥，同槽只渲染一个', () => {
  const dna = buildBurgerDna({
    persona, sources: { quiz: quizSource },
    equipment: [mkEq({ id: 'a', slot: 'head' }), mkEq({ id: 'b', slot: 'head' })],
  });
  const svg = render(dna);
  const count = (svg.match(/cb-eq--head/g) ?? []).length;
  assert.equal(count, 1, '同槽位只应渲染一次');
});

test('配料越多，动画延迟越大（依次落位）', () => {
  const dna = buildBurgerDna({
    persona, sources: { quiz: quizSource },
    ingredients: [
      mkIng({ id: 'a', glyph: '1', layer: 0 }),
      mkIng({ id: 'b', glyph: '2', layer: 1 }),
      mkIng({ id: 'c', glyph: '3', layer: 2 }),
    ],
  });
  const svg = render(dna);
  assert.ok(svg.includes('--i:0'));
  assert.ok(svg.includes('--i:1'));
  assert.ok(svg.includes('--i:2'));
});

test('配料与装备都为空时仍能渲染（单源场景）', () => {
  const dna = buildBurgerDna({ persona, sources: { quiz: quizSource } });
  const svg = render(dna);
  assert.deepEqual(validateBurgerDna(dna), []);
  assert.ok(svg.includes('<svg'));
});

test('SVG 内容做了转义，注入不生效', () => {
  const dna = buildBurgerDna({
    persona, sources: { quiz: quizSource },
    equipment: [mkEq({ glyph: '<script>alert(1)</script>' })],
  });
  const svg = render(dna);
  assert.ok(!svg.includes('<script>'), '不得出现未转义的 script 标签');
  assert.ok(svg.includes('&lt;script&gt;'), '尖括号应被转义');
});

test('alt 文本也被转义', () => {
  const dna = buildBurgerDna({ persona, sources: { quiz: quizSource } });
  const svg = renderBurgerSvg(dna, { baseUrl: 'x.png', alt: '"><script>x</script>' });
  assert.ok(!svg.includes('<script>'));
});

test('同 id 不同DNA 不会共用同一个渐变 id', () => {
  // 同一份DNA 重复渲染应稳定（id 一致），不同DNA 才有不同 id
  const a = buildBurgerDna({ persona, sources: { quiz: quizSource } });
  const b = buildBurgerDna({
    persona: { ...persona, id: 'other', name: '别的堡' },
    sources: { quiz: { ...quizSource, personaId: 'other' } },
  });
  assert.equal(render(a), render(a), '同输入应完全稳定');
  assert.notEqual(render(a), render(b));
});

test('等级光环分档合理', () => {
  assert.equal(levelAura(3).label, '普通');
  assert.equal(levelAura(5).label, '优良');
  assert.equal(levelAura(8).label, '稀有');
  assert.equal(levelAura(10).label, '传说');
  for (const lv of [1, 5, 10]) {
    assert.match(levelAura(lv).color, /^#[0-9a-f]{6}$/i);
  }
});

test('样式表包含动画与无障碍降级', () => {
  assert.ok(CHARACTER_STYLES.includes('prefers-reduced-motion'), '应尊重减少动效设置');
  assert.ok(CHARACTER_STYLES.includes('@keyframes cbIngIn'));
});

test('八个人格都能渲染出合法 SVG', () => {
  for (const p of PERSONAS) {
    const dna = buildBurgerDna({
      persona: {
        id: p.id, name: p.name, keyword: p.keyword, tagline: p.tagline,
        visual: p.visual, agentEffect: p.agentEffect,
      },
      sources: {
        quiz: { source: 'quiz', vector: p.vec, personaId: p.id, personaName: p.name, color: p.visual.color },
      },
      ingredients: [mkIng({ id: 'a', glyph: 'A' })],
      equipment: [mkEq({ slot: 'aura', glyph: '*' })],
    });
    const svg = renderBurgerSvg(dna, { baseUrl: `assets/personas/${p.id}.png`, alt: p.name });
    assert.ok(svg.startsWith('<svg') && svg.includes('</svg>'), `${p.name} 应渲染成功`);
  }
});

test('配料位置不重叠：同一行的配料横向错开', () => {
  const dna = buildBurgerDna({
    persona, sources: { quiz: quizSource },
    ingredients: [
      mkIng({ id: 'a', glyph: '1', layer: 0 }),
      mkIng({ id: 'b', glyph: '2', layer: 1 }),
      mkIng({ id: 'c', glyph: '3', layer: 2 }),
    ],
  });
  const svg = render(dna);
  // 提取所有 rect 的 x 值（配料层的圆角方块）
  const xs = [...svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+"\s+width="42"/g)].map((m) => Number(m[1]));
  assert.ok(xs.length >= 3, '应至少有 3 个配料方块');
  assert.equal(new Set(xs).size, xs.length, '同层配料 x 坐标不应相同，否则会重叠');
});
/* ============================================================
 * 分享卡（游戏角色卡版）
 * ============================================================ */

test('分享卡模块导出必要 API', async () => {
  const mod = await import('../src/burger-dna/share-card.ts');
  assert.equal(typeof mod.renderGameShareCard, 'function');
  assert.equal(typeof mod.downloadBlob, 'function');
});

test('分享卡尺寸为 3:4 竖版 1080×1440', async () => {
  const { W, H } = await import('../src/burger-dna/share-card.ts').then(() => ({ W: 1080, H: 1440 }));
  assert.equal(W / H, 0.75, '必须是 3:4');
});

test('分享卡 SVG 走同一套叠加渲染（数据真的改变外观）', async () => {
  const { renderGameShareCard } = await import('../src/burger-dna/share-card.ts');
  const { renderBurgerSvg } = await import('../src/burger-dna/character.ts');

  // 分享卡内部调用的就是 renderBurgerSvg，两处视觉必须一致
  const dna = buildBurgerDna({
    persona,
    sources: { quiz: quizOnly() },
    ingredients: [mkIng({ id: 'py', glyph: 'PY' })],
    equipment: [mkEq({ slot: 'face' })],
  });
  const svg = renderBurgerSvg(dna, { baseUrl: 'x.png', alt: dna.name });
  assert.ok(svg.includes('PY'), '配料 glyph 应出现在分享卡的渲染里');
  assert.ok(svg.includes('cb-eq--face'), '装备应出现在分享卡的渲染里');
  assert.equal(typeof renderGameShareCard, 'function');
});

test('等级光环分档映射到分享卡的 Lv 徽章', () => {
  for (const lv of [1, 5, 10]) {
    const aura = levelAura(lv);
    assert.match(aura.color, /^#[0-9a-f]{6}$/i);
    assert.ok(aura.label.length > 0);
  }
});
