/**
 * 麦门 DNA 推导引擎
 *
 * 输入：MCP 真机返回的原始订单 / 奖品 / 积分数据
 * 输出：McdDna（消费人格标签 + 口味偏好 + 统计依据）+ 对应的配料与装备
 *
 * 数据来源（全部为 2026-10-12 实测，结构见 docs）：
 * - `order-list`       历史订单：orderId / createTime / storeName / storeCode /
 *                      orderProductList[].productName / comboItemList[].name / realTotalAmount
 * - `query-my-prizes`  中奖记录：name / prizeType / recordTime / sourceDesc
 * - `query-my-account` 积分账户：accumulativePoint / availablePoint / usedPoint
 *
 * 诚实性约定
 * ----------
 * 1. **样本量必须显式带上**：只有 3 笔订单时说「你有稳定消费习惯」是编造。
 *    所以 `summary` 的措辞会按 orderCount 分档，样本少时用「就这几笔看」这种口径。
 * 2. **不做因果断言**：从「晚 19 点下过单」推出「你是晚餐派」是趣味归纳，
 *    不是统计结论，字段名与 UI 措辞都要体现这一点。
 * 3. **城市推断只取门店名里的城市 token**，不做地理推断，避免把「杭州滨江店」误判成别的。
 *
 * 合规：本模块是纯函数，输入由本地 Skill 从用户本人凭证调MCP 获得。
 * 它不联网、不读文件、不落盘。原始个人数据不应被复制进代码或仓库。
 */

import type { Equipment, Ingredient, McdDna } from './dna.ts';

/* ============================================================
 * 一、原始数据结构（对齐 MCP 真机返回）
 * ============================================================ */

export interface RawOrderItem {
  productName?: string;
  quantity?: number;
  comboItemList?: Array<{ name?: string; quantity?: number }>;
}

export interface RawOrder {
  orderId?: string;
  createTime?: string;
  storeName?: string;
  orderProductList?: RawOrderItem[];
  realTotalAmount?: string;
}

export interface RawPrize {
  name?: string;
  prizeType?: number;
  recordTime?: string;
  statusText?: string;
  sourceDesc?: string;
}

export interface RawPoints {
  accumulativePoint?: string;
  availablePoint?: string;
  usedPoint?: string;
}

export interface McdRawInput {
  orders?: RawOrder[];
  prizes?: RawPrize[];
  points?: RawPoints;
}

/* ============================================================
 * 二、词表：真实餐品 / 奖品 → 口味标签
 * ============================================================ */

/** 餐品名 → 口味标签。多标签按命中累加权重。 */
const FOOD_TASTE_RULES: Array<{ pattern: RegExp; tag: string; weight: number }> = [
  //辣味系
  { pattern: /辣|韩式.*辣|火腿扒|辣翅|辣薯|香辣|麻辣/, tag: '辣味', weight: 3 },
  // 鸡类
  { pattern: /鸡腿堡|鸡翅|麦辣鸡腿|鸡腿排|麦香鸡|脆汁鸡|炸鸡|上校|鸡块|麦乐鸡/, tag: '鸡肉', weight: 3 },
  // 牛肉类
  { pattern: /巨无霸|双牛|牛堡|安格斯|吉士汉堡|牛肉|培根蔬萃|不素之霸/, tag: '牛肉', weight: 3 },
  // 鱼类
  { pattern: /鱼|鳕鱼|鲈鱼/, tag: '鱼鲜', weight: 3 },
  // 芝士系
  { pattern: /芝士|吉士|奶酪|马苏里拉|拉丝/, tag: '芝士', weight: 2 },
  // 薯条类
  { pattern: /薯条|薯饼|摇摇薯|薯/, tag: '薯食', weight: 2 },
  // 甜品
  { pattern: /甜筒|新地|麦旋风|圆筒|冰淇淋|派|松饼|巧克力|可可|甜/, tag: '甜品', weight: 2 },
  // 早餐
  { pattern: /麦满分|早餐|松饼堡|厚松饼|咖啡|麦咖啡|拿铁|美式/, tag: '早餐', weight: 3 },
  // 饱腹主食
  { pattern: /饭|面|粥|卷|饼|三件套|四件套|套餐|超值/, tag: '主食控', weight: 1 },
  // 饮料
  { pattern: /可乐|雪碧|橙汁|牛奶|豆浆|茶|咖啡|饮/, tag: '饮料', weight: 1 },
];

/** 奖品名 → 口味标签（抽奖偏好比点单更能反映「想要什么」） */
const PRIZE_TASTE_RULES = FOOD_TASTE_RULES;

