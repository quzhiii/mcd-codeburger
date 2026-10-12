/**
 * Burger DNA · 核心数据契约
 *
 * 这是 CodeBurger V4 的地基。一份 Burger DNA 描述一只「用户自己研发出来的 AI 汉堡 Agent」，
 * 由四个数据源融合而成：
 *
 *   1. quiz   —— 5 道人格测试（用户自己答）
 *   2. mcd    —— 麦当劳 MCP 真实数据（订单 / 奖品 / 积分 / 活动）
 *   3. github —— GitHub 公开仓库数据
 *   4. campaign —— MCP 活动日历里的限定事件
 *
 * 设计原则
 * --------
 * 1. **来源可追溯**：每个 DNA 片段都带 `source` 标记，UI 必须能区分
 *    「这是你答出来的」还是「这是从麦当劳数据读出来的」。不把推测包装成事实。
 * 2. **单源缺失不塌**：订单可能只有 3 笔，GitHub 可能没填，
 *    任何一个源缺失都要能生成完整可玩的结果，只是分析深度不同。
 * 3. **分层诚实**：真实营养数值只出现在 `nutritionRef` 里，
 *    且必须标注来源与抓取时间。虚拟属性（code / creative / stamina）
 *    是趣味映射，不是科学结论，字段命名上就要看出来。
 * 4. **可校验**：`validateBurgerDna` 是纯函数，Skill 与前端都调用。
 *
 * 合规红线
 * --------
 * - `mcd` 来源的数据只能由**使用者本人**在 WorkBuddy 对话中通过自己的凭证触发，
 *   由本地 Skill 生成本文件，再由用户手动导入网页。公开网页永不直连 MCP。
 * - 本文件可能包含个人消费信息（订单时间、门店、金额），**不得**随仓库分发、
 *   不得上传到任何服务器、不得写进 URL 查询串。
 */

/* ============================================================
 * 一、DNA 片段：四个数据源各自的贡献
 * ============================================================ */

/** 数据来源标记 */
export type DnaSource = 'quiz' | 'mcd' | 'github' | 'campaign' | 'derived';

export const DNA_SOURCE_LABEL: Record<DnaSource, string> = {
  quiz: '人格测试',
  mcd: '麦当劳 MCP',
  github: 'GitHub',
  campaign: '麦当劳活动',
  derived: '规则推导',
};

/** 1) 人格测试片段：来自 5 道题 */
export interface QuizDna {
  source: 'quiz';
  /** 五维原始向量，来自确定性映射引擎 */
  vector: [number, number, number, number, number];
  /** 命中的原型人格 id */
  personaId: string;
  /** 人格名，如「社牛辣椒堡」 */
  personaName: string;
  /** 主色 hex */
  color: string;
}

/** 2) 麦门 DNA 片段：来自 order-list / query-my-prizes / query-my-account */
export interface McdDna {
  source: 'mcd';
  /** 命中的消费人格标签，如「晚餐派」 */
  archetype: string;
  /** 一句话解读 */
  summary: string;
  /** 口味偏好标签，如「肉食」「辣味」「甜品」 */
  tasteTags: string[];
  /** 消费时段标签，如「晚餐派」「深夜党」 */
  rhythmTag: string | null;
  /** 统计依据，全部为派生量而非原始数据 */
  stats: {
    /** 统计用到的订单笔数 */
    orderCount: number;
    /** 抽样统计的餐品条目数 */
    itemCount: number;
    /** 抽样统计的奖品数 */
    prizeCount: number;
    /** 客单价区间，如「40-60」；样本不足时为 null */
    spendRange: string | null;
    /** 出现过的门店城市数 */
    cityCount: number;
  };
  /** 等级依据说明（如「累计积分 5824.7」） */
  levelBasis: string;
}

/** 3) GitHub 片段：来自公开仓库 */
export interface GithubDna {
  source: 'github';
  username: string;
  /** 主语言列表，最多 3 个 */
  languages: string[];
  publicRepos: number;
  totalStars: number;
  /** 仓库 topics 标签（若公开可得） */
  topics: string[];
  /** 是否识别为 AI 相关项目（按 topics / 仓库名关键词判定） */
  aiProject: boolean;
}

