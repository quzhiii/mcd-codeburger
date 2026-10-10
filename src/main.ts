import './ui/styles/base.css';

import {
  initialState,
  answer,
  applyGithub,
  doFeed,
  go,
  reset,
  type AppState,
} from './app/state.ts';
import { exportShareCard, renderScreen } from './ui/views.ts';

/**
 * CodeBurger 入口。
 *
 * 合规红线（务必保持）：
 * 1. 本应用是纯静态前端，公众访客路径下不发起任何 MCP 调用。
 * 2. 不内置、不转发、不收集任何 MCP Token 或个人凭证。
 * 3. 所有「官方真实餐品」信息必须带来源与抓取日期标注，且不得描述为实时。
 * 4. Agent 投喂奖励全部是虚拟游戏机制，不得宣称增加任何真实 AI 额度。
 * 5. GitHub 加料只访问公开 API，不带 Token，不读私有仓库，失败可降级。
 */

let state: AppState = { ...initialState };
const app = document.querySelector<HTMLDivElement>('#app');

function paint(): void {
  if (!app) return;
  app.innerHTML = renderScreen(state);
  if (state.screen === 'burger') triggerAssembly();
  if (state.screen === 'feed') bindFeedStage();
}

/** 汉堡组装动效：分四层依次落位 */
function triggerAssembly(): void {
  const img = app?.querySelector<HTMLElement>('.hero__img--assemble');
  if (!img) return;
  img.classList.add('is-assembling');
  img.addEventListener(
    'animationend',
    () => img.classList.remove('is-assembling'),
    { once: true },
  );
}

/** 投喂区：点击即喂。饱腹度与状态变化由状态机决定。 */
function bindFeedStage(): void {
  const stage = app?.querySelector<HTMLElement>('#feed-burger');
  if (!stage) return;

  const bite = (ev: Event): void => {
    ev.preventDefault();
    state = doFeed(state);
    paint();
  };

  stage.addEventListener('click', bite);
  stage.addEventListener('keydown', (ev) => {
    const key = (ev as KeyboardEvent).key;
    if (key === 'Enter' || key === ' ') bite(ev);
  });
}

app?.addEventListener('click', async (ev) => {
  const target = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!target) return;
  const act = target.dataset.act;

  switch (act) {
    case 'start':
      state = go(state, 'quiz');
      paint();
      break;

    case 'answer': {
      const opt = target.dataset.opt;
      if (!opt) break;
      state = answer(state, opt);
      paint();
      break;
    }

    case 'back-intro':
      state = reset();
      paint();
      break;

    case 'go-feed':
      state = go(state, 'feed');
      paint();
      break;

    case 'go-burger':
      state = go(state, 'burger');
      paint();
      break;

    case 'go-share':
      state = go(state, 'share');
      paint();
      break;

    case 'feed':
      state = doFeed(state);
      paint();
      break;

    case 'github': {
      const input = app?.querySelector<HTMLInputElement>('#gh-input');
      const name = input?.value.trim() ?? '';
      if (!name) {
        state = { ...state, githubStatus: 'error', githubMessage: '先填一个 GitHub 用户名' };
        paint();
        break;
      }
      state = { ...state, githubStatus: 'loading', githubMessage: '' };
      paint();
      state = await applyGithub(state, name);
      paint();
      break;
    }

    case 'export':
      target.setAttribute('disabled', 'true');
      try {
        await exportShareCard(state);
      } catch (err) {
        console.error('[CodeBurger] 分享卡导出失败', err);
        alert('分享卡导出失败，换个浏览器再试一次');
      } finally {
        target.removeAttribute('disabled');
      }
      break;

    case 'restart':
      state = reset();
      paint();
      break;

    default:
      break;
  }
});

// 首屏
paint();

export {};