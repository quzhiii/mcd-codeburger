/**
 * 视觉 Gate 用的汉堡角色矢量画法（草稿版）。
 *
 * 说明：
 * - 这是**设计稿阶段**的画法，用统一基底 + 五个可换的轴（面包 / 夹层 / 装饰 / 服装 / 表情）拼出 8 个角色。
 * - 视觉 Gate 通过后，这套画法会原样移植进 `src/renderer/`，再由美术补完整资产。
 * - 刻意不走厚重 3D：全部是扁平 + 极轻渐变 + 暖色描边，贴合国内年轻用户的清爽审美。
 */

const W = 220;

/** 顶部面包的七种轮廓（base 底边 y=106） */
const BUN_SHAPES = {
  'classic-dome': {
    d: 'M 40 106 C 40 68 66 48 110 48 C 154 48 180 68 180 106 Z',
    faceCy: 82,
  },
  squashed: {
    d: 'M 42 106 C 42 82 70 68 110 68 C 150 68 178 82 178 106 Z',
    faceCy: 90,
  },
  puffy: {
    d: 'M 40 106 C 40 56 68 36 110 36 C 152 36 180 56 180 106 Z',
    faceCy: 74,
  },
  'flat-square': {
    d: 'M 44 106 L 44 74 Q 44 62 56 62 L 164 62 Q 176 62 176 74 L 176 106 Z',
    faceCy: 84,
  },
  /* 上窄下宽的硬朗梯形：计划鸡腿堡。和「淡定双层堡」的圆角方块拉开区分 */
  tapered: {
    d: 'M 46 106 L 56 68 Q 58 60 68 60 L 152 60 Q 162 60 164 68 L 174 106 Z',
    faceCy: 84,
  },
  wonky: {
    d: 'M 40 106 C 40 68 66 48 110 48 C 154 48 180 68 180 106 Z',
    faceCy: 82,
    transform: 'rotate(-6 110 106)',
  },
  /* 比圆顶更塌一点、整体微微歪：手抖薯饼堡。和「社牛辣椒堡」拉开区分 */
  scorched: {
    d: 'M 42 106 C 42 74 68 56 110 56 C 152 56 178 74 178 106 Z',
    faceCy: 84,
    transform: 'rotate(-3 110 106)',
  },
  wholegrain: {
    d: 'M 40 106 C 40 68 66 48 110 48 C 154 48 180 68 180 106 Z',
    faceCy: 82,
  },
};