/** 4) 活动片段：来自 campaign-calendar */
export interface CampaignDna {
  source: 'campaign';
  /** 活动标题 */
  title: string;
  /** 活动文案摘要 */
  summary: string;
  /** 活动图片 URL（官方 CDN，非个人信息） */
  imageUrl: string | null;
  /** 生效日期 */
  date: string | null;
  /** 该活动解锁的限定配料 id 列表 */
  limitedToppingIds: string[];
}

/* ============================================================
 * 二、角色系统：DNA 如何变成可见的外观
 * ============================================================ */

/**
 * 配料。全部为原创虚构命名。
 *
 * 分层规则：`source: 'mcd'` 的配料可以**指向**真实餐品（例如「板烧鸡腿堡」是真实商品），
 * 但它的 `taste` 描述与 `boost` 数值是我们定义的趣味映射，不是官方数据。
 * 官方营养数值一律不进这里，只放在 nutritionRef。
 */
export interface Ingredient {
  id: string;
  label: string;
  /** 风味描述，趣味向 */
  taste: string;
  /** 视觉标记，短字或 emoji */
  glyph: string;
  /** 配料层数的位置，0=最底层 */
  layer: number;
  /** 该配料主色，用于叠加渲染 */
  color: string;
  source: DnaSource;
  /** 对属性的加成 */
  boost: Partial<DnaAttributes>;
}

/**
 * 装备。不改变汉堡本体，改变「穿戴」，
 * 是 GitHub / MCP 数据影响视觉的主要通道。
 */
export interface Equipment {
  id: string;
  label: string;
  /** 装备槽位，决定叠放在角色的哪个位置 */
  slot: 'head' | 'face' | 'neck' | 'hand' | 'back' | 'aura';
  glyph: string;
  color: string;
  source: DnaSource;
}

/* ============================================================
 * 三、属性与等级
 * ============================================================ */

/** 三个核心属性，0-100 */
export interface DnaAttributes {
  /** 代码力 */
  code: number;
  /** 创造力 */
  creative: number;
  /** 续航（稳定性） */
  stamina: number;
}

export const ATTRIBUTE_KEYS: Array<keyof DnaAttributes> = ['code', 'creative', 'stamina'];

export const ATTRIBUTE_META: Record<
  keyof DnaAttributes,
  { label: string; desc: string; color: string }
> = {
  code: { label: '代码力', desc: '逻辑与工程直觉', color: '#35618f' },
  creative: { label: '创造力', desc: '想法的发散程度', color: '#d99a00' },
  stamina: { label: '续航力', desc: '稳定输出的持久度', color: '#2c7a4b' },
};

/** 等级 1-10，由综合分与数据完整度共同决定 */
export interface DnaLevel {
  level: number;
  /** 等级称号，如「实验室新人」 */
  title: string;
  /** 进入下一级还差多少分，null=已满级 */
  toNext: number | null;
  /** 等级如何算出来的，给人看的一句话 */
  basis: string;
}

/** 等级称号表，Lv1 → Lv10 */
export const LEVEL_TITLES: readonly string[] = [
  '实验室新人',
  '配料学徒',
  '煎台学徒',
  '稳定出餐',
  '风味调制师',
  '麦门研究员',
  'Agent 工程师',
  '配方架构师',
  '麦门实验室主管',
  '汉堡博士',
];

/* ============================================================
 * 四、真实营养参考（分层诚实）
 * ============================================================ */

/**
 * 真实营养参考。
 *
 * 只在 `source: 'reference'` 时允许存在，且必须带来源与抓取日期。
 * 界面展示时必须与虚拟属性分开，不可混排。
 */
export interface NutritionRef {
  /** 真实餐品名 */
  productName: string;
  energyKcal: number;
  protein: number;
  fat: number;
  carbohydrate: number;
  sodium: number;
  calcium: number;
  /** 数据来源标识 */
  sourceUrl: string;
  /** 抓取日期 ISO。非实时数据，必须展示。 */
  fetchedAt: string;
}

/* ============================================================
 * 五、Agent 状态与投喂
 * ============================================================ */

export type AgentState = 'idle' | 'focus' | 'inspiration' | 'bug' | 'slack' | 'full';