/* ============================================================
 * 三、时段划分
 * ============================================================ */

export type RhythmTag = '早餐党' | '午餐派' | '下午茶星人' | '晚餐派' | '夜宵党' | '深夜党';

const RHYTHM_LABEL: Record<string, RhythmTag> = {
  breakfast: '早餐党',
  lunch: '午餐派',
  tea: '下午茶星人',
  dinner: '晚餐派',
  supper: '夜宵党',
  lateNight: '深夜党',
};

/** 按小时判定时段。深夜的边界放宽到 23:00-04:59。 */
function rhythmOf(hour: number): keyof typeof RHYTHM_LABEL {
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 17) return 'tea';
  if (hour >= 17 && hour < 21) return 'dinner';
  if (hour >= 21 && hour < 23) return 'supper';
  return 'lateNight'; // 23:00-04:59
}

/** 解析 "2026-06-18 19:17:58"，取小时。解析失败返回 null。 */
function parseHour(time?: string): number | null {
  if (!time) return null;
  const m = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):/.exec(time);
  if (!m) return null;
  const h = Number(m[4]);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
}

/** 从门店名里取城市token，例如「麦当劳杭州滨江双城国际餐厅」→ 杭州 */
const CITY_PATTERN =
  /(北京|上海|天津|重庆|哈尔滨|长春|沈阳|大连|石家庄|太原|呼和浩特|济南|青岛|郑州|西安|兰州|西宁|银川|乌鲁木齐|南京|苏州|无锡|宁波|杭州|合肥|福州|厦门|南昌|长沙|武汉|广州|深圳|南宁|海口|成都|贵阳|昆明|拉萨|成都)/;

function parseCity(storeName?: string): string | null {
  if (!storeName) return null;
  const m = CITY_PATTERN.exec(storeName);
  return m ? m[1] : null;
}

/** 导出给单测：城市识别逻辑本身需要被验证 */
export function parseCityForTest(storeName?: string): string | null {
  return parseCity(storeName);
}

/* ============================================================
 * 四、消费人格原型
 * ============================================================ */

interface McdArchetype {
  id: string;
  label: string;
  /** 判定需要的口味标签组合 */
  requires: {
    tags: string[];
    minWeight: number;
    /** 若指定，则必须真有该时段的**下单**记录（不含抽奖时间） */
    rhythm?: 'breakfast' | 'lunch' | 'tea' | 'dinner' | 'supper' | 'lateNight';
  };
  summary: string;
  /** 对属性的加成 */
  boost: Partial<{ code: number; creative: number; stamina: number }>;
  ingredients: Array<Omit<Ingredient, 'source'>>;
  equipment?: Array<Omit<Equipment, 'source'>>;
}

/**
 * 消费人格原型。
 * 顺序即匹配优先级，第一个满足条件的胜出。
 * requires.minWeight 是「口味标签命中总权重」的下限，避免一笔订单就定性。
 */
