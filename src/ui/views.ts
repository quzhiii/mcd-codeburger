/**
 * 四屏视图渲染。
 *
 * 纯 DOM 操作，无框架。每屏一个渲染函数，状态变化时重绘当前屏。
 */

import { QUESTIONS } from '../persona/questions.ts';
import { PERSONAS } from '../persona/personas.ts';
import type { AppState, Screen } from '../app/state.ts';
import { agentLine } from '../app/state.ts';
import { AGENT_STATE_META } from '../spec/burger-spec.ts';
import { renderShareCard, downloadBlob } from './share-card.ts';

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const personaAsset = (id: string): string => `assets/personas/${id}.png`;

/* ==================== 首屏 ==================== */

function renderIntro(_state: AppState): string {
  const featured = PERSONAS[0]!;
  return `
    <div class="screen screen--intro">
      <div class="topbar">
        <span class="brand-en">CodeBurger</span>
        <span class="brand-cn">麦门人格汉堡工厂</span>
      </div>

      <h1 class="title">今天，你是哪只汉堡？</h1>
      <p class="lead">答 5 道生活小题，现场组装出属于你的汉堡人格，
        再把它喂给自己的 Agent。</p>

      <div class="hero">
        <img class="hero__img" src="${personaAsset(featured.id)}" alt="示例角色" />
      </div>

      <button class="btn btn--primary" data-act="start">开始测试</button>

      <div class="feature-row">
        <div class="feature"><b>5 道题</b><span>约 40 秒</span></div>
        <div class="feature"><b>8 种人格</b><span>确定性映射</span></div>
        <div class="feature"><b>可导出</b><span>3:4 分享卡</span></div>
      </div>

      <p class="fine">不需要登录，答案不上传。趣味娱乐内容，非官方产品。</p>
    </div>`;
}

/* ==================== 测试屏 ==================== */

function renderQuiz(state: AppState): string {
  const q = QUESTIONS[state.qIndex];
  if (!q) return '';
  const picked = state.answers[q.id];

  return `
    <div class="screen screen--quiz">
      <div class="topbar">
        <span class="brand-en">CodeBurger</span>
        <span class="chip">第 ${state.qIndex + 1} / ${QUESTIONS.length} 题</span>
      </div>

      <div class="progress"><div class="progress__fill"
        style="width:${((state.qIndex / QUESTIONS.length) * 100).toFixed(1)}%"></div></div>

      <h2 class="q-title">${esc(q.prompt)}</h2>

      <div class="options">
        ${q.options
          .map(
            (o, i) => `
          <button class="option ${picked === o.id ? 'is-picked' : ''}" data-act="answer" data-opt="${esc(o.id)}">
            <span class="option__key">${'ABCD'[i]}</span>
            <span class="option__label">${esc(o.label)}</span>
          </button>`,
          )
          .join('')}
      </div>

      <button class="btn btn--ghost" data-act="back-intro">重来</button>
    </div>`;
}

/* ==================== 生成屏 ==================== */

function renderBurger(state: AppState): string {
  if (!state.result) return '';
  const p = state.result.persona;
  const axes = [
    ['面包', p.visual.bun],
    ['夹层', p.visual.filling],
    ['装饰', p.visual.prop],
    ['服装', p.visual.outfit],
    ['表情', p.visual.expression],
  ];

  return `
    <div class="screen screen--burger">
      <div class="topbar">
        <span class="brand-en">CodeBurger</span>
        <span class="chip" style="background:${hexA(p.visual.color, 0.14)};
          border-color:${hexA(p.visual.color, 0.35)};color:${p.visual.color}">已生成</span>
      </div>

      <div class="hero hero--assemble">
        <img class="hero__img hero__img--assemble" src="${personaAsset(p.id)}" alt="${esc(p.name)}" />
      </div>

      <h2 class="result-name">${esc(p.name)}</h2>
      <p class="result-keyword" style="color:${p.visual.color}">${esc(p.keyword)}</p>
      <p class="result-tagline">${esc(p.tagline)}</p>

      <div class="axes">
        ${axes
          .map(
            ([k, v]) => `
          <div class="axes__row">
            <span class="axes__k">${k}</span>
            <span class="axes__v">${esc(v)}</span>
          </div>`,
          )
          .join('')}
      </div>

      ${renderGithubSection(state)}

      <button class="btn btn--primary" data-act="go-feed">去喂Agent</button>
    </div>`;
}

/* ---- GitHub 加料区块 ---- */