/** 表情：眼睛 + 嘴 */
function face(kind, cy, accent) {
  const ex1 = 92;
  const ex2 = 128;
  const my = cy + 14;
  const eye = (() => {
    switch (kind) {
      case 'laugh':
        return `
          <path d="M ${ex1 - 8} ${cy} q 8 -9 16 0" fill="none" stroke="#241A14" stroke-width="3.4" stroke-linecap="round"/>
          <path d="M ${ex2 - 8} ${cy} q 8 -9 16 0" fill="none" stroke="#241A14" stroke-width="3.4" stroke-linecap="round"/>`;
      case 'sleepy':
        return `
          <path d="M ${ex1 - 8} ${cy} h 16" stroke="#241A14" stroke-width="3.4" stroke-linecap="round"/>
          <path d="M ${ex2 - 8} ${cy} h 16" stroke="#241A14" stroke-width="3.4" stroke-linecap="round"/>`;
      case 'sparkle':
        return `
          <path d="M ${ex1} ${cy - 8} l 2.6 5.4 5.4 2.6 -5.4 2.6 -2.6 5.4 -2.6 -5.4 -5.4 -2.6 5.4 -2.6 z" fill="#241A14"/>
          <path d="M ${ex2} ${cy - 8} l 2.6 5.4 5.4 2.6 -5.4 2.6 -2.6 5.4 -2.6 -5.4 -5.4 -2.6 5.4 -2.6 z" fill="#241A14"/>`;
      case 'wide':
        return `
          <circle cx="${ex1}" cy="${cy}" r="7.6" fill="#FFFFFF" stroke="#241A14" stroke-width="2.4"/>
          <circle cx="${ex1}" cy="${cy}" r="3.4" fill="#241A14"/>
          <circle cx="${ex2}" cy="${cy}" r="7.6" fill="#FFFFFF" stroke="#241A14" stroke-width="2.4"/>
          <circle cx="${ex2}" cy="${cy}" r="3.4" fill="#241A14"/>`;
      case 'serious':
        return `
          <circle cx="${ex1}" cy="${cy}" r="4.6" fill="#241A14"/>
          <circle cx="${ex2}" cy="${cy}" r="4.6" fill="#241A14"/>`;
      case 'awkward':
        return `
          <ellipse cx="${ex1}" cy="${cy}" rx="4.4" ry="6" fill="#241A14"/>
          <path d="M ${ex2 - 8} ${cy + 2} q 8 -9 16 0" fill="none" stroke="#241A14" stroke-width="3.2" stroke-linecap="round"/>`;
      case 'calm':
      default:
        return `
          <path d="M ${ex1 - 8} ${cy + 3} q 8 -9 16 0" fill="none" stroke="#241A14" stroke-width="3.4" stroke-linecap="round"/>
          <path d="M ${ex2 - 8} ${cy + 3} q 8 -9 16 0" fill="none" stroke="#241A14" stroke-width="3.4" stroke-linecap="round"/>`;
    }
  })();

  const mouth = (() => {
    switch (kind) {
      case 'laugh':
        return `
          <ellipse cx="110" cy="${my}" rx="14" ry="10" fill="#7A2B22"/>
          <path d="M 100 ${my + 3} q 10 7 20 0 z" fill="#E2685A"/>`;
      case 'sleepy':
        return `<ellipse cx="110" cy="${my}" rx="9" ry="12" fill="#7A2B22"/>`;
      case 'sparkle':
        return `<ellipse cx="110" cy="${my - 1}" rx="9" ry="10" fill="#7A2B22"/>`;
      case 'wide':
        return `<ellipse cx="110" cy="${my - 1}" rx="6" ry="7.5" fill="#7A2B22"/>`;
      case 'serious':
        return `<path d="M 100 ${my} h 20" stroke="#241A14" stroke-width="3.2" stroke-linecap="round"/>`;
      case 'awkward':
        return `<path d="M 98 ${my - 1} q 6 -7 12 0 q 6 7 12 0" fill="none" stroke="#241A14" stroke-width="3.2" stroke-linecap="round"/>`;
      case 'calm':
      default:
        return `<path d="M 100 ${my - 2} q 10 10 20 0" fill="none" stroke="#241A14" stroke-width="3.4" stroke-linecap="round"/>`;
    }
  })();

  const blush =
    kind === 'laugh'
      ? `<ellipse cx="76" cy="${cy + 12}" rx="9" ry="6" fill="${accent}" opacity=".28"/>
         <ellipse cx="144" cy="${cy + 12}" rx="9" ry="6" fill="${accent}" opacity=".28"/>`
      : '';

  return `${blush}${eye}${mouth}`;
}

/** 顶包上的装饰：芝麻（数量可调） */
function sesame(shape, light) {
  const pts =
    shape === 'puffy'
      ? [
          [78, 62],
          [104, 52],
          [134, 58],
          [96, 74],
          [126, 78],
          [110, 88],
        ]
      : shape === 'squashed'
        ? [
            [78, 86],
            [104, 80],
            [134, 84],
            [92, 94],
            [128, 94],
          ]
        : [
            [76, 78],
            [104, 66],
            [136, 74],
            [90, 90],
            [130, 90],
            [110, 100],
            [62, 92],
            [158, 92],
          ];
  return pts
    .map(
      ([x, y]) =>
        `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="2.3" fill="${light}" opacity=".75" transform="rotate(-18 ${x} ${y})"/>`,
    )
    .join('');
}