const ARCHETYPES: McdArchetype[] = [
  {
    id: 'midnight-snacker',
    label: '深夜干饭人',
    requires: { tags: ['辣味', '鸡肉'], minWeight: 3, rhythm: 'lateNight' },
    summary: '深夜下单最勤，点单从不手软。',
    boost: { creative: 12, stamina: -6 },
    ingredients: [
      { id: 'night-sauce', label: '深夜辣酱', taste: '越晚越辣', glyph: '🌙', layer: 1, color: '#4a3f6b', boost: { creative: 6 } },
      { id: 'crispy-wing', label: '脆炸鸡翼', taste: '凌晨三点也要脆', glyph: '🍗', layer: 0, color: '#a9691f', boost: { stamina: 4 } },
    ],
    equipment: [{ id: 'moon-badge', label: '夜行动者徽章', slot: 'back', glyph: '☾', color: '#4a3f6b' }],
  },
  {
    id: 'spicy-explorer',
    label: '辣味探索家',
    requires: { tags: ['辣味'], minWeight: 3 },
    summary: '菜单上带「辣」的多看一眼。',
    boost: { creative: 10, code: 4 },
    ingredients: [
      { id: 'chili-glaze', label: '辣椒釉酱', taste: '先辣后香，回味长', glyph: '🌶', layer: 1, color: '#c8452c', boost: { creative: 6 } },
    ],
  },
  {
    id: 'morning-explorer',
    label: '早餐探索型',
    requires: { tags: ['早餐'], minWeight: 3 },
    summary: '早餐是雷打不动的第一件事。',
    boost: { stamina: 12, code: 4 },
    ingredients: [
      { id: 'morning-egg', label: '晨光蛋饼', taste: '一天从这一口开始', glyph: '🍳', layer: 0, color: '#f7b92b', boost: { stamina: 6 } },
    ],
    equipment: [{ id: 'sun-badge', label: '晨光徽章', slot: 'aura', glyph: '☀', color: '#f7b92b' }],
  },
  {
    id: 'protein-first',
    label: '蛋白质优先',
    requires: { tags: ['鸡肉', '牛肉'], minWeight: 4 },
    summary: '先看蛋白含量，再看别的。',
    boost: { stamina: 10, code: 6 },
    ingredients: [
      { id: 'double-patty', label: '双层肉饼', taste: '扎实，抗饿', glyph: '🥩', layer: 0, color: '#8b3a2e', boost: { stamina: 6 } },
    ],
  },
  {
    id: 'sweet-tooth',
    label: '甜品收集者',
    requires: { tags: ['甜品'], minWeight: 4 },
    summary: '甜品柜是第二个胃。',
    boost: { creative: 8, stamina: -4 },
    ingredients: [
      { id: 'sundae-scoop', label: '旋流冰淇淋球', taste: '转着转着就空了', glyph: '🍦', layer: 1, color: '#a5b8e8', boost: { creative: 5 } },
    ],
  },
  {
    id: 'steady-regular',
    label: '稳定发挥型',
    requires: { tags: ['主食控'], minWeight: 2 },
    summary: '不踩雷，每次都那几样。',
    boost: { stamina: 8, code: 2 },
    ingredients: [
      { id: 'steady-bun', label: '扎实底盘包', taste: '不出错就是优点', glyph: '🍞', layer: 0, color: '#c98d4a', boost: { stamina: 4 } },
    ],
  },
];

/** 兜底原型：口味信号不足时使用 */
const DEFAULT_ARCHETYPE: McdArchetype = {
  id: 'curious-taster',
  label: '好奇试味员',
  requires: { tags: [], minWeight: 0 },
  summary: '什么都试一点，还没定型。',
  boost: { creative: 8 },
  ingredients: [
    { id: 'trial-sauce', label: '试味酱', taste: '下一单换个口味', glyph: '🧪', layer: 1, color: '#16a79b', boost: { creative: 5 } },
  ],
};

/* ============================================================
 * 五、推导主函数
 * ============================================================ */

export interface McdAnalysis {
  dna: McdDna | null;
  ingredients: Ingredient[];
  equipment: Equipment[];
  /** 属性加成 */
  boost: Partial<{ code: number; creative: number; stamina: number }>;
}

