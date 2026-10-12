/**
 * Burger Character System
 *
 * 一只汉堡 = 基础图（base）+ 叠加层（overlay）。
 *
 * 为什么这么做
 * ------------
 * 现有 8 张角色图是整体渲染的成品图，GitHub 数据或 MCP 数据只能改文字描述，
 * 改不了样子。用户看到「我的代码数据加进来���汉堡还是那张图」，
 * 就没有「我在创造自己的 Agent」的感觉。
 *
 * 所以把视觉拆成两层：
 * - **base**：8 张现有角色图，决定汉堡的"体型"与基础表情
 * - **overlay**：SVG 叠加层，由 DNA 决定。每个配料、每件装备都会在图上
 *   产生可见变化——帽子、眼镜、芯片、星星、火焰、电路纹。
 *
 * 叠加层全部是程序化 SVG，不新增位图资源。好处：
 * 1. 任意组合都能渲染，不需要为 64 种组合各画一张图
 * 2. 颜色跟随 DNA的主色与配料色，视觉上自然统一
 * 3. 体积只有几 KB
 *
 * 诚实性约定：叠加层只是「视觉隐喻」，不是把这个配料加到了汉堡里。
 * 界面上不宣称这些配料会影响任何真实的 AI 能力。
 */

import type { BurgerDna, Equipment, Ingredient } from './dna.ts';

/** 画布尺寸。viewBox 用这个，调用方按需缩放。 */
export const STAGE = 400;

/** 角色图在舞台中的位置（与现有 512px 位图的比例对齐） */
const BASE_BOX = { x: 40, y: 30, w: 320, h: 320 };

export interface RenderOptions {
  /** 基础图 URL，如 `assets/personas/chili-social.png` */
  baseUrl: string;
  /** 无障碍描述 */
  alt: string;
  /** 层级越高越晚绘制 */
  showBase?: boolean;
}

/* ============================================================
 * 一、Overlay 视觉库
 * ============================================================ */

type EquipmentSlot = Equipment['slot'];

/**
 * 每个槽位的绘制函数。
 * 坐标以 STAGE=400 为基准。
 */
const EQUIPMENT_PAINTERS: Record<EquipmentSlot, (color: string, glyph: string) => string> = {
  // 头顶：帽子 / 徽章
  head: (color, glyph) => `
    <g class="cb-eq cb-eq--head">
      <path d="M132 96 L200 52 L268 96 Z" fill="${color}" opacity="0.92"/>
      <rect x="120" y="92" width="160" height="14" rx="7" fill="${color}"/>
      <circle cx="200" cy="76" r="9" fill="#fff" opacity="0.85"/>
      <text x="200" y="80" font-size="12" text-anchor="middle" fill="${color}">${escSvg(glyph)}</text>
    </g>`,

  // 面部：眼镜 / 芯片
  //
  // 定位说明：镜片必须落在底图的「眼睛」上。八张底图的五官位置略有差异
  // （辣椒堡眼睛 y≈132-148，芝士堡 y≈112-135），这里取能同时框住两者的
  // 折中坐标（镜片带 y 116-146，横跨两张图的眼距）。
  // 曾经写成 y176-206，整副眼镜掉在嘴巴下面，看起来像贴上去的。
  // 另：不再在镜片下方画 glyph 小字 —— 它会和中排配料章叠在一起，
  // 渲染出来就是一个悬浮的噪点。
  face: (color) => `
    <g class="cb-eq cb-eq--face">
      <rect x="136" y="116" width="48" height="30" rx="12" fill="none" stroke="${color}" stroke-width="6" opacity="0.95"/>
      <rect x="214" y="116" width="48" height="30" rx="12" fill="none" stroke="${color}" stroke-width="6" opacity="0.95"/>
      <path d="M184 131 L214 131" stroke="${color}" stroke-width="6"/>
    </g>`,

  // 颈部：围巾 / 围兜
  neck: (color) => `
    <g class="cb-eq cb-eq--neck">
      <path d="M156 268 Q200 292 244 268 L240 292 Q200 310 160 292 Z" fill="${color}" opacity="0.9"/>
    </g>`,

  // 手持：物品
  //
  // 位置说明：原来在 (296,196)，右下方正好压住第三枚配料章
  // （★ 星星酱，位置 275-317 × 225-267），★ 几乎被整个盖住。
  // 上移到举起的道具杆旁边（148-206），既不压配料章，也不压镜片，
  // 视觉上像是挂在道具上。
  hand: (color, glyph) => `
    <g class="cb-eq cb-eq--hand">
      <rect x="302" y="148" width="44" height="58" rx="10" fill="${color}" opacity="0.9"/>
      <text x="324" y="184" font-size="22" text-anchor="middle" fill="#fff">${escSvg(glyph)}</text>
    </g>`,

  // 背部：翅膀 / 装饰
  back: (color, glyph) => `
    <g class="cb-eq cb-eq--back">
      <ellipse cx="96" cy="200" rx="34" ry="58" fill="${color}" opacity="0.35"/>
      <ellipse cx="304" cy="200" rx="34" ry="58" fill="${color}" opacity="0.35"/>
      <text x="200" y="356" font-size="18" text-anchor="middle" fill="${color}">${escSvg(glyph)}</text>
    </g>`,

  // 光环：等级 / 稀有度
  aura: (color, glyph) => `
    <g class="cb-eq cb-eq--aura">
      <ellipse cx="200" cy="196" rx="150" ry="150" fill="none" stroke="${color}"
               stroke-width="3" stroke-dasharray="10 12" opacity="0.55"/>
      <text x="200" y="42" font-size="20" text-anchor="middle" fill="${color}">${escSvg(glyph)}</text>
    </g>`,
};

