import { DIMENSIONS } from './types.ts';
import type { AnswerSheet, Dimension, Persona, PersonaResult, Vec5 } from './types.ts';
import { QUESTIONS } from './questions.ts';
import { PERSONAS } from './personas.ts';

/**
 * 确定性打分与人格映射。
 *
 * 规则：
 * 1. 每题必选一个选项 → 得到五维向量，每维 ∈ {-1, 0, +1}
 * 2. 对 8 个原型向量做加权欧氏距离，取最近的一个
 * 3. 距离并列时按 personaId 字典序取小
 * 4. 同答案必然得到同结果，无随机
 *
 * 关于「组合数」的两个数字，指的不是一回事：
 * - **1024 = 4^5**：答题组合数。每题 4 个选项，5 题 → 1024 份不同的答卷。
 *   测试枚举的就是这 1024 份，且要求 8 个角色全部被命中（无死角色）。
 * - **243 = 3^5**：五维**向量**的可能取值上限。1024 份答卷折叠到向量空间后，
 *   不同向量的个数不超过 243。测试断言 vectors.size <= 243。
 * 换句话说，1024 是答卷条数，243 是折叠后的向量数，两者不冲突。
 */

/** 各维度权重，默认等权。将来要调倾向性只改这里，不动算法。 */
export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  E: 1,
  D: 1,
  X: 1,
  R: 1,
  P: 1,
};

/** 把答案表折算成五维向量 */
export function scoreAnswers(answers: AnswerSheet): Vec5 {
  const vec: Vec5 = [0, 0, 0, 0, 0];
  for (const q of QUESTIONS) {
    const optionId = answers[q.id];
    if (optionId === undefined) continue;
    const option = q.options.find((o) => o.id === optionId);
    if (!option) continue;
    for (const dim of DIMENSIONS) {
      const w = option.weights[dim];
      if (typeof w === 'number') {
        vec[DIMENSIONS.indexOf(dim)] += w;
      }
    }
  }
  // 每题只选一项，故每维必然落在 [-1, 1]；这里做一次夹取以防将来改动
  return vec.map((v) => Math.max(-1, Math.min(1, v))) as Vec5;
}

/** 加权欧氏距离的平方（避免开根号，比较结果等价） */
function weightedDistanceSq(a: Vec5, b: Vec5): number {
  let sum = 0;
  for (let i = 0; i < DIMENSIONS.length; i += 1) {
    const dim = DIMENSIONS[i]!;
    const w = DIMENSION_WEIGHTS[dim];
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += w * d * d;
  }
  return sum;
}

/**
 * 五维向量 → 人格。
 * 距离并列时按 personaId 字典序取小，保证结果唯一且稳定。
 */
export function resolvePersona(vec: Vec5): Persona {
  const sorted = [...PERSONAS].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  let best = sorted[0]!;
  let bestDist = weightedDistanceSq(vec, best.vec);
  for (let i = 1; i < sorted.length; i += 1) {
    const candidate = sorted[i]!;
    const d = weightedDistanceSq(vec, candidate.vec);
    if (d < bestDist) {
      best = candidate;
      bestDist = d;
    }
    // d === bestDist 时不替换 → 保留字典序更小的那个
  }
  return best;
}

/** 用于复现的最小答案指纹：按 questionId 升序拼接 optionId */
export function buildAnswerKey(answers: AnswerSheet): string {
  return [...QUESTIONS]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((q) => `${q.id}:${answers[q.id] ?? '-'}`)
    .join('|');
}

/** 一步到位：答案表 → 完整结果 */
export function evaluate(answers: AnswerSheet): PersonaResult {
  const vec = scoreAnswers(answers);
  const persona = resolvePersona(vec);
  return { persona, vec, answerKey: buildAnswerKey(answers) };
}
