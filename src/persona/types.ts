/**
 * CodeBurger 人格引擎 · 类型定义
 *
 * 重要声明：本模块是趣味娱乐内容，不具备心理测量学效度，
 * 不构成任何心理学、营养学或其他专业建议。
 */

/** 五个维度：E 社交能量 / D 决策力 / X 探索欲 / R 休息需求 / P 惊喜偏好 */
export type Dimension = 'E' | 'D' | 'X' | 'R' | 'P';

export const DIMENSIONS: readonly Dimension[] = ['E', 'D', 'X', 'R', 'P'] as const;

/** 五维向量，每维取值 -1 | 0 | 1 */
export type Vec5 = [number, number, number, number, number];

/** Agent 投喂反应，全部为虚拟游戏机制 */
export type AgentEffect = 'focus' | 'inspiration' | 'bug' | 'slack';

export const AGENT_EFFECTS: readonly AgentEffect[] = [
  'focus',
  'inspiration',
  'bug',
  'slack',
] as const;

export type PersonaId =
  | 'chili-social'
  | 'night-slack'
  | 'cheese-spark'
  | 'calm-double'
  | 'plan-drumstick'
  | 'risky-cod'
  | 'shaky-hashbrown'
  | 'zen-veggie';

/** 面包形态：8 个角色共用同一基底，只换面包轮廓 */
export type BunShape =
  | 'classic-dome'
  | 'squashed'
  | 'puffy'
  | 'flat-square'
  | 'wonky'
  | 'scorched'
  | 'wholegrain';

export interface QuizOption {
  id: string;
  label: string;
  /** 该选项对各维度的加分，未出现的维度记 0 */
  weights: Partial<Record<Dimension, number>>;
}

export interface QuizQuestion {
  id: string;
  dimension: Dimension;
  prompt: string;
  options: QuizOption[];
}

/**
 * 五轴视觉规格。差异**只**出现在这五个轴上，
 * 其余（圆润轮廓、双手双脚、层叠结构、光照与描边）全部共用。
 */
export interface PersonaVisual {
  bun: string;
  filling: string;
  prop: string;
  outfit: string;
  expression: string;
  /** 主色，用于剪影辨识与 120px 小尺寸缩略 */
  color: string;
  bunShape: BunShape;
}

export interface Persona {
  id: PersonaId;
  name: string;
  keyword: string;
  /** 一句有梗的自我描述 */
  tagline: string;
  vec: Vec5;
  agentEffect: AgentEffect;
  visual: PersonaVisual;
}

/** 答题结果：题目 id -> 选项 id */
export type AnswerSheet = Record<string, string>;

export interface PersonaResult {
  persona: Persona;
  vec: Vec5;
  /** 用于复现的最小答案指纹，选项按 questionId 升序拼接 */
  answerKey: string;
}