/** 配料 → 视觉落点。layer 越大越靠上。 */
interface IngredientVisual {
  /** 在角色身上的相对位置（0-1，0.5 为中心） */
  x: number;
  y: number;
  radius: number;
}

/** 配料层的默认落点：按 layer 从下往上排布在汉堡腰部 */
function ingredientPosition(layer: number, total: number): IngredientVisual {
  const slots = Math.max(1, total);
  // 从左到右排，最多一排 3 个，超出换行
  const perRow = Math.min(3, slots);
  const row = Math.floor(layer / perRow);
  const col = layer % perRow;
  const rowCount = Math.ceil(slots / perRow);
  const spacing = 96;
  const startX = 200 - ((Math.min(perRow, slots) - 1) * spacing) / 2;

  return {
    x: startX + col * spacing,
    y: 246 + row * 52 - (rowCount - 1) * 8,
    radius: 21,
  };
}

/* ============================================================
 * 二、SVG 转义
 * ============================================================ */

function escSvg(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
 * 三、渲染
 * ============================================================ */

/**
 * 渲染一只汉堡的完整 SVG。
 *
 * 绘制顺序（后画的在上）：
 * 1. 光环 / 背部装饰（aura, back）
 * 2. 基础角色图
 * 3. 配料层
 * 4. 面部装备（face）
 * 5. 头部装备（head）
 * 6. 颈部装备（neck）
 * 7. 手持装备（hand）
 *
 * 这样帽子在眼镜之上、背包在角色之后，符合空间直觉。
 */
export function renderBurgerSvg(dna: BurgerDna, opts: RenderOptions): string {
  const showBase = opts.showBase !== false;
  const parts: string[] = [];

  // --- 背景光晕：用 DNA 主色，让每只汉堡有自己的氛围
  parts.push(`
    <defs>
      <radialGradient id="cb-glow-${hash(dna.id)}" cx="50%" cy="42%" r="58%">
        <stop offset="0%" stop-color="${dna.color}" stop-opacity="0.26"/>
        <stop offset="100%" stop-color="${dna.color}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${STAGE}" height="${STAGE}" fill="url(#cb-glow-${hash(dna.id)})"/>`);

  const bySlot = new Map<EquipmentSlot, Equipment>();
  for (const eq of dna.equipment) {
    if (!bySlot.has(eq.slot)) bySlot.set(eq.slot, eq);
  }

  const paint = (slot: EquipmentSlot): string => {
    const eq = bySlot.get(slot);
    if (!eq) return '';
    const fn = EQUIPMENT_PAINTERS[slot];
    return fn ? fn(eq.color, eq.glyph) : '';
  };

  // 1) 光环与背部（角色之前）
  parts.push(paint('aura'));
  parts.push(paint('back'));

  // 2) 基础角色图
  if (showBase) {
    parts.push(`
      <image href="${escSvg(opts.baseUrl)}"
             x="${BASE_BOX.x}" y="${BASE_BOX.y}"
             width="${BASE_BOX.w}" height="${BASE_BOX.h}"
             preserveAspectRatio="xMidYMid meet"/>`);
  }

  // 3) 配料层
  dna.ingredients.forEach((ing, i) => {
    const pos = ingredientPosition(ing.layer, dna.ingredients.length);
    parts.push(renderIngredientChip(ing, pos, i));
  });

  // 4~7) 其余装备
  parts.push(paint('face'));
  parts.push(paint('head'));
  parts.push(paint('neck'));
  parts.push(paint('hand'));

  // 注意：`<svg` 必须紧跟反引号，前面不能有换行空白，
  // 否则输出会以"\n<svg" 开头，innerHTML 场景下会变成文本节点而非元素。
  return `<svg class="cb-stage" viewBox="0 0 ${STAGE} ${STAGE}" width="100%" height="100%"
     xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escSvg(opts.alt)}">
  ${parts.join('\n  ')}
</svg>`;
}

/** 单个配料：圆角方块 + glyph，带出现动画（靠 CSS class） */
function renderIngredientChip(ing: Ingredient, pos: IngredientVisual, index: number): string {
  const size = pos.radius * 2;
  return `
    <g class="cb-ing" style="--i:${index}">
      <rect x="${pos.x - pos.radius}" y="${pos.y - pos.radius}"
            width="${size}" height="${size}" rx="${size * 0.34}"
            fill="#fff" stroke="${ing.color}" stroke-width="3"/>
      <rect x="${pos.x - pos.radius + 3}" y="${pos.y - pos.radius + 3}"
            width="${size - 6}" height="${size - 6}" rx="${size * 0.28}"
            fill="${ing.color}" opacity="0.16"/>
      <text x="${pos.x}" y="${pos.y + pos.radius * 0.38}"
            font-size="${Math.round(pos.radius * 0.92)}" text-anchor="middle"
            fill="${ing.color}" font-weight="700">${escSvg(ing.glyph)}</text>
    </g>`;
}

/** 稳定 hash，用于 SVG defs id 唯一 */
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36).slice(0, 6);
}