export function analyzeMcd(raw: McdRawInput): McdAnalysis {
  const orders = raw.orders ?? [];
  const prizes = raw.prizes ?? [];
  const points = raw.points ?? {};

  // --- 若三样都没有数据，直接返回空，交给上层走「无MCP 数据」路径
  if (orders.length === 0 && prizes.length === 0 && !points.accumulativePoint) {
    return { dna: null, ingredients: [], equipment: [], boost: {} };
  }

  // --- 口味权重累加（订单 + 奖品）
  const tasteScore = new Map<string, number>();
  const addTaste = (name: string, weightScale: number, rules: typeof FOOD_TASTE_RULES) => {
    for (const rule of rules) {
      if (rule.pattern.test(name)) {
        tasteScore.set(rule.tag, (tasteScore.get(rule.tag) ?? 0) + rule.weight * weightScale);
      }
    }
  };

  let itemCount = 0;
  for (const o of orders) {
    for (const item of o.orderProductList ?? []) {
      itemCount += item.quantity ?? 1;
      if (item.productName) addTaste(item.productName, 1, FOOD_TASTE_RULES);
      for (const sub of item.comboItemList ?? []) {
        itemCount += sub.quantity ?? 1;
        if (sub.name) addTaste(sub.name, 0.6, FOOD_TASTE_RULES); // 子项权重略低
      }
    }
  }
  for (const pr of prizes) {
    if (pr.name) addTaste(pr.name, 0.8, PRIZE_TASTE_RULES);
  }

  const tasteTags = [...tasteScore.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);

  // --- 消费时段
  // 消费时段：只用真实下单时间。奖品的中奖时间是「什么时候抽奖」，
  // 不是「什么时候吃饭」，混进来会把晚餐派误判成深夜党。
  const rhythmCounter = new Map<string, number>();
  for (const o of orders) {
    const h = parseHour(o.createTime);
    if (h === null) continue;
    const r = rhythmOf(h);
    rhythmCounter.set(r, (rhythmCounter.get(r) ?? 0) + 1);
  }

  // 抽奖活跃时段单独统计，用于「深夜党」这类原型的判定
  const prizeRhythmCounter = new Map<string, number>();
  for (const pr of prizes) {
    const h = parseHour(pr.recordTime);
    if (h === null) continue;
    const r = rhythmOf(h);
    prizeRhythmCounter.set(r, (prizeRhythmCounter.get(r) ?? 0) + 1);
  }
  const topRhythm = [...rhythmCounter.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0];
  const rhythmTag = topRhythm ? RHYTHM_LABEL[topRhythm[0]]! : null;

  // --- 客单价区间
  const amounts = orders
    .map((o) => Number(o.realTotalAmount))
    .filter((n) => Number.isFinite(n) && n > 0);
  let spendRange: string | null = null;
  if (amounts.length >= 2) {
    const sorted = [...amounts].sort((a, b) => a - b);
    const lo = Math.floor(sorted[0]!);
    const hi = Math.ceil(sorted[sorted.length - 1]!);
    spendRange = lo === hi ? `${lo}` : `${lo}-${hi}`;
  }

  // --- 城市
  const cities = new Set<string>();
  for (const o of orders) {
    const c = parseCity(o.storeName);
    if (c) cities.add(c);
  }

  // --- 匹配合格原型
  const archetype =
    ARCHETYPES.find((a) => {
      const total = a.requires.tags.reduce((sum, tag) => sum + (tasteScore.get(tag) ?? 0), 0);
      if (total < a.requires.minWeight) return false;
      // 带时段要求的原型，必须真的有那个时段的消费记录
      if (a.requires.rhythm) {
        return (rhythmCounter.get(a.requires.rhythm) ?? 0) > 0;
      }
      return true;
    }) ?? DEFAULT_ARCHETYPE;

  // --- 积分 → 等级依据
  const acc = Number(points.accumulativePoint ?? 0);
  const levelBasis =
    Number.isFinite(acc) && acc > 0
      ? `累计积分 ${acc}${rhythmTag ? ` · 主时段 ${rhythmTag}` : ''}`
      : rhythmTag
        ? `时段分布 · 主时段 ${rhythmTag}`
        : '样本有限';

  // --- summary 措辞按样本量分档，不在小样本上说大话
  const summary = buildSummary(archetype, orders.length, tasteTags, rhythmTag, spendRange);

  const dna: McdDna = {
    source: 'mcd',
    archetype: archetype.label,
    summary,
    tasteTags: tasteTags.slice(0, 5),
    rhythmTag,
    stats: {
      orderCount: orders.length,
      itemCount,
      prizeCount: prizes.length,
      spendRange,
      cityCount: cities.size,
    },
    levelBasis,
  };

  return {
    dna,
    ingredients: archetype.ingredients.map((i) => ({ ...i, source: 'mcd' as const })),
    equipment: (archetype.equipment ?? []).map((e) => ({ ...e, source: 'mcd' as const })),
    boost: archetype.boost,
  };
}

/** 按样本量调整措辞。样本 < 5 时明确说「就这几笔看」。 */
function buildSummary(
  archetype: McdArchetype,
  orderCount: number,
  tasteTags: string[],
  rhythmTag: RhythmTag | null,
  spendRange: string | null,
): string {
  const parts: string[] = [];

  if (orderCount === 0) {
    parts.push('没有历史订单，但抽过的奖透露了你的口味');
  } else if (orderCount < 5) {
    parts.push(`就这几笔（${orderCount} 单）看，你是${archetype.label}`);
  } else {
    parts.push(`翻了 ${orderCount} 单，你是${archetype.label}`);
  }

  if (rhythmTag) parts.push(`主时段${rhythmTag}`);
  if (tasteTags.length > 0) parts.push(`偏好${tasteTags.slice(0, 2).join(' + ')}`);
  if (spendRange && orderCount >= 2) parts.push(`客单 ${spendRange}`);

  return parts.join(' · ');
}

/** 供 Skill 直接消费：把原始数据转成配料 + 装备 + 属性加成 */
export function mcdToIngredients(raw: McdRawInput): {
  ingredients: Ingredient[];
  equipment: Equipment[];
  boost: McdAnalysis['boost'];
  dna: McdDna | null;
} {
  const r = analyzeMcd(raw);
  return { ingredients: r.ingredients, equipment: r.equipment, boost: r.boost, dna: r.dna };
}