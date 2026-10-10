/**
 * Burger Spec · 公共数据契约
 *
 * 这是 CodeBurger 唯一的「汉堡描述格式」。前端 Web 应用、本地 MCP Skill、
 * 以及任何外部工具想描述一只汉堡，都用这个 JSON 结构。
 *
 * 设计原则：
 * 1. 自包含 —— 一份 JSON 里包含渲染与展示所需的全部信息，不依赖外部 id 映射。
 * 2. 可校验 —— `validateBurgerSpec` 是纯函数，Skill 与前端都能调用。
 * 3. 分层诚实 —— `nutrition` 字段明确标注数据来源层级，绝不把真实餐品数据
 *    伪装成虚拟角色的属性。
 *
 * 合规红线：
 * - `spec.source = 'virtual'` 时，绝不允许出现 nutrition 数值。
 * - `spec.source = 'reference'` 时，必须带 `sourceUrl` 与 `fetchedAt`。
 */

/** 数据来源层级 */
export type SpecSource =
  /** 纯原创虚构角色，不含任何真实营养数据 */
  | 'virtual'
  /** 真实餐品参考，需授权后使用，必须带来源与抓取日期 */
  | 'reference';

/** 虚拟配料。全部为原创命名，不承载官方营养数值。 */
export interface VirtualTopping {
  /** 配料 id，snake_case */
  id: string;
  /** 中文显示名 */
  label: string;
  /** 一句话趣味描述 */
  flavor: string;
  /** Emoji 或短符号，用于轻量视觉标记 */
  glyph: string;
  /** 该配料对 Agent 状态的贡献（虚拟游戏机制） */
  agentBoost?: number;
}

/**
 * 真实营养参考数据。
 * 仅在 spec.source === 'reference' 时允许存在。
 * 这些数值是「某个真实餐品」的属性，不是「某只虚拟汉堡人格」的属性。
 */
export interface ReferenceNutrition {
  /** 真实餐品名称，如「猪柳蛋麦满分」 */
  productName: string;
  energyKcal: number;
  protein: number;
  fat: number;
  carbohydrate: number;
  sodium: number;
  calcium: number;
  /** 数据来源 URL */
  sourceUrl: string;
  /** 抓取日期 ISO 字符串。用于明示这不是实时数据。 */
  fetchedAt: string;
}

/** Agent 状态，全为页面内虚拟机制 */
export type AgentState = 'idle' | 'focus' | 'inspiration' | 'bug' | 'slack' | 'full';

/**
 * 汉堡人格的完整描述。
 * 这是本地 Skill 与 Web 端之间的唯一交换格式。
 */
export interface BurgerSpec {
  /** 契约版本，用于将来演进 */
  version: '1.0';
  /** 人格 id，需与 src/persona/personas.ts 一致 */
  personaId: string;
  /** 中文名，如「社牛辣椒堡」 */
  name: string;
  /** 性格关键词 */
  keyword: string;
  /** 一句话自我描述 */
  tagline: string;
  /** 主色 hex */
  color: string;
  /** 面包形态 */
  bunShape: string;
  /** 虚拟配料列表（可为空数组） */
  toppings: VirtualTopping[];
  /** 投喂后 Agent 进入的状态 */
  agentEffect: AgentState;
  /** 数据来源层级 */
  source: SpecSource;
  /** 仅 reference 层存在 */
  nutrition?: ReferenceNutrition;
  /** 配方版本号，便于回溯 */
  recipeVersion: string;
}

export const SPEC_VERSION = '1.0' as const;

/** Agent 状态的中文名与视觉色，Web 与 Skill 共用同一份定义 */
export const AGENT_STATE_META: Record<
  AgentState,
  { label: string; color: string; line: string }