/** 每个角色自己的小装饰（辣椒斑点 / 焦痕 / 全麦颗粒 / 手作歪斜） */
function texture(id, bunDark) {
  switch (id) {
    case 'chili-social':
      return [
        [70, 84],
        [148, 78],
        [110, 62],
        [92, 96],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#C8382A" opacity=".55"/>`)
        .join('');
    case 'shaky-hashbrown':
      return `
        <path d="M 66 92 q 10 -8 20 -2" stroke="#7A5230" stroke-width="4" stroke-linecap="round" fill="none" opacity=".5"/>
        <path d="M 132 70 q 12 -4 20 4" stroke="#7A5230" stroke-width="4" stroke-linecap="round" fill="none" opacity=".5"/>
        <ellipse cx="98" cy="66" rx="7" ry="4" fill="#7A5230" opacity=".28"/>`;
    case 'zen-veggie':
      return [
        [74, 86],
        [96, 74],
        [124, 68],
        [148, 84],
        [110, 92],
        [86, 60],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="${bunDark}" opacity=".45"/>`)
        .join('');
    case 'risky-cod':
      return `<path d="M 62 100 q 14 -12 30 -6" stroke="#0E7D74" stroke-width="3" stroke-linecap="round" fill="none" opacity=".35"/>`;
    default:
      return '';
  }
}

/** 头顶小道具 */
function prop(kind, accent) {
  switch (kind) {
    case 'megaphone':
      return `
        <g transform="translate(150 22) rotate(14)">
          <path d="M 0 10 L 22 2 L 22 26 L 0 18 Z" fill="${accent}"/>
          <rect x="-6" y="9" width="7" height="10" rx="3" fill="#241A14" opacity=".75"/>
          <path d="M 26 4 q 8 10 0 20" stroke="${accent}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
        </g>
        <g transform="translate(34 30) rotate(-20)">
          <rect x="0" y="0" width="5" height="26" rx="2.5" fill="#FFD9A8"/>
          <path d="M 2.5 -4 l 3 6 6.5 0 -5 4.6 1.8 6.4 -6.3 -3.8 -6.3 3.8 1.8 -6.4 -5 -4.6 6.5 0 z" fill="${accent}"/>
        </g>`;
    case 'moon':
      return `
        <g transform="translate(146 20)">
          <path d="M 18 0 a 15 15 0 1 0 6 28 a 12 12 0 0 1 -6 -28 z" fill="#B7A1D6"/>
        </g>
        <g transform="translate(30 34) rotate(-14)">
          <rect x="0" y="0" width="30" height="20" rx="8" fill="#C9B8E8"/>
          <path d="M 0 10 q 6 -6 12 0 q 6 6 12 0" stroke="#A995CE" stroke-width="2.2" fill="none"/>
        </g>
        <g transform="translate(160 22)" opacity=".8">
          <path d="M 0 6 q 4 -7 9 0 q 5 -7 9 0" stroke="#B7A1D6" stroke-width="3" fill="none" stroke-linecap="round"/>
        </g>`;
    case 'bulb':
      return `
        <g transform="translate(150 16)">
          <circle cx="12" cy="12" r="12" fill="#FFD35C"/>
          <rect x="8" y="23" width="8" height="7" rx="2" fill="#B98700"/>
          <path d="M 12 -6 v -6 M 30 12 h 6 M -6 12 h -6 M 27 -3 l 5 -5 M -3 -3 l -5 -5" stroke="#FFC72C" stroke-width="3" stroke-linecap="round"/>
        </g>
        <g transform="translate(28 40)" opacity=".9">
          <path d="M 8 0 l 2.4 5 5 2.4 -5 2.4 -2.4 5 -2.4 -5 -5 -2.4 5 -2.4 z" fill="#FFC72C"/>
        </g>
        <g transform="translate(56 18)" opacity=".7">
          <path d="M 6 0 l 1.8 3.8 3.8 1.8 -3.8 1.8 -1.8 3.8 -1.8 -3.8 -3.8 -1.8 3.8 -1.8 z" fill="#FFD35C"/>
        </g>`;
    case 'tea':
      return `
        <g transform="translate(144 22)">
          <path d="M 0 6 h 26 l -3 16 h -20 z" fill="#EFE4D6"/>
          <path d="M 26 10 q 9 3 0 9" stroke="#D9C9B5" stroke-width="3" fill="none"/>
          <ellipse cx="13" cy="6" rx="13" ry="3.4" fill="#D9C9B5"/>
        </g>
        <g transform="translate(28 30)" opacity=".9">
          <ellipse cx="14" cy="10" rx="14" ry="8" fill="#FFFFFF" opacity=".9"/>
          <ellipse cx="26" cy="14" rx="9" ry="6" fill="#FFFFFF" opacity=".9"/>
          <ellipse cx="4" cy="15" rx="7" ry="5" fill="#FFFFFF" opacity=".9"/>
        </g>`;
    /* 小旗子 + 进度条：计划鸡腿堡 */
    case 'flag':
      return `
        <g transform="translate(152 16)">
          <rect x="0" y="0" width="4" height="48" rx="2" fill="#8C6A4A"/>
          <path d="M 4 2 L 36 13 L 4 24 Z" fill="#35618F"/>
        </g>
        <g transform="translate(30 32)">
          <rect x="0" y="0" width="36" height="9" rx="4.5" fill="#DCE7F4"/>
          <rect x="0" y="0" width="21" height="9" rx="4.5" fill="#35618F"/>
        </g>`;
    /* 指南针 + 小地图：冒险鳕鱼堡 */
    case 'compass':
      return `
        <g transform="translate(148 14)">
          <circle cx="15" cy="15" r="15" fill="#FFFFFF" stroke="#0E7D74" stroke-width="3"/>
          <path d="M 15 4 L 19.5 15 L 15 26 L 10.5 15 Z" fill="#E2503A"/>
          <circle cx="15" cy="15" r="2.6" fill="#0E7D74"/>
        </g>
        <g transform="translate(24 30)">
          <path d="M 0 0 q 12 -7 24 0 q 12 7 24 0 l 0 18 q -12 7 -24 0 q -12 -7 -24 0 z"
                fill="#F0E2C8" stroke="#C9B48E" stroke-width="2"/>
          <path d="M 18 0 v 18 M 34 0 v 18" stroke="#C9B48E" stroke-width="1.6" opacity=".7"/>
        </g>`;
    /* 创可贴 + 汗滴：手抖薯饼堡 */
    case 'bandage':
      return `
        <g transform="translate(138 14) rotate(-16)">
          <rect x="0" y="0" width="44" height="17" rx="8.5" fill="#F3D9B8" stroke="#C9A57E" stroke-width="2"/>
          <rect x="15" y="0" width="14" height="17" fill="#EBC7A0"/>
          <circle cx="18" cy="5" r="1.3" fill="#C9A57E"/><circle cx="26" cy="5" r="1.3" fill="#C9A57E"/>
          <circle cx="18" cy="12" r="1.3" fill="#C9A57E"/><circle cx="26" cy="12" r="1.3" fill="#C9A57E"/>
        </g>
        <g transform="translate(28 40)">
          <path d="M 0 0 q 7 9 0 14 q -7 -5 0 -14 z" fill="#7FCFE8"/>
          <path d="M 0 3 q 3 5 0 8" stroke="#FFFFFF" stroke-width="1.6" fill="none" opacity=".8"/>
        </g>`;
    /* 一片叶子 + 茶杯：佛系蔬菜堡 */
    case 'leaf-tea':
      return `
        <g transform="translate(30 24) rotate(18)">
          <path d="M 0 0 q 17 -11 28 0 q -11 11 -28 0 z" fill="#9CBF6B"/>
          <path d="M 2 0 h 24" stroke="#7A9E4C" stroke-width="1.6" fill="none"/>
        </g>
        <g transform="translate(146 24)">
          <path d="M 0 6 h 26 l -3 16 h -20 z" fill="#EFE4D6"/>
          <path d="M 26 10 q 9 3 0 9" stroke="#D9C9B5" stroke-width="3" fill="none"/>
          <ellipse cx="13" cy="6" rx="13" ry="3.4" fill="#D9C9B5"/>
        </g>`;
    default:
      return '';
  }
}

/**
 * 画一个汉堡角色。
 * @param {object} c 角色视觉配置
 * @param {object} [o] 选项：{ size, float }
 */
export function renderBurger(c, o = {}) {
  const shape = BUN_SHAPES[c.bunShape] || BUN_SHAPES['classic-dome'];
  const cy = shape.faceCy;
  const size = o.size || 220;
  const uid = `g-${c.id}`;
  const float = o.float ? ` cb-art--float` : '';

  const patty = c.patty
    ? `<rect x="38" y="126" width="144" height="26" rx="13" fill="${c.patty}"/>`
    : '';
  const lettuce = c.lettuce
    ? `<path d="M 38 118 h144 v6 q -9 10 -18 0 q -9 -10 -18 0 q -9 10 -18 0 q -9 -10 -18 0 q -9 10 -18 0 q -9 -10 -18 0 q -9 10 -18 0 q -9 -10 -18 0 z" fill="${c.lettuce}"/>`
    : '';
  const cheese = c.cheese
    ? `<path d="M 40 108 L 180 108 L 180 116 L 176 124 L 44 124 L 40 116 Z" fill="${c.cheese}"/>
       <circle cx="54" cy="124" r="5" fill="${c.cheese}"/>
       <circle cx="104" cy="127" r="6" fill="${c.cheese}"/>
       <circle cx="152" cy="124" r="5" fill="${c.cheese}"/>`
    : '';
  const extra = (c.layers || [])
    .map((l) => `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="${l.rx}" fill="${l.fill}"/>`)
    .join('');

  return `<svg class="cb-art${float}" viewBox="0 0 ${W} ${W}" width="${size}" height="${size}" role="img" aria-label="${c.name}">
  <defs>
    <linearGradient id="${uid}-bun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.bunLight}"/>
      <stop offset="1" stop-color="${c.bunDark}"/>
    </linearGradient>
    <clipPath id="${uid}-clip"><path d="${shape.d}"/></clipPath>
  </defs>

  <ellipse cx="110" cy="192" rx="56" ry="7" fill="#241A14" opacity=".08"/>

  <g>
    <path d="M 44 130 q -24 8 -27 26" stroke="${c.outfit}" stroke-width="11" fill="none" stroke-linecap="round"/>
    <circle cx="17" cy="156" r="9.5" fill="${c.bunDark}"/>
    <path d="M 176 130 q 24 8 27 26" stroke="${c.outfit}" stroke-width="11" fill="none" stroke-linecap="round"/>
    <circle cx="203" cy="156" r="9.5" fill="${c.bunDark}"/>
  </g>

  <path d="M 66 174 h 26 v 8 a 6 6 0 0 1 -6 6 h -14 a 6 6 0 0 1 -6 -6 z" fill="${c.shoe}"/>
  <path d="M 128 174 h 26 v 8 a 6 6 0 0 1 -6 6 h -14 a 6 6 0 0 1 -6 -6 z" fill="${c.shoe}"/>

  <path d="M 42 148 L 178 148 L 178 158 Q 178 176 156 176 L 64 176 Q 42 176 42 158 Z" fill="${c.bunDark}"/>
  ${extra}
  ${patty}
  ${lettuce}
  ${cheese}
  <rect x="44" y="100" width="132" height="12" rx="6" fill="${c.outfit}"/>
  <rect x="44" y="100" width="132" height="4" rx="2" fill="#FFFFFF" opacity=".22"/>

  <g${shape.transform ? ` transform="${shape.transform}"` : ''}>
    <path d="${shape.d}" fill="url(#${uid}-bun)"/>
    <g clip-path="url(#${uid}-clip)">
      ${sesame(c.bunShape, c.sesameColor)}
      ${texture(c.id, c.bunDark)}
    </g>
    <path d="${shape.d}" fill="none" stroke="#241A14" stroke-width="2.4" opacity=".14" stroke-linejoin="round"/>
    <g>${face(c.face, cy, c.accent)}</g>
  </g>

  ${prop(c.prop, c.accent)}
</svg>`;
}

/** 8 个角色的视觉配置（与 src/persona/personas.ts 的 visual 字段一一对应） */
export const ART = {
  'chili-social': {
    id: 'chili-social',
    name: '社牛辣椒堡',
    bunShape: 'classic-dome',
    bunLight: '#FFD08A',
    bunDark: '#F0A452',
    sesameColor: '#FFF3DC',
    patty: '#8C3A26',
    cheese: '#FFC72C',
    lettuce: null,
    layers: [{ x: 40, y: 112, w: 140, h: 12, rx: 6, fill: '#C8382A' }],
    outfit: '#E2503A',
    shoe: '#3A2A20',
    face: 'laugh',
    prop: 'megaphone',
    accent: '#E23B26',
  },
  'night-slack': {
    id: 'night-slack',
    name: '深夜摸鱼堡',
    bunShape: 'squashed',
    bunLight: '#C9A57E',
    bunDark: '#9A7350',
    sesameColor: '#E8D6BE',
    patty: '#5F4331',
    cheese: null,
    lettuce: '#6E9E58',
    layers: [],
    outfit: '#8E7BB5',
    shoe: '#4A3B33',
    face: 'sleepy',
    prop: 'moon',
    accent: '#8E7BB5',
  },
  'cheese-spark': {
    id: 'cheese-spark',
    name: '灵感芝士堡',
    bunShape: 'puffy',
    bunLight: '#FFE2A0',
    bunDark: '#F2C05C',
    sesameColor: '#FFF8E6',
    patty: '#9B6034',
    cheese: '#FFD35C',
    lettuce: null,
    layers: [{ x: 44, y: 116, w: 132, h: 10, rx: 5, fill: '#F7B92B' }],
    outfit: '#F0A93B',
    shoe: '#5A4630',
    face: 'sparkle',
    prop: 'bulb',
    accent: '#F7B92B',
  },
  'calm-double': {
    id: 'calm-double',
    name: '淡定双层堡',
    bunShape: 'flat-square',
    bunLight: '#FBF3E6',
    bunDark: '#E3D5C2',
    sesameColor: '#FFFFFF',
    patty: '#8A6242',
    cheese: null,
    lettuce: '#8FBE6B',
    layers: [
      { x: 40, y: 126, w: 140, h: 14, rx: 7, fill: '#8A6242' },
      { x: 42, y: 140, w: 136, h: 12, rx: 6, fill: '#7A553A' },
    ],
    outfit: '#C7B9A6',
    shoe: '#6B5A4A',
    face: 'calm',
    prop: 'tea',
    accent: '#C7B9A6',
  },
};

/** 其余四个角色的配置，供预览条与八格设定表使用（沿用同一基底） */
export const ART_EXTRA = {
  'plan-drumstick': {
    ...ART['calm-double'],
    id: 'plan-drumstick',
    name: '计划鸡腿堡',
    bunShape: 'tapered',
    bunLight: '#DCE7F4',
    bunDark: '#8FB0D4',
    patty: '#B77A45',
    cheese: null,
    layers: [{ x: 40, y: 126, w: 140, h: 14, rx: 7, fill: '#B77A45' }],
    outfit: '#35618F',
    shoe: '#3F4A57',
    face: 'serious',
    prop: 'flag',
    accent: '#35618F',
  },
  'risky-cod': {
    ...ART['cheese-spark'],
    id: 'risky-cod',
    name: '冒险鳕鱼堡',
    bunShape: 'wonky',
    bunLight: '#CFF0EB',
    bunDark: '#7FCFC5',
    patty: '#D8B27A',
    cheese: null,
    lettuce: null,
    layers: [{ x: 42, y: 120, w: 136, h: 10, rx: 5, fill: '#16A79B', }],
    outfit: '#16A79B',
    shoe: '#2F5C57',
    face: 'wide',
    prop: 'compass',
    accent: '#16A79B',
  },
  'shaky-hashbrown': {
    ...ART['chili-social'],
    id: 'shaky-hashbrown',
    name: '手抖薯饼堡',
    bunShape: 'scorched',
    bunLight: '#E8C48E',
    bunDark: '#B98B4E',
    sesameColor: '#FFF0D8',
    patty: '#C8912F',
    cheese: null,
    layers: [{ x: 40, y: 114, w: 140, h: 10, rx: 5, fill: '#D8A83E' }],
    outfit: '#A9691F',
    shoe: '#5A3F1E',
    face: 'awkward',
    prop: 'bandage',
    accent: '#A9691F',
  },
  'zen-veggie': {
    ...ART['night-slack'],
    id: 'zen-veggie',
    name: '佛系蔬菜堡',
    bunShape: 'wholegrain',
    bunLight: '#E7EEDA',
    bunDark: '#B9CBA0',
    sesameColor: '#FFFFFF',
    patty: null,
    layers: [],
    lettuce: '#9CBF6B',
    outfit: '#9CBF6B',
    shoe: '#6B7A58',
    face: 'calm',
    prop: 'leaf-tea',
    accent: '#9CBF6B',
  },
};

export const ALL_ART = { ...ART, ...ART_EXTRA };