export const AGENT_STATE_META: Record<AgentState, { label: string; color: string; line: string }> = {
  idle: { label: '待机', color: '#a39284', line: 'Agent 刚接上，还没开始干活。' },
  focus: { label: '专注', color: '#2c7a4b', line: '它把待办事项按顺序啃完了，异常安静。' },
  inspiration: { label: '灵感', color: '#d99a00', line: '它开始胡说八道，但其中两句像是有点道理。' },
  bug: { label: '出 Bug', color: '#c8452c', line: '它自信地改了一行，然后自信地改了回去。' },
  slack: { label: '摸鱼', color: '#5b7fa8', line: '它已读，然后陷入了一种有尊严的沉默。' },
  full: { label: '撑住了', color: '#8a5cb8', line: '它说需要缓一缓。汉堡已经吃完了。' },
};

/** 投喂后可能触发的事件 */
export type FeedEventKind =
  | 'optimize'
  | 'bug-found'
  | 'unlock-topping'
  | 'mood'
  | 'overflow';

export interface FeedEvent {
  kind: FeedEventKind;
  /** 事件标题 */
  title: string;
  /** 事件正文 */
  detail: string;
  /** 该事件造成的属性变化 */
  delta: Partial<DnaAttributes>;
  /** 解锁的配料 id（kind 为 unlock-topping 时有值） */
  unlockToppingId?: string;
}

/* ============================================================
 * 六、完整 DNA
 * ============================================================ */

export const DNA_VERSION = '2.0' as const;

/**
 * 一份完整的 Burger DNA。
 *
 * 这是本地 Skill 与网页之间的唯一交换格式（V2 契约）。
 * 网页只接受本地文件导入，永不主动联网取数。
 */
export interface BurgerDna {
  version: typeof DNA_VERSION;
  /** 角色 id，形如 explorer_burger */
  id: string;
  /** 中文名，如「晚餐探索者」 */
  name: string;
  /** 一句话自我描述 */
  tagline: string;
  /** 主色 hex */
  color: string;

  /** 等级 */
  level: DnaLevel;
  /** 三维属性，0-100 */
  attributes: DnaAttributes;
  /** 配料列表，最多 6 层 */
  ingredients: Ingredient[];
  /** 装备列表 */
  equipment: Equipment[];
  /** Agent 基础状态 */
  agentEffect: AgentState;

  /** 四个数据源的实际贡献情况。未提供的源不出现 */
  sources: {
    quiz?: QuizDna;
    mcd?: McdDna;
    github?: GithubDna;
    campaign?: CampaignDna;
  };

  /** 数据完整度 0-100，用于等级计算与 UI 提示 */
  completeness: number;
  /** 仅真实营养参考层存在 */
  nutritionRef?: NutritionRef;

  /** 契约版本号之外的数据修订号，便于回溯 */
  recipeVersion: string;
}

/* ============================================================
 * 七、校验
 * ============================================================ */