/* ============================================================
 * 四、组件样式
 * ============================================================ */

/** 叠加层需要的 CSS。直接内联到页面，避免额外请求。 */
export const CHARACTER_STYLES = `
.cb-stage { display:block; width:100%; height:100%; overflow:visible; }
.cb-ing {
  transform-origin: center;
  animation: cbIngIn .42s cubic-bezier(.34,1.56,.64,1) backwards;
  animation-delay: calc(var(--i, 0) * 90ms + 120ms);
}
@keyframes cbIngIn {
  from { opacity:0; transform: translateY(10px) scale(.7); }
  to   { opacity:1; transform:none; }
}
.cb-eq { animation: cbEqIn .5s cubic-bezier(.34,1.56,.64,1) backwards; }
.cb-eq--aura, .cb-eq--back { animation-delay: .1s; }
.cb-eq--face { animation-delay: .26s; }
.cb-eq--head { animation-delay: .18s; }
.cb-eq--neck { animation-delay: .32s; }
.cb-eq--hand { animation-delay: .38s; }
@keyframes cbEqIn {
  from { opacity:0; transform: translateY(-8px) scale(.9); }
  to   { opacity:1; transform:none; }
}
@media (prefers-reduced-motion: reduce) {
  .cb-ing, .cb-eq { animation-duration:.01ms; animation-delay:0ms; }
}
`;

/* ============================================================
 * 五、等级光环
 * ============================================================ */

/**
 * 按等级返回光环颜色与标签。
 * 低等级低调，高等级明显——让「练级」有视觉反馈。
 */
export function levelAura(level: number): { color: string; label: string } {
  if (level >= 10) return { color: '#8a5cb8', label: '传说' };
  if (level >= 8) return { color: '#d99a00', label: '稀有' };
  if (level >= 5) return { color: '#0fb5a6', label: '优良' };
  return { color: '#a39284', label: '普通' };
}