/**
 * 网页主流程的 Burger DNA 装配。
 *
 * 网页端只拿得到两类数据：
 *   1. quiz   —— 5 道题的确定性结果（人格 + 五维向量）
 *   2. github —— 用户自己输入的公开用户名（虚拟配料 + 主力语言）
 *
 * MCP 来源的数据（订单 / 奖品 / 活动）只存在于本地 Skill 通路，
 * 公开网页永不直连（见 MCP_INTEGRATION.md），所以这里不装配 mcd 源。
 * 所有函数都是纯函数：同样的输入永远得到同样的输出，不做随机。
 *
 * 属性映射的口径（趣味映射，不是测评）：
 *   code      ← D 决策力（精算、系统性）+ P 惊喜偏好（敢改配方）
 *   creative  ← X 探索欲（尝鲜）+ P 惊喜偏好（想改就改）
 *   stamina   ← E 社交能量（能量足）+ 反向 R 休息需求（越不需要回血越持久）
 * 公式写死在 deriveAttributes 里，改动会直接反映到单测与角色卡上。
 */

import type { Persona, Vec5 } from '../persona/types.ts';
import type { VirtualTopping } from '../spec/burger-spec.ts';
import type { GithubProfile } from '../github/toppings.ts';
import { LANGUAGE_TOPPING } from '../github/toppings.ts';
import {
  buildBurgerDna,
  type BurgerDna,
  type DnaAttributes,
  type Equipment,
  type Ingredient,
} from './dna.ts';

/* ============================================================
 * 一、五维向量 → 三维属性
 * ============================================================ */

/** 属性下限/上限：留一点余量，避免出现 0 或 100 这种「练满/废掉」的极端读数 */
const ATTR_MIN = 8;
const ATTR_MAX = 95;

const clampAttr = (n: number): number =>
  Math.max(ATTR_MIN, Math.min(ATTR_MAX, Math.round(n)));

export function deriveAttributes(vec: Vec5): DnaAttributes {
  const [E, D, X, R, P] = vec;
  return {
    code: clampAttr(52 + D * 20 + P * 10),
    creative: clampAttr(52 + X * 22 + P * 14),
    stamina: clampAttr(50 + E * 16 - R * 26),
  };
}

/* ============================================================
 * 二、虚拟配料 → DNA 配料（带颜色与属性加成）
 * ============================================================ */

/** 语言 → 主色（贴近各家惯用色，整体压进暖色纸张语境） */
const LANGUAGE_COLOR: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#d99a00',
  Python: '#35618f',
  Java: '#b5651d',
  Go: '#00a8d0',
  Rust: '#b7410e',
  C: '#5c6b7a',
  'C++': '#1f6feb',
  'C#': '#7b3fa0',
  Ruby: '#c0392b',
  PHP: '#6d6fa8',
  Swift: '#f05138',
  Kotlin: '#7f52ff',
  Shell: '#5c6b7a',
  HTML: '#e34c26',
  CSS: '#2965f1',
  Vue: '#42b883',
  Dockerfile: '#2496ed',
};

/** glyph → 语言名，反向索引（配料对象只带 glyph，不带语言名） */
const GLYPH_TO_LANGUAGE = new Map(
  Object.entries(LANGUAGE_TOPPING).map(([lang, meta]) => [meta.glyph, lang]),
);

/** 兜底色板：未收录语言/任意配料用哈希稳定取色 */
const FALLBACK_PALETTE = [
  '#e23b26',
  '#d99a00',
  '#2c7a4b',
  '#35618f',
  '#a9691f',
  '#7f52ff',
  '#0fb5a6',
  '#c0392b',
];

function colorFromHash(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length]!;
}

/** 一个虚拟配料的主色。星级/仓库类固定色，语言按语言色，其余哈希取色。 */
export function toppingColor(topping: VirtualTopping): string {
  if (topping.id === 'repo-vigor') return '#d99a00';
  if (topping.id === 'repo-breadth') return '#c97b3c';
  const lang = GLYPH_TO_LANGUAGE.get(topping.glyph);
  if (lang && LANGUAGE_COLOR[lang]) return LANGUAGE_COLOR[lang]!;
  return colorFromHash(topping.id);
}

/** 配料 → 属性加成。语言偏工程、star 偏创造力、仓库规模偏续航。 */
export function toppingBoost(topping: VirtualTopping): Partial<DnaAttributes> {
  if (topping.id === 'repo-vigor') return { creative: 3 };
  if (topping.id === 'repo-breadth') return { stamina: 3 };
  return { code: 4, creative: 1 };
}

/** 虚拟配料列表 → DNA 配料列表（最多 6 层，与契约一致） */
export function toppingsToIngredients(toppings: VirtualTopping[]): Ingredient[] {
  return toppings.slice(0, 6).map((t, i) => ({
    id: t.id,
    label: t.label,
    taste: t.flavor,
    glyph: t.glyph,
    layer: i,
    color: toppingColor(t),
    source: 'github' as const,
    boost: toppingBoost(t),
  }));
}

/* ============================================================
 * 三、主力语言 → 手持装备
 * ============================================================ */

/**
 * 只有 GitHub 数据存在时才出手持装备（手持 = 你的主力语言工具）。
 * 单答题的 DNA 不带装备，角色保持干净底图，这是刻意的：
 * 「装备」是数据影响外观的最直观通道，留给它需要的数据。
 */
export function languageToEquipment(profile: GithubProfile | null): Equipment[] {
  const top = profile?.languages[0];
  if (!profile || !top) return [];
  const meta = LANGUAGE_TOPPING[top];
  const glyph = meta?.glyph ?? top.slice(0, 2).toUpperCase();
  return [
    {
      id: `lang-tool-${top.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      label: `${top} 工具`,
      slot: 'hand',
      glyph,
      color: LANGUAGE_COLOR[top] ?? colorFromHash(top),
      source: 'github',
    },
  ];
}

/* ============================================================
 * 四、装配入口
 * ============================================================ */

export interface WebDnaInput {
  persona: Persona;
  vec: Vec5;
  toppings: VirtualTopping[];
  github: GithubProfile | null;
}

/** 网页主流程的 DNA 装配：quiz 必选，github 可为空。 */
export function buildWebDna(input: WebDnaInput): BurgerDna {
  const { persona, vec, toppings, github } = input;

  const sources: BurgerDna['sources'] = {
    quiz: {
      source: 'quiz',
      vector: vec,
      personaId: persona.id,
      personaName: persona.name,
      color: persona.visual.color,
    },
  };
  if (github) {
    sources.github = {
      source: 'github',
      username: github.username,
      languages: github.languages,
      publicRepos: github.publicRepos,
      totalStars: github.totalStars,
      // 网页端只读用户与仓库概况，未抓 topics，不声称识别为 AI 项目
      topics: [],
      aiProject: false,
    };
  }

  return buildBurgerDna({
    persona: {
      id: persona.id,
      name: persona.name,
      keyword: persona.keyword,
      tagline: persona.tagline,
      visual: { color: persona.visual.color, bunShape: persona.visual.bunShape },
      agentEffect: persona.agentEffect,
    },
    attributes: deriveAttributes(vec),
    ingredients: toppingsToIngredients(toppings),
    equipment: languageToEquipment(github),
    sources,
  });
}