const clampAttr = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** 校验并规范化 Burger DNA。返回错误列表，空数组表示通过。 */
export function validateBurgerDna(input: unknown): string[] {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null) return ['dna 必须是对象'];
  const d = input as Record<string, unknown>;

  if (d.version !== DNA_VERSION) {
    errors.push(`version 必须是 "${DNA_VERSION}"，实际 ${JSON.stringify(d.version)}`);
  }
  for (const key of ['id', 'name', 'tagline', 'color', 'recipeVersion'] as const) {
    if (typeof d[key] !== 'string' || (d[key] as string) === '') {
      errors.push(`${key} 必须是非空字符串`);
    }
  }

  // 等级
  const lv = d.level as Record<string, unknown> | undefined;
  if (!lv || typeof lv !== 'object') {
    errors.push('level 必须是对象');
  } else {
    if (typeof lv.level !== 'number' || lv.level < 1 || lv.level > 10) {
      errors.push('level.level 必须是 1-10 的整数');
    }
    if (typeof lv.title !== 'string' || lv.title === '') {
      errors.push('level.title 必须是非空字符串');
    }
    if (typeof lv.basis !== 'string' || lv.basis === '') {
      errors.push('level.basis 必须是非空字符串');
    }
  }

  // 属性
  const at = d.attributes as Record<string, unknown> | undefined;
  if (!at || typeof at !== 'object') {
    errors.push('attributes 必须是对象');
  } else {
    for (const key of ATTRIBUTE_KEYS) {
      const v = at[key];
      if (typeof v !== 'number' || Number.isNaN(v)) {
        errors.push(`attributes.${key} 必须是数字`);
      } else if (v < 0 || v > 100) {
        errors.push(`attributes.${key} 必须在 0-100 之间，实际 ${v}`);
      }
    }
  }

  // 配料
  if (!Array.isArray(d.ingredients)) {
    errors.push('ingredients 必须是数组');
  } else {
    if (d.ingredients.length > 6) {
      errors.push(`ingredients 最多 6 层，实际 ${d.ingredients.length}`);
    }
    for (const [i, ing] of d.ingredients.entries()) {
      if (typeof ing !== 'object' || ing === null) {
        errors.push(`ingredients[${i}] 必须是对象`);
        continue;
      }
      const it = ing as Record<string, unknown>;
      for (const key of ['id', 'label', 'taste', 'glyph', 'color'] as const) {
        if (typeof it[key] !== 'string' || (it[key] as string) === '') {
          errors.push(`ingredients[${i}].${key} 必须是非空字符串`);
        }
      }
      if (typeof it.layer !== 'number' || it.layer < 0) {
        errors.push(`ingredients[${i}].layer 必须是非负数字`);
      }
    }
  }

  // 装备
  if (!Array.isArray(d.equipment)) {
    errors.push('equipment 必须是数组');
  } else {
    const slots = new Set<string>();
    for (const [i, eq] of d.equipment.entries()) {
      if (typeof eq !== 'object' || eq === null) {
        errors.push(`equipment[${i}] 必须是对象`);
        continue;
      }
      const et = eq as Record<string, unknown>;
      for (const key of ['id', 'label', 'glyph', 'color'] as const) {
        if (typeof et[key] !== 'string' || (et[key] as string) === '') {
          errors.push(`equipment[${i}].${key} 必须是非空字符串`);
        }
      }
      const slot = et.slot as string;
      if (!['head', 'face', 'neck', 'hand', 'back', 'aura'].includes(slot)) {
        errors.push(`equipment[${i}].slot 非法：${slot}`);
      } else if (slots.has(slot)) {
        // 同一槽位只能有一件装备，叠加渲染会打架
        errors.push(`equipment[${i}].slot 重复占用：${slot}`);
      } else {
        slots.add(slot);
      }
    }
  }

  // 数据来源
  const src = d.sources as Record<string, unknown> | undefined;
  if (!src || typeof src !== 'object') {
    errors.push('sources 必须是对象');
  } else if (Object.keys(src).length === 0) {
    errors.push('sources 至少要有一个数据源');
  } else {
    for (const key of ['quiz', 'mcd', 'github', 'campaign']) {
      if (key in src && src[key] === undefined) {
        errors.push(`sources.${key} 不应为 undefined，要么给数据要么省略该键`);
      }
    }
  }

  // 完整度
  if (typeof d.completeness !== 'number' || d.completeness < 0 || d.completeness > 100) {
    errors.push('completeness 必须是 0-100 的数字');
  }

  // Agent 效果
  const effects: AgentState[] = ['idle', 'focus', 'inspiration', 'bug', 'slack', 'full'];
  if (!effects.includes(d.agentEffect as AgentState)) {
    errors.push(`agentEffect 非法：${JSON.stringify(d.agentEffect)}`);
  }

  // 分层诚实：真实营养参考必须带来源与日期
  if (d.nutritionRef !== undefined) {
    const nr = d.nutritionRef as Record<string, unknown>;
    if (typeof nr !== 'object' || nr === null) {
      errors.push('nutritionRef 必须是对象');
    } else {
      for (const key of ['productName', 'sourceUrl', 'fetchedAt'] as const) {
        if (typeof nr[key] !== 'string' || (nr[key] as string) === '') {
          errors.push(`nutritionRef.${key} 必须是非空字符串`);
        }
      }
      for (const key of ['energyKcal', 'protein', 'fat', 'carbohydrate', 'sodium', 'calcium']) {
        if (typeof nr[key] !== 'number') {
          errors.push(`nutritionRef.${key} 必须是数字`);
        }
      }
    }
  }

  return errors;
}