function renderGithubSection(state: AppState): string {
  const status = state.githubStatus;
  const msg =
    status === 'loading'
      ? '正在读公开仓库…'
      : status === 'error'
        ? state.githubMessage
        : status === 'ok'
          ? state.githubMessage
          : '';

  const profile = state.githubProfile;

  return `
    <div class="block">
      <div class="block__head">
        <span class="block__title">用 GitHub 加料</span>
        <span class="block__sub">只读公开数据</span>
      </div>

      <div class="card">
        ${profile
          ? `<div class="gh-profile">
               <span class="gh-profile__name">@${esc(profile.username)}</span>
               <span class="gh-profile__meta">${profile.publicRepos} 个公开仓库 · ${profile.totalStars} star</span>
             </div>
             ${profile.languages.length
               ? `<div class="gh-langs">${profile.languages
                   .map((l) => `<span class="gh-lang">${esc(l)}</span>`)
                   .join('')}</div>`
               : ''}`
          : ''}

        <div class="gh-row">
          <input class="gh-input" id="gh-input" type="text" placeholder="输入 GitHub 用户名"
            value="${profile ? esc(profile.username) : ''}" autocomplete="off" />
          <button class="btn btn--sm btn--accent" data-act="github" ${status === 'loading' ? 'disabled' : ''}>
            ${status === 'loading' ? '读取中' : profile ? '重新加料' : '加料'}
          </button>
        </div>

        ${msg ? `<p class="gh-msg ${status === 'error' ? 'is-error' : ''}">${esc(msg)}</p>` : ''}

        ${
          state.toppings.length
            ? `<div class="toppings">
                 ${state.toppings
                   .map(
                     (t) => `
                   <div class="topping">
                     <span class="topping__glyph">${esc(t.glyph)}</span>
                     <span class="topping__body">
                       <b>${esc(t.label)}</b>
                       <em>${esc(t.flavor)}</em>
                     </span>
                   </div>`,
                   )
                   .join('')}
               </div>
               <p class="fine">加料失败也不影响后面的玩法。</p>`
            : ''
        }
      </div>
    </div>`;
}

/* ==================== 投喂屏 ==================== */

function renderFeed(state: AppState): string {
  if (!state.result) return '';
  const p = state.result.persona;
  const meta = AGENT_STATE_META[state.feedState?.state ?? 'idle'];
  const pct = state.fullness;

  return `
    <div class="screen screen--feed">
      <div class="topbar">
        <span class="brand-en">CodeBurger</span>
        <span class="chip chip--warn">虚拟游戏机制</span>
      </div>

      <div class="feed-stage">
        <div class="feed-burger" id="feed-burger" role="button" tabindex="0"
          aria-label="点我喂 Agent">
          <img class="hero__img" src="${personaAsset(p.id)}" alt="${esc(p.name)}" />
          <div class="feed-crumbs" id="feed-crumbs"></div>
        </div>

        <div class="agent" style="border-color:${hexA(meta.color, 0.4)}">
          <div class="agent__head">
            <span class="agent__name">你的 Agent</span>
            <span class="agent__state" style="background:${meta.color}">${meta.label}</span>
          </div>
          <p class="agent__line">${esc(agentLine(state))}</p>
          <div class="meter">
            <div class="meter__fill" style="width:${pct}%;background:${meta.color}"></div>
          </div>
          <p class="meter__txt">饱腹度 ${pct}/100 · 累计投喂 ${state.toppings.length} 层配料</p>
        </div>
      </div>

      <button class="btn btn--primary" data-act="feed">喂一口</button>

      <div class="btn-row">
        <button class="btn btn--ghost btn--sm" data-act="go-burger">改配料</button>
        <button class="btn btn--ghost btn--sm" data-act="go-share">直接分享</button>
      </div>

      <p class="fine">投喂不增加任何真实 AI 额度，不涉及积分与优惠券。</p>
    </div>`;
}

/* ==================== 分享屏 ==================== */

function renderShare(state: AppState): string {
  if (!state.result || !state.spec) return '';
  const p = state.result.persona;
  const meta = AGENT_STATE_META[state.feedState?.state ?? 'idle'];

  return `
    <div class="screen screen--share">
      <div class="topbar">
        <span class="brand-en">CodeBurger</span>
        <span class="chip">3:4 分享卡</span>
      </div>

      <div class="share-preview" id="share-preview">
        <img class="hero__img" src="${personaAsset(p.id)}" alt="${esc(p.name)}" />
      </div>

      <div class="card">
        <div class="share-row">
          <span class="share-k">角色</span>
          <span class="share-v">${esc(p.name)}</span>
        </div>
        <div class="share-row">
          <span class="share-k">Agent 状态</span>
          <span class="share-v" style="color:${meta.color}">${meta.label}</span>
        </div>
        <div class="share-row">
          <span class="share-k">配料</span>
          <span class="share-v">${state.toppings.length} 层</span>
        </div>
      </div>

      <button class="btn btn--primary" data-act="export">生成并保存 PNG</button>

      <button class="btn btn--ghost" data-act="restart">再测一次</button>
    </div>`;
}

/* ==================== 分发 ==================== */

export function renderScreen(state: AppState): string {
  switch (state.screen as Screen) {
    case 'intro':
      return renderIntro(state);
    case 'quiz':
      return renderQuiz(state);
    case 'burger':
      return renderBurger(state);
    case 'feed':
      return renderFeed(state);
    case 'share':
      return renderShare(state);
    default:
      return '';
  }
}

/** 导出分享卡并触发下载 */
export async function exportShareCard(state: AppState): Promise<void> {
  if (!state.spec || !state.result) return;
  const blob = await renderShareCard({
    spec: state.spec,
    state: state.feedState?.state ?? 'idle',
    portraitUrl: personaAsset(state.result.persona.id),
    githubUsername: state.githubProfile?.username ?? null,
  });
  downloadBlob(blob, `codeburger-${state.result.persona.id}.png`);
}

function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}