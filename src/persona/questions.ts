import type { QuizQuestion } from './types.ts';

/**
 * 五道情境题。
 *
 * 设计约束（来自 PLAN_V3.1 修订二.3）：
 * - 全部是普通用户能理解的生活情境，**不得**出现「技术栈」「Bug」「代码」等程序员限定词。
 * - 每题必选一个选项，选项权重为 -1 / 0 / +1。
 * - 选项展示顺序可在前端随机化；权重与选项 **id** 绑定，不随展示顺序变化。
 */
export const QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1-friday-night',
    dimension: 'E',
    prompt: '周五晚上终于下班，你最想做的是',
    options: [
      { id: 'crowd', label: '叫上一群朋友出门', weights: { E: 1 } },
      { id: 'few', label: '找两三个熟人小聚', weights: {} },
      { id: 'lurk', label: '在群里潜水看别人聊', weights: {} },
      { id: 'alone', label: '一个人待着回血', weights: { E: -1 } },
    ],
  },
  {
    id: 'q2-new-menu',
    dimension: 'D',
    prompt: '走进一家没去过的店，点单时你会',
    options: [
      { id: 'coupon', label: '先看有没有优惠，算清楚再点', weights: { D: 1 } },
      { id: 'read-all', label: '把菜单从头到尾看一遍', weights: { D: 1 } },
      { id: 'ask-staff', label: '问店员推荐什么', weights: {} },
      { id: 'familiar', label: '直接点最眼熟的那样', weights: { D: -1 } },
    ],
  },
  {
    id: 'q3-new-shop',
    dimension: 'X',
    prompt: '听说附近开了家没听过的新店，你会',
    options: [
      { id: 'same-day', label: '当天就去试', weights: { X: 1 } },
      { id: 'research', label: '先搜评价研究一下', weights: {} },
      { id: 'wait', label: '等别人去过再说', weights: {} },
      { id: 'skip', label: '就算路过也不进去', weights: { X: -1 } },
    ],
  },
  {
    id: 'q4-after-work',
    dimension: 'R',
    prompt: '连着忙了一整天，晚上的你',
    options: [
      { id: 'lie-down', label: '只想躺着不动', weights: { R: 1 } },
      { id: 'coffee', label: '靠一杯咖啡撑住', weights: {} },
      { id: 'restless', label: '边躺边想着没做完的事', weights: {} },
      { id: 'still-going', label: '还能再战', weights: { R: -1 } },
    ],
  },
  {
    id: 'q5-hidden-item',
    dimension: 'P',
    prompt: '点单时发现一个你从没注意过的隐藏款，你会',
    options: [
      { id: 'order-it', label: '直接点来试', weights: {} },
      { id: 'photo', label: '先拍照发给朋友', weights: { P: 1 } },
      { id: 'ask-recipe', label: '先问清楚里面有什么', weights: {} },
      { id: 'remix', label: '按自己想法改一改', weights: { P: 1 } },
    ],
  },
];

/** 题库自检：题目数与每题的维度覆盖 */
export const QUESTION_COUNT = QUESTIONS.length;
export const COVERED_DIMENSIONS = QUESTIONS.map((q) => q.dimension);