/* ============================================================
 * 八、构建与派生
 * ============================================================ */

export interface BuildDnaInput {
  persona: {
    id: string;
    name: string;
    keyword: string;
    tagline: string;
    visual: { color: string; bunShape: string };
    agentEffect: AgentState;
  };
  ingredients?: Ingredient[];
  equipment?: Equipment[];
  attributes?: Partial<DnaAttributes>;
  sources?: BurgerDna['sources'];
  campaign?: CampaignDna;
  nutritionRef?: NutritionRef;
  recipeVersion?: string;
}

/** 各来源对完整度的权重 */
const COMPLETENESS_WEIGHT = { quiz: 25, mcd: 30, github: 25, campaign: 20 } as const;

/** 依据实际提供的源计算完整度 */
export function computeCompleteness(sources: BurgerDna['sources']): number {
  let sum = 0;
  if (sources.quiz) sum += COMPLETENESS_WEIGHT.quiz;
  if (sources.mcd) sum += COMPLETENESS_WEIGHT.mcd;
  if (sources.github) sum += COMPLETENESS_WEIGHT.github;
  if (sources.campaign) sum += COMPLETENESS_WEIGHT.campaign;
  return Math.round(sum);
}

/**
 * 依据综合属性分 + 完整度计算等级。
 *
 * 属性分占 70%，完整度占 30%——这样「数据全」本身也是一种成就，
 * 但光有数据没有好属性也上不了高等级。
 */
export function computeLevel(
  attributes: DnaAttributes,
  completeness: number,
): DnaLevel {
  const attrScore = (attributes.code + attributes.creative + attributes.stamina) / 3;
  const score = attrScore * 0.7 + completeness * 0.3;
  // 分数 0-100 映射到 1-10 级
  const raw = Math.floor((score / 100) * 10) + 1;
  const level = Math.max(1, Math.min(10, raw));
  const index = Math.min(LEVEL_TITLES.length - 1, level - 1);
  const nextScore = ((level) / 10) * 100;
  const toNext = level >= 10 ? null : Math.max(1, Math.ceil(nextScore - score));

  return {
    level,
    title: LEVEL_TITLES[index]!,
    toNext,
    basis: `属性均分 ${attrScore.toFixed(0)} × 70% + 数据完整度 ${completeness} × 30%`,
  };
}

/** 把若干来源的属性加成叠加到基础值上，结果夹在 0-100 */
export function applyBoosts(
  base: Partial<DnaAttributes>,
  ingredients: Ingredient[],
): DnaAttributes {
  const acc: DnaAttributes = { code: 0, creative: 0, stamina: 0 };
  for (const key of ATTRIBUTE_KEYS) {
    let v = base[key] ?? 0;
    for (const ing of ingredients) {
      v += ing.boost[key] ?? 0;
    }
    acc[key] = clampAttr(v);
  }
  return acc;
}

/** 从人格与各源数据构建完整 DNA。纯函数，必定通过校验。 */
export function buildBurgerDna(input: BuildDnaInput): BurgerDna {
  const sources = input.sources ?? {};
  const completeness = computeCompleteness(sources);
  const ingredients = (input.ingredients ?? []).slice(0, 6);
  const equipment = dedupeSlots(input.equipment ?? []);
  const attributes = applyBoosts(input.attributes ?? {}, ingredients);
  const level = computeLevel(attributes, completeness);

  return {
    version: DNA_VERSION,
    id: input.persona.id,
    name: input.persona.name,
    tagline: `${input.persona.keyword} · ${input.persona.tagline}`,
    color: input.persona.visual.color,
    level,
    attributes,
    ingredients,
    equipment,
    agentEffect: input.persona.agentEffect,
    sources,
    completeness,
    nutritionRef: input.nutritionRef,
    recipeVersion: input.recipeVersion ?? 'local-1',
  };
}

/** 同槽位只保留最后一件，保证校验能过 */
function dedupeSlots(equipment: Equipment[]): Equipment[] {
  const seen = new Map<string, Equipment>();
  for (const eq of equipment) {
    if (!seen.has(eq.slot)) seen.set(eq.slot, eq);
    else seen.set(eq.slot, eq); // 后者覆盖前者
  }
  return [...seen.values()];
}