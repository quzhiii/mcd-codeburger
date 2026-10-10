/**
 * Agent 投喂机制。
 *
 * 合规红线：
 * 投喂的全部效果都是**页面内的虚拟游戏机制**。不增加任何真实 AI 额度、
 * 不发放任何优惠券或积分、不影响任何真实服务状态。页面上会明确标注这一点。
 */

import type { AgentState, VirtualTopping } from '../spec/burger-spec.ts';
import { AGENT_STATE_META } from '../spec/burger-spec.ts';

export interface FeedInput {
  /** 人格自带的基础效果 */
  baseEffect: AgentState;
  /** 当前配料（GitHub 加料或 Skill 提供的真实餐品参考配料） */
  toppings: VirtualTopping[];
  /** 当前饱腹度 0-100 */
  fullness: number;
}

export interface FeedResult {
  state: AgentState;
  /** 本次投喂后饱腹度 */
  fullness: number;
  /** Agent 说的一句话 */
  line: string;
  /** 玩家看到的反馈文本 */
  feedback: string;
  /** 本次获得的虚拟增益值，仅用于展示 */
  boost: number;
}

/** 各状态的饱腹度阈值 */
const THRESHOLD = {
  focus: 55,
  inspiration: 55,
  bug: 55,
  slack: 55,
  full: 100,
} as const;

/**
 * 一口的最低收益。
 * 没有配料时也要能推进饱腹度，否则「不做 GitHub 加料」的用户会永远卡在idle，
 * 投喂这一屏就失去意义。配料只影响推进快慢，不影响能不能玩。
 */
const BASE_BITE = 12;

/**
 * 一次投喂。
 * 饱腹度不足时维持当前状态；达到阈值才切换到人格对应状态。
 */
export function feed(input: FeedInput): FeedResult {
  const toppingBoost = input.toppings.reduce((sum, t) => sum + (t.agentBoost ?? 5), 0);
  const boost = BASE_BITE + toppingBoost;
  const next = Math.min(100, input.fullness + boost);

  if (next >= THRESHOLD.full) {
    return {
      state: 'full',
      fullness: next,
      line: '它说需要缓一缓。汉堡已经吃完了。',
      feedback: `饱腹度 ${next}/100，Agent 撑住了`,
      boost,
    };
  }

  if (next < THRESHOLD.focus) {
    return {
      state: input.baseEffect === 'idle' ? 'idle' : input.baseEffect,
      fullness: next,
      line: input.baseEffect === 'idle'
        ? 'Agent 咬了一口，还没尝出味道。'
        : AGENT_STATE_META[input.baseEffect].line,
      feedback: `饱腹度 ${next}/100，还不够它进入状态，再喂几口`,
      boost,
    };
  }

  return {
    state: input.baseEffect,
    fullness: next,
    line: AGENT_STATE_META[input.baseEffect].line,
    feedback: `饱腹度 ${next}/100，Agent 进入「${AGENT_STATE_META[input.baseEffect].label}」`,
    boost,
  };
}

/** Agent 在空闲时的碎碎念，按饱腹度分层 */
export function idleLine(fullness: number): string {
  if (fullness <= 0) return 'Agent 盯着你手里的汉堡，暂时没动。';
  if (fullness < 30) return '它咬了一小口，还在慢慢嚼。';
  if (fullness < 55) return '它加快了速度，看起来有点饿了。';
  if (fullness < 100) return '它吃得很快，但明显还没满足。';
  return '它已经吃饱了，但还是盯着汉堡看。';
}