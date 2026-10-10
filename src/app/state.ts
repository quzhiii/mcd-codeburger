/**
 * CodeBurger 应用状态机。
 *
 * 四个屏幕串成一条完整主流程：
 *   intro  →  quiz  →  burger  →  feed  →  share
 *
 * 合规红线（务必保持）：
 * 1. 公开页面零 MCP 调用。GitHub 加料只访问公开 API，不带Token。
 * 2. 不收集、不上传任何个人信息。答案只存在内存与 localStorage。
 * 3. 所有 Agent 投喂奖励都是虚拟游戏机制。
 */

import { QUESTIONS, QUESTION_COUNT, evaluate } from '../persona/index.ts';
import { PERSONAS } from '../persona/personas.ts';
import type { AnswerSheet, Persona, PersonaResult } from '../persona/index.ts';
import { buildSpec, type BurgerSpec, type VirtualTopping } from '../spec/burger-spec.ts';
import { feed, idleLine, type FeedResult } from '../agent/feed.ts';
import { fetchGithubToppings, type GithubProfile } from '../github/toppings.ts';

export type Screen = 'intro' | 'quiz' | 'burger' | 'feed' | 'share';

export interface AppState {
  screen: Screen;
  /** 当前题序，从 0 开始 */
  qIndex: number;
  answers: AnswerSheet;
  result: PersonaResult | null;
  toppings: VirtualTopping[];
  githubProfile: GithubProfile | null;
  githubStatus: 'idle' | 'loading' | 'ok' | 'error';
  githubMessage: string;
  fullness: number;
  feedState: FeedResult | null;
  spec: BurgerSpec | null;
  /** 组装动效是否已播完 */
  assembled: boolean;
}

export const initialState: AppState = {
  screen: 'intro',
  qIndex: 0,
  answers: {},
  result: null,
  toppings: [],
  githubProfile: null,
  githubStatus: 'idle',
  githubMessage: '',
  fullness: 0,
  feedState: null,
  spec: null,
  assembled: false,
};

/** 状态转移表。非法转移直接抛错，避免界面上出现跳屏。 */
export function canTransition(from: Screen, to: Screen): boolean {
  const allowed: Record<Screen, Screen[]> = {
    intro: ['quiz'],
    quiz: ['quiz', 'burger', 'intro'],
    burger: ['feed', 'intro'],
    feed: ['share', 'burger', 'intro'],
    share: ['intro', 'feed'],
  };
  return allowed[from].includes(to);
}

/** 答题：记录答案并前进 */
export function answer(state: AppState, optionId: string): AppState {
  const q = QUESTIONS[state.qIndex];
  if (!q) return state;
  if (!q.options.some((o) => o.id === optionId)) return state;

  const answers = { ...state.answers, [q.id]: optionId };
  const nextIndex = state.qIndex + 1;

  if (nextIndex >= QUESTION_COUNT) {
    const result = evaluate(answers);
    return {
      ...state,
      screen: 'burger',
      qIndex: nextIndex,
      answers,
      result,
      assembled: false,
      spec: buildSpec({ persona: result.persona }),
    };
  }
  return { ...state, answers, qIndex: nextIndex };
}

/** 从任意人格直接跳转结果页（用于「看看别人」的调试入口） */
export function previewPersona(state: AppState, personaId: string): AppState {
  const persona: Persona | undefined = PERSONAS.find((p) => p.id === personaId);
  if (!persona) return state;
  const result: PersonaResult = {
    persona,
    vec: persona.vec,
    answerKey: 'preview',
  };
  return {
    ...state,
    screen: 'burger',
    qIndex: QUESTION_COUNT,
    result,
    assembled: false,
    spec: buildSpec({ persona }),
  };
}

/** 生成 Spec（把当前配料写进去） */
export function syncSpec(state: AppState): AppState {
  if (!state.result) return state;
  return {
    ...state,
    spec: buildSpec({
      persona: state.result.persona,
      toppings: state.toppings,
    }),
  };
}

/** GitHub 加料：异步，成功失败都不阻塞主流程 */
export async function applyGithub(state: AppState, username: string): Promise<AppState> {
  const loading: AppState = { ...state, githubStatus: 'loading', githubMessage: '' };
  const res = await fetchGithubToppings(username);

  if (res.ok) {
    const toppings = [...state.toppings, ...res.toppings];
    return {
      ...loading,
      toppings,
      githubProfile: res.profile,
      githubStatus: 'ok',
      githubMessage: `${res.profile.username} 的公开仓库已加料`,
      spec: state.result
        ? buildSpec({ persona: state.result.persona, toppings })
        : state.spec,
    };
  }

  return {
    ...loading,
    githubStatus: 'error',
    githubMessage: res.message,
  };
}

/** 投喂一次 */
export function doFeed(state: AppState): AppState {
  if (!state.result) return state;
  const res = feed({
    baseEffect: state.result.persona.agentEffect,
    toppings: state.toppings,
    fullness: state.fullness,
  });
  return { ...state, fullness: res.fullness, feedState: res };
}

/** 当前 Agent 台词 */
export function agentLine(state: AppState): string {
  if (state.feedState && state.fullness > 0) return state.feedState.line;
  return idleLine(state.fullness);
}

/** 重开一局 */
export function reset(): AppState {
  return { ...initialState };
}

export function go(state: AppState, to: Screen): AppState {
  if (!canTransition(state.screen, to)) return state;
  return { ...state, screen: to };
}