> = {
  idle: { label: '待机', color: '#a39284', line: 'Agent 刚接上，还没开始干活。' },
  focus: { label: '专注', color: '#2c7a4b', line: '它把待办事项按顺序啃完了，异常安静。' },
  inspiration: { label: '灵感', color: '#d99a00', line: '它开始胡说八道，但其中两句像是有点道理。' },
  bug: { label: '出 Bug', color: '#c8452c', line: '它自信地改了一行，然后自信地改了回去。' },
  slack: { label: '摸鱼', color: '#5b7fa8', line: '它已读，然后陷入了一种有尊严的沉默。' },
  full: { label: '撑住了', color: '#8a5cb8', line: '它说需要缓一缓。汉堡已经吃完了。' },
};

/**
 * 校验一份 Burger Spec 是否合法。纯函数，无副作用。
 * @returns 错误列表，空数组表示通过
 */
export function validateBurgerSpec(spec: unknown): string[] {
  const errors: string[] = [];

  if (typeof spec !== 'object' || spec === null) {
    return ['spec 必须是对象'];
  }
  const s = spec as Record<string, unknown>;

  if (s.version !== SPEC_VERSION) {
    errors.push(`version 必须是 "${SPEC_VERSION}"，实际为 ${JSON.stringify(s.version)}`);
  }
  for (const key of ['personaId', 'name', 'keyword', 'tagline', 'color', 'bunShape', 'recipeVersion']) {
    if (typeof s[key] !== 'string' || s[key] === '') {
      errors.push(`${key} 必须是非空字符串`);
    }
  }
  if (!Array.isArray(s.toppings)) {
    errors.push('toppings 必须是数组');
  } else {
    for (const [i, t] of s.toppings.entries()) {
      if (typeof t !== 'object' || t === null) {
        errors.push(`toppings[${i}] 必须是对象`);
        continue;
      }
      const tp = t as Record<string, unknown>;
      for (const key of ['id', 'label', 'flavor', 'glyph']) {
        if (typeof tp[key] !== 'string' || tp[key] === '') {
          errors.push(`toppings[${i}].${key} 必须是非空字符串`);
        }
      }
    }
  }
  if (s.source !== 'virtual' && s.source !== 'reference') {
    errors.push(`source 必须是 "virtual" 或 "reference"，实际为 ${JSON.stringify(s.source)}`);
  }

  // 分层诚实校验：虚拟层不得携带营养数据
  if (s.source === 'virtual' && s.nutrition !== undefined) {
    errors.push('source=virtual 时不得包含 nutrition 字段（虚拟角色不承载真实营养数值）');
  }
  if (s.source === 'reference') {
    const n = s.nutrition as Record<string, unknown> | undefined;
    if (typeof n !== 'object' || n === null) {
      errors.push('source=reference 时必须包含 nutrition 字段');
    } else {
      for (const key of ['productName', 'sourceUrl', 'fetchedAt']) {
        if (typeof n[key] !== 'string' || n[key] === '') {
          errors.push(`nutrition.${key} 必须是非空字符串`);
        }
      }
      for (const key of ['energyKcal', 'protein', 'fat', 'carbohydrate', 'sodium', 'calcium']) {
        if (typeof n[key] !== 'number') {
          errors.push(`nutrition.${key} 必须是数字`);
        }
      }
    }
  }

  return errors;
}

/**
 * 从人格定义 + 配料构造一份合法 Spec。
 * 纯函数，保证 Web 端产出的 Spec 一定能通过校验。
 */
export function buildSpec(input: {
  persona: {
    id: string;
    name: string;
    keyword: string;
    tagline: string;
    visual: { color: string; bunShape: string };
    agentEffect: AgentState;
  };
  toppings?: VirtualTopping[];
  recipeVersion?: string;
}): BurgerSpec {
  return {
    version: SPEC_VERSION,
    personaId: input.persona.id,
    name: input.persona.name,
    keyword: input.persona.keyword,
    tagline: input.persona.tagline,
    color: input.persona.visual.color,
    bunShape: input.persona.visual.bunShape,
    toppings: input.toppings ?? [],
    agentEffect: input.persona.agentEffect,
    source: 'virtual',
    recipeVersion: input.recipeVersion ?? 'local-1',
  };
}