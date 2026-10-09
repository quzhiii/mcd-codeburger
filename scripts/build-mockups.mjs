/**
 * 视觉 Gate 页面构建脚本。
 *
 * 为什么用脚本生成而不是手写 4 个 HTML：
 *   四张稿子必须共用同一套设计 token、同一套角色画法、同一套组件样式。
 *   手写四份必然漂移。这里由一份共享 CSS + 一份共享画法渲染出四个自包含 HTML，
 *   保证「统一角色、字体、配色、动效风格」这条要求是**机制上成立**的，而不是靠人盯。
 *
 * 产物：mockups/01~04-*.html（每个文件自包含，双击即可打开，无外部依赖）
 * 运行：node scripts/build-mockups.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ART, ART_EXTRA, renderBurger } from './mockup-art.mjs';
import { PERSONAS } from '../src/persona/personas.ts';

/** 文案唯一事实来源：src/persona/personas.ts */
const PERSONA = Object.fromEntries(PERSONAS.map((p) => [p.id, p]));
const artOf = (id) => ART[id] || ART_EXTRA[id];

const OUT_DIR = path.resolve('mockups');
const artSource = readFileSync(new URL('./mockup-art.mjs', import.meta.url), 'utf8').replace(/^export /gm, '');

// ---------------------------------------------------------------------------
// 设计 token 与组件样式（四张稿共用，改这里四张一起变）
// ---------------------------------------------------------------------------
const CSS = `
/* 风格方向：暖色轻拟物。
   角色资产是厚涂 3D 渲染，纯白卡片会被它压得发飘，所以卡片改成暖白，
   描边加重一档，投影改成「外投影 + 顶部内高光」，让角色有个能站住的托盘。 */
:root{
  --bg:#FFF7EC; --card:#FFFCF7;
  --ink:#241A14; --ink-2:#5C4B3F; --ink-3:#93816F;
  --brand:#E23B26; --accent:#FFC72C; --teal:#0FB5A6; --violet:#8E7BB5;
  --line:rgba(36,26,20,.10); --line-2:rgba(36,26,20,.16);
  --r-xl:26px; --r-lg:20px; --r-md:14px; --r-sm:10px;
  --sh:0 10px 26px rgba(36,26,20,.07), inset 0 1px 0 rgba(255,255,255,.92);
  --sh-2:0 16px 36px rgba(36,26,20,.11), inset 0 1px 0 rgba(255,255,255,.95);
  --pad:20px;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0}
body{
  background:var(--bg); color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased; font-size:15px; line-height:1.6;
}
.cb-page{
  width:100%; max-width:430px; margin:0 auto; min-height:100vh; padding-bottom:44px;
  background:radial-gradient(125% 55% at 50% -4%, #FFEDD2 0%, #FFF7EC 60%);
}
.cb-page--plain{background:var(--bg)}

/* ---------- 顶栏 ---------- */
.cb-topbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px var(--pad) 8px}
.cb-brand{display:flex;align-items:baseline;gap:8px;min-width:0}
.cb-brand__en{font-size:19px;font-weight:800;letter-spacing:-.3px;color:var(--brand)}
.cb-brand__cn{font-size:12px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cb-topbar{flex-wrap:nowrap}
.cb-topbar > .cb-chip,.cb-topbar > span.cb-chip{flex:0 0 auto}
.cb-chip{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:999px;
  background:var(--card);border:1px solid var(--line);font-size:11px;font-weight:600;color:var(--ink-2);white-space:nowrap}
.cb-chip--warn{background:#FFF4D6;border-color:#F2D98A;color:#8A6100}
.cb-chip--demo{background:#EAF6F4;border-color:#B9E2DC;color:#0A7C71}

/* ---------- 通用块 ---------- */
.cb-main{padding:0 var(--pad)}
.cb-block{margin-top:22px}
.cb-block__head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px}
.cb-block__title{font-size:14px;font-weight:700}
.cb-block__sub{font-size:11.5px;color:var(--ink-3)}
.cb-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:16px;box-shadow:var(--sh)}
.cb-divider{height:1px;background:var(--line);margin:24px 0}
.cb-h1{font-size:26px;line-height:1.28;font-weight:800;letter-spacing:-.5px;margin:6px 0 0}
.cb-h2{font-size:20px;font-weight:800;letter-spacing:-.3px;margin:0}
.cb-slogan{font-size:13px;font-weight:700;color:var(--brand);letter-spacing:.4px;margin-top:8px}
.cb-lead{font-size:13.5px;color:var(--ink-2);margin:10px 0 0}
.cb-note{font-size:11px;line-height:1.65;color:var(--ink-3);margin:10px 0 0}
.cb-note--center{text-align:center}

/* ---------- 角色展示 ---------- */
.cb-hero{display:flex;justify-content:center;padding:6px 0 2px}
.cb-art{display:block}
@keyframes cbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.cb-art--float{animation:cbFloat 3.6s ease-in-out infinite}

/* ---------- 角色正式资产（位图） ---------- */
.cb-char{display:block;margin:0 auto;position:relative}
@keyframes cbFloatImg{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.cb-char--float{animation:cbFloatImg 3.6s ease-in-out infinite}
/* 托盘：给 3D 角色一层暖色柔光，让它不是"贴"在卡片上而是"站"在上面 */
.cb-char-slot{position:relative;display:flex;align-items:center;justify-content:center}
.cb-char-slot::before{
  content:'';position:absolute;left:50%;top:52%;width:86%;padding-bottom:86%;transform:translate(-50%,-50%);
  border-radius:50%;
  background:radial-gradient(circle, rgba(255,206,150,.34) 0%, rgba(255,206,150,0) 70%);
  pointer-events:none}
.cb-strip{display:flex;gap:10px;overflow-x:auto;padding:4px 0 12px;margin:0 calc(var(--pad) * -1);padding-left:var(--pad);padding-right:var(--pad);
  scrollbar-width:none}
.cb-strip::-webkit-scrollbar{display:none}
.cb-strip__item{flex:0 0 auto;width:84px;text-align:center}
.cb-strip__box{width:84px;height:84px;border-radius:var(--r-md);background:var(--card);border:1px solid var(--line);
  display:flex;align-items:center;justify-content:center;overflow:hidden}
.cb-strip__item.is-on .cb-strip__box{border-color:var(--brand);box-shadow:0 0 0 3px rgba(226,59,38,.12)}
.cb-strip__name{font-size:11px;margin-top:6px;color:var(--ink-2);font-weight:600;line-height:1.3}

/* ---------- 按钮 ---------- */
.cb-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:52px;border:0;
  border-radius:999px;font-size:16px;font-weight:700;font-family:inherit;cursor:pointer;transition:transform .12s ease}
.cb-btn:active{transform:scale(.985)}
.cb-btn--primary{background:var(--brand);color:#fff;box-shadow:0 8px 20px rgba(226,59,38,.26)}
.cb-btn--accent{background:var(--accent);color:#4A3400;box-shadow:0 8px 20px rgba(255,199,44,.32)}
.cb-btn--ghost{background:#fff;color:var(--ink);border:1px solid var(--line-2);box-shadow:none;height:48px;font-size:14.5px}
.cb-btn--sm{height:42px;font-size:14px}
.cb-btn-row{display:flex;gap:10px;margin-top:12px}
.cb-actions{margin-top:20px}

/* ---------- 进度与题目 ---------- */
.cb-progress{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.cb-progress__bar{flex:1;height:6px;border-radius:999px;background:rgba(36,26,20,.09);overflow:hidden}
.cb-progress__fill{height:100%;border-radius:999px;background:var(--brand);width:20%}
.cb-progress__txt{font-size:11.5px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.cb-q__idx{font-size:11px;font-weight:700;color:var(--brand);letter-spacing:1.2px}
.cb-q__title{font-size:19px;font-weight:800;line-height:1.45;margin:8px 0 16px;letter-spacing:-.2px}
.cb-options{display:flex;flex-direction:column;gap:10px}
.cb-option{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:15px 16px;
  background:#fff;border:1.5px solid var(--line);border-radius:var(--r-md);font-family:inherit;font-size:14.5px;
  color:var(--ink);cursor:pointer;transition:border-color .15s ease,background .15s ease}
.cb-option__key{flex:0 0 auto;width:24px;height:24px;border-radius:8px;background:rgba(36,26,20,.06);
  display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--ink-3)}
.cb-option.is-picked{border-color:var(--brand);background:#FFF6F3}
.cb-option.is-picked .cb-option__key{background:var(--brand);color:#fff}

/* ---------- 徽章 ---------- */
.cb-badge{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;
  font-size:10px;font-weight:700;letter-spacing:.3px;vertical-align:1px}
.cb-badge--virtual{background:#EEF7EA;color:#4A7A2E}
.cb-badge--reference{background:#EAF1FA;color:#2C5D96}
.cb-badge--demo{background:#FDF0E3;color:#9A6415}
.cb-badge--virtual-t{background:#F1ECFA;color:#6A4FA8}

/* ---------- 规格行 / 配料 ---------- */
.cb-spec{display:flex;flex-direction:column;gap:0}
.cb-spec__row{display:flex;gap:12px;padding:9px 0;border-bottom:1px dashed var(--line)}
.cb-spec__row:last-child{border-bottom:0}
.cb-spec__k{flex:0 0 52px;font-size:12px;color:var(--ink-3);font-weight:600}
.cb-spec__v{flex:1;font-size:13px;color:var(--ink)}
.cb-ing{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.cb-ing__item{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;
  background:#FFF9F0;border:1px solid var(--line);font-size:12.5px;color:var(--ink-2)}
.cb-ing__dot{width:8px;height:8px;border-radius:50%}

/* ---------- 输入 ---------- */
.cb-field{display:flex;gap:8px;margin-top:12px}
.cb-field__input{flex:1;height:46px;border-radius:var(--r-md);border:1.5px solid var(--line);background:#fff;
  padding:0 14px;font-size:14px;font-family:inherit;color:var(--ink);min-width:0}
.cb-field__input::placeholder{color:#B9A997}
.cb-field__btn{flex:0 0 auto;height:46px;padding:0 18px;border-radius:var(--r-md);border:0;background:var(--ink);
  color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer}
.cb-result-line{display:flex;align-items:center;gap:8px;margin-top:12px;padding:11px 13px;border-radius:var(--r-md);
  background:#F4FAF3;border:1px solid #DCEDD6;font-size:12.5px;color:#3E6B26}

/* ---------- Agent 投喂 ---------- */
.cb-agent{display:flex;gap:14px;align-items:center}
.cb-agent__screen{flex:0 0 auto;width:96px;height:96px;border-radius:22px;background:linear-gradient(160deg,#2B2028,#4A3A44);
  display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.cb-agent__eyes{display:flex;gap:12px}
.cb-agent__eye{width:11px;height:15px;border-radius:6px;background:#8FF0E0;box-shadow:0 0 12px #8FF0E0}
.cb-agent__meta{flex:1;min-width:0}
.cb-agent__name{font-size:15px;font-weight:800}
.cb-agent__desc{font-size:12px;color:var(--ink-3);margin-top:3px;line-height:1.5}
.cb-energy{margin-top:12px}
.cb-energy__row{display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink-3);margin-bottom:5px}
.cb-energy__track{height:9px;border-radius:999px;background:rgba(36,26,20,.08);overflow:hidden}
.cb-energy__fill{height:100%;width:64%;border-radius:999px;background:linear-gradient(90deg,var(--accent),var(--brand))}
.cb-moods{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 0 4px}
.cb-moods::-webkit-scrollbar{display:none}
.cb-mood{flex:0 0 auto;display:flex;align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:999px;
  background:#fff;border:1.5px solid var(--line);font-size:13px;font-weight:600;color:var(--ink-2);cursor:pointer}
.cb-mood.is-on{background:var(--ink);border-color:var(--ink);color:#fff}
.cb-mood__emo{font-size:15px}
.cb-bubble{position:relative;margin-top:14px;padding:14px 16px;border-radius:var(--r-lg);
  background:var(--card);border:1px solid var(--line);box-shadow:var(--sh);font-size:13.5px;line-height:1.7;color:var(--ink-2)}
.cb-bubble__who{font-size:11px;font-weight:700;color:var(--teal);letter-spacing:.4px;margin-bottom:6px}
.cb-drop{margin-top:14px;height:132px;border-radius:var(--r-lg);border:2px dashed var(--line-2);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#FFFDF8}
.cb-drop__txt{font-size:12.5px;color:var(--ink-3)}

/* ---------- 分享卡 ---------- */
.cb-share{width:100%;aspect-ratio:3/4;border-radius:var(--r-xl);padding:22px;position:relative;overflow:hidden;
  background:linear-gradient(168deg,#FFF0D4 0%,#FFE0BE 46%,#FFD3C6 100%);border:1px solid var(--line);
  display:flex;flex-direction:column;box-shadow:var(--sh-2)}
.cb-share__top{display:flex;justify-content:space-between;align-items:flex-start}
.cb-share__brand{font-size:15px;font-weight:800;color:var(--brand);letter-spacing:-.2px}
.cb-share__slogan{font-size:10px;color:#9A6A4A;letter-spacing:1.6px;font-weight:700;margin-top:2px}
.cb-share__mark{font-size:9.5px;color:#B08A6A;font-weight:700}
.cb-share__art{flex:1;display:flex;align-items:center;justify-content:center}
.cb-share__name{font-size:27px;font-weight:800;letter-spacing:-.6px}
.cb-share__line{font-size:12.5px;color:#7A5540;margin-top:6px;line-height:1.6}
.cb-share__tags{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
.cb-share__tag{height:22px;padding:0 9px;border-radius:999px;background:rgba(255,255,255,.72);
  font-size:10.5px;font-weight:700;color:#8A5A3A;display:inline-flex;align-items:center}
.cb-share__foot{display:flex;align-items:flex-end;justify-content:space-between;margin-top:16px}
.cb-share__qr{width:56px;height:56px;border-radius:10px;background:#fff;padding:5px}
.cb-share__qrbox{width:100%;height:100%;background:
  repeating-linear-gradient(90deg,#241A14 0 3px,transparent 3px 6px),
  repeating-linear-gradient(0deg,#241A14 0 3px,transparent 3px 6px);border-radius:4px;opacity:.86}
.cb-share__handle{font-size:11px;font-weight:700;color:#9A6A4A}

.cb-steps{display:flex;flex-direction:column;gap:10px;margin-top:12px}
.cb-step{display:flex;gap:10px;font-size:12.5px;color:var(--ink-2);line-height:1.6}
.cb-step__n{flex:0 0 20px;height:20px;border-radius:50%;background:var(--brand);color:#fff;font-size:11px;
  font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px}
.cb-locked{display:flex;gap:12px;align-items:flex-start;padding:15px;border-radius:var(--r-md);
  background:#FFFBF2;border:1px dashed #EBD3A6}
.cb-locked__icon{flex:0 0 30px;height:30px;border-radius:9px;background:#FFF0D2;display:flex;align-items:center;justify-content:center;font-size:15px}
.cb-locked__t{font-size:13px;font-weight:700;color:#8A6100}
.cb-locked__d{font-size:11.5px;color:#9A7B3A;line-height:1.6;margin-top:3px}

/* ---------- 宽版设定表（给美术对稿 / 发给 ChatGPT 当参考图） ---------- */
.cb-sheet{width:1200px;margin:0 auto;padding:44px 48px 40px;background:var(--bg);min-height:900px}
.cb-sheet__head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:30px}
.cb-sheet__eyebrow{font-size:13px;font-weight:800;color:var(--brand);letter-spacing:-.2px}
.cb-sheet__title{font-size:32px;font-weight:800;letter-spacing:-.8px;margin-top:6px}
.cb-sheet__sub{font-size:13px;color:var(--ink-3);line-height:1.7;text-align:right;max-width:420px}
.cb-sheet__grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.cb-sheet__cell{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:16px 14px 16px;text-align:center;box-shadow:var(--sh)}
.cb-sheet__art{display:flex;justify-content:center;margin-bottom:8px}
.cb-sheet__no{font-size:10.5px;font-weight:700;color:var(--ink-3);letter-spacing:1px}
.cb-sheet__name{font-size:17px;font-weight:800;letter-spacing:-.3px;margin-top:2px}
.cb-sheet__kw{font-size:11.5px;color:var(--ink-2);margin-top:4px;line-height:1.45;min-height:33px}
.cb-sheet__axes{margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);font-size:10.5px;color:var(--ink-2);text-align:left;line-height:1.62}
.cb-sheet__axes b{color:var(--ink-3);font-weight:700}
.cb-sheet__hex{display:inline-flex;align-items:center;gap:5px;margin-top:9px;font-size:10px;color:var(--ink-3);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cb-sheet__sw{width:11px;height:11px;border-radius:3px;border:1px solid var(--line)}
.cb-sheet__foot{margin-top:28px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px;
  font-size:11.5px;color:var(--ink-3);line-height:1.8}
.cb-sheet__rule{max-width:760px}

@media (prefers-reduced-motion:reduce){
  .cb-art--float{animation:none}
  *{transition:none!important}
}
`;

// ---------------------------------------------------------------------------
// 局部渲染助手
// ---------------------------------------------------------------------------
const f = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]);
const art = (id, size, float = false) => renderBurger(artOf(id), { size, float });

// ---- 角色正式资产：位图优先，SVG 兜底 ----
// out/ 下的文件名沿用源图编号，这里做一次 id → 文件名的映射
const CHAR_STEM = {
  'chili-social': '08-chili-social',
  'night-slack': '07-night-slack',
  'cheese-spark': '06-cheese-spark',
  'calm-double': '05-calm-double',
  'plan-drumstick': '04-plan-drumstick',
  'risky-cod': '03-risky-cod',
  'shaky-hashbrown': '02-shaky-hashbrown',
  'zen-veggie': '01-zen-veggie',
};
const ART_OUT = path.resolve('docs/art/chatgpt-v1/out');
const artFile = (id, plated) => CHAR_STEM[id] + (plated ? '@256-plated' : '') + '.png';

/**
 * 取一个角色。
 * 有正式位图就用位图（外面套一层暖色柔光托盘，让 3D 角色是「站」在卡片上而不是贴在卡片上）；
 * 没有就退回 SVG 骨架。
 * plated 版本自带主色底盘，只在 48px 以下的位置用 ——
 * 这个阈值是 docs/art/评审-小尺寸压力测试.png 实测出来的。
 */
function character(id, size, { float = false, plated = false, slot = true } = {}) {
  const file = artFile(id, plated);
  if (!existsSync(path.join(ART_OUT, file))) {
    return renderBurger(artOf(id), { size, float });
  }
  const img =
    '<img class="cb-char' + (float ? ' cb-char--float' : '') + '" ' +
    'src="../docs/art/chatgpt-v1/out/' + file + '" ' +
    'width="' + size + '" height="' + size + '" alt="' + PERSONA[id].name + '">';
  return slot
    ? '<div class="cb-char-slot" style="width:' + size + 'px;height:' + size + 'px">' + img + '</div>'
    : img;
}

const topbar = (right = '') =>
  `<header class="cb-topbar">
      <div class="cb-brand">
        <span class="cb-brand__en">CodeBurger</span>
        <span class="cb-brand__cn">麦门人格汉堡工厂</span>
      </div>
      ${right}
    </header>`;

const chips = (...items) => items.join('');
const chip = (text, kind = '') => `<span class="cb-chip${kind ? ' cb-chip--' + kind : ''}">${text}</span>`;

// ---------------------------------------------------------------------------
// 附页 · 宽版八格设定表（截图后直接发给 ChatGPT 当参考图）
// ---------------------------------------------------------------------------
const ALL_IDS = [
  'chili-social',
  'night-slack',
  'cheese-spark',
  'calm-double',
  'plan-drumstick',
  'risky-cod',
  'shaky-hashbrown',
  'zen-veggie',
];

const PAGE_SHEET = {
  file: '00b-八格设定表.html',
  title: 'CodeBurger · 八格角色设定表',
  body: `
<div class="cb-sheet">
  <div class="cb-sheet__head">
    <div>
      <div class="cb-sheet__eyebrow">CodeBurger</div>
      <div class="cb-sheet__title">八格角色设定表</div>
    </div>
    <div class="cb-sheet__sub">
      8 只全部是汉堡形态。差异只来自<b>面包 / 夹层 / 装饰 / 服装 / 表情</b>五个轴。<br>
      把这张图发给生图模型，用来对齐「它们是同一套设定」这件事。
    </div>
  </div>

  <div class="cb-sheet__grid">
    ${ALL_IDS.map((id, i) => {
      const p = PERSONA[id];
      const v = p.visual;
      return `<div class="cb-sheet__cell">
        <div class="cb-sheet__art">${character(id, 140)}</div>
        <div class="cb-sheet__no">0${i + 1}</div>
        <div class="cb-sheet__name">${p.name}</div>
        <div class="cb-sheet__kw">${p.keyword}</div>
        <div class="cb-sheet__axes">
          <b>面包</b>　${v.bun}<br>
          <b>夹层</b>　${v.filling}<br>
          <b>装饰</b>　${v.prop}<br>
          <b>服装</b>　${v.outfit}<br>
          <b>表情</b>　${v.expression}
        </div>
        <div class="cb-sheet__hex"><span class="cb-sheet__sw" style="background:${v.color}"></span>${v.color}</div>
      </div>`;
    }).join('')}
  </div>

  <div class="cb-sheet__foot">
    <div class="cb-sheet__rule">
      <b>统一规则</b>　2.5 头身，顶层面包上有五官，两侧各一条短圆柱手臂，底部两只小圆脚；
      暖光统一从左上打来，右下柔和的椭圆投影；描边是极浅的暖色深棕，粗细全程一致；
      主色每只一个，只用在面包 / 服装 / 装饰上，不整只刷。
    </div>
    <div>本页为形态对稿用，画法是 SVG 骨架<br>正式资产由美术按 docs/PERSONA_ART_BRIEF.md 产出</div>
  </div>
</div>`,
};

// ---------------------------------------------------------------------------
// 附页 · 8 个角色总览（给美术对稿用，不是视觉 Gate 的四个页面之一）
// ---------------------------------------------------------------------------
const PAGE0 = {
  file: '00-角色总览.html',
  title: 'CodeBurger · 8 个汉堡角色总览',
  body: `
<div class="cb-page cb-page--plain">
  ${topbar(chip('对稿用'))}

  <div class="cb-main">
    <h1 class="cb-h1" style="font-size:23px">8 个汉堡角色</h1>
    <p class="cb-lead">全部保持汉堡形态。差异只来自<b>面包 / 夹层 / 装饰 / 服装 / 表情</b>五个轴，不是 8 个完全不同的造型。<br>这张图可以直接截图发给 ChatGPT 当一致性参考。</p>

    <div class="cb-block">
      <div class="cb-block__head"><span class="cb-block__title">统一规则</span><span class="cb-block__sub">每只都适用</span></div>
      <div class="cb-card">
        <div class="cb-spec">
          <div class="cb-spec__row"><span class="cb-spec__k">结构</span><span class="cb-spec__v">2.5 头身，顶层面包上有五官，两侧各一条短圆柱手臂，底部两只小圆脚</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">光线</span><span class="cb-spec__v">暖光统一从左上打来，右下柔和的椭圆投影</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">描边</span><span class="cb-spec__v">极浅暖色深棕，粗细全程一致</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">主色</span><span class="cb-spec__v">每只一个，只用在面包 / 服装 / 装饰上，不整只刷</span></div>
        </div>
      </div>
    </div>

    ${ALL_IDS.map((id, i) => {
      const c = artOf(id);
      const p = PERSONA[id];
      const v = p.visual;
      return `<div class="cb-card" style="margin-top:14px">
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="flex:0 0 112px;display:flex;align-items:center;justify-content:center">${character(id, 108)}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:baseline;gap:8px">
              <span style="font-size:11px;font-weight:700;color:var(--ink-3)">0${i + 1}</span>
              <span class="cb-h2" style="font-size:17px">${p.name}</span>
            </div>
            <div style="font-size:12.5px;color:var(--ink-2);margin-top:2px">${p.keyword}</div>
            <div style="font-size:12px;color:var(--ink-3);margin-top:6px;line-height:1.5">「${p.tagline}」</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:8px">
              <span style="width:14px;height:14px;border-radius:5px;background:${v.color};border:1px solid var(--line)"></span>
              <code style="font-size:11px;color:var(--ink-3)">${v.color}</code>
            </div>
          </div>
        </div>
        <div class="cb-spec" style="margin-top:10px">
          <div class="cb-spec__row"><span class="cb-spec__k">面包</span><span class="cb-spec__v">${v.bun}</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">夹层</span><span class="cb-spec__v">${v.filling}</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">装饰</span><span class="cb-spec__v">${v.prop}</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">服装</span><span class="cb-spec__v">${v.outfit}</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">表情</span><span class="cb-spec__v">${v.expression}</span></div>
        </div>
      </div>`;
    }).join('')}

    <div class="cb-block">
      <div class="cb-block__head"><span class="cb-block__title">小尺寸可辨识度自查</span><span class="cb-block__sub">缩到 120px 还分得清吗</span></div>
      <div class="cb-strip" style="flex-wrap:wrap">
        ${ALL_IDS.map((id) => {
          const p = PERSONA[id];
          return `<div class="cb-strip__item" style="width:64px"><div class="cb-strip__box" style="width:64px;height:64px">${character(id, 56, { plated: true, slot: false })}</div><div class="cb-strip__name" style="font-size:10px">${p.name}</div></div>`;
        }).join('')}
      </div>
    </div>

    <p class="cb-note cb-note--center">本页为形态对稿用，画法是 SVG 骨架。正式角色资产由美术按 docs/PERSONA_ART_BRIEF.md 产出。</p>
  </div>
</div>`,
};

// ---------------------------------------------------------------------------
// 页面 1 · 汉堡人格测试首页
// ---------------------------------------------------------------------------
const PAGE1 = {
  file: '01-人格测试首页.html',
  title: 'CodeBurger · 人格测试首页',
  body: `
<div class="cb-page">
  ${topbar(chip('Demo'))}

  <div class="cb-main">
    <section class="cb-hero">${character('chili-social', 230, { float: true })}</section>

    <h1 class="cb-h1">麦门人格汉堡工厂</h1>
    <p class="cb-slogan">Feed Your Agent.</p>
    <p class="cb-lead">5 道生活小题，看看你是哪种堡。答完当场组装出一个只属于你的汉堡，还能把它喂给你的 Agent。</p>

    <div class="cb-block">
      <div class="cb-block__head">
        <span class="cb-block__title">8 种汉堡人格</span>
        <span class="cb-block__sub">左右滑动看看</span>
      </div>
      <div class="cb-strip">
        ${['chili-social', 'night-slack', 'cheese-spark', 'calm-double', 'plan-drumstick', 'risky-cod', 'shaky-hashbrown', 'zen-veggie']
          .map((id, i) => {
            const c = artOf(id);
            return `<div class="cb-strip__item${i === 0 ? ' is-on' : ''}">
              <div class="cb-strip__box">${character(id, 72)}</div>
              <div class="cb-strip__name">${PERSONA[id].name}</div>
            </div>`;
          })
          .join('')}
      </div>
    </div>

    <div class="cb-actions">
      <button class="cb-btn cb-btn--primary">开始测一测 · 约 40 秒</button>
      <div class="cb-btn-row">
        <button class="cb-btn cb-btn--ghost">先看一个示例结果</button>
      </div>
      <p class="cb-note cb-note--center">趣味内容，不具备心理测量学效度，也不构成任何专业建议。<br>不收集手机号，不强制登录。</p>
    </div>

    <div class="cb-divider"></div>

    <section>
      <div class="cb-progress">
        <div class="cb-progress__bar"><div class="cb-progress__fill"></div></div>
        <span class="cb-progress__txt">1 / 5</span>
      </div>
      <div class="cb-q">
        <div class="cb-q__idx">第 1 题</div>
        <h2 class="cb-q__title">周五晚上终于下班，你最想做的是</h2>
        <div class="cb-options">
          <button class="cb-option is-picked"><span class="cb-option__key">A</span><span>叫上一群朋友出门吃一顿</span></button>
          <button class="cb-option"><span class="cb-option__key">B</span><span>找两三个熟人小聚一下</span></button>
          <button class="cb-option"><span class="cb-option__key">C</span><span>在群里潜水，看别人聊</span></button>
          <button class="cb-option"><span class="cb-option__key">D</span><span>一个人待着，先把电充满</span></button>
        </div>
      </div>
      <div class="cb-actions">
        <button class="cb-btn cb-btn--accent cb-btn--sm">下一题</button>
      </div>
      <p class="cb-note">选项顺序每次都会换，答案不会上传到服务器。</p>
    </section>
  </div>
</div>`,
};

// ---------------------------------------------------------------------------
// 页面 2 · 汉堡生成与结果页
// ---------------------------------------------------------------------------
const PAGE2 = {
  file: '02-汉堡生成与结果页.html',
  title: 'CodeBurger · 生成与结果页',
  body: `
<div class="cb-page">
  ${topbar(chips(chip('Demo'), chip('参考层关闭', 'warn')))}

  <div class="cb-main">
    <section class="cb-hero">${character('cheese-spark', 220, { float: true })}</section>

    <div style="text-align:center">
      <span class="cb-chip">已按你的答案组装完成</span>
      <h1 class="cb-h1">灵感芝士堡</h1>
      <p class="cb-lead" style="margin-top:6px">好奇心重、点子跳脱<br>「刚又想出三个主意，一个都没记住。」</p>
    </div>

    <div class="cb-block">
      <div class="cb-block__head">
        <span class="cb-block__title">这只堡长什么样</span>
        <span class="cb-block__sub">五个可替换的轴</span>
      </div>
      <div class="cb-card">
        <div class="cb-spec">
          <div class="cb-spec__row"><span class="cb-spec__k">面包</span><span class="cb-spec__v">金黄奶香包，表面鼓起</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">夹层</span><span class="cb-spec__v">芝士拉丝拉出体外</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">装饰</span><span class="cb-spec__v">灯泡 + 星星碎片</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">服装</span><span class="cb-spec__v">画家围裙，沾着颜料</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">表情</span><span class="cb-spec__v">眼睛发光，嘴张开</span></div>
        </div>
      </div>
    </div>

    <div class="cb-block">
      <div class="cb-block__head">
        <span class="cb-block__title">原创虚拟配料</span>
        <span class="cb-block__sub">这些是虚构的，不是真餐品</span>
      </div>
      <div class="cb-card">
        <div class="cb-ing" style="margin-top:0">
          <span class="cb-ing__item"><i class="cb-ing__dot" style="background:#FFD35C"></i>灯泡芝士片 <span class="cb-badge cb-badge--virtual">virtual</span></span>
          <span class="cb-ing__item"><i class="cb-ing__dot" style="background:#F7B92B"></i>灵感酱 <span class="cb-badge cb-badge--virtual">virtual</span></span>
          <span class="cb-ing__item"><i class="cb-ing__dot" style="background:#9B6034"></i>慢烤牛肉饼 <span class="cb-badge cb-badge--virtual">virtual</span></span>
          <span class="cb-ing__item"><i class="cb-ing__dot" style="background:#FBF3E6"></i>奶香顶包 <span class="cb-badge cb-badge--virtual">virtual</span></span>
          <span class="cb-ing__item"><i class="cb-ing__dot" style="background:#FFC72C"></i>星星脆片 <span class="cb-badge cb-badge--virtual">virtual</span></span>
        </div>
        <p class="cb-note">以上配料全部为原创命名，不代表任何真实在售餐品，也不承载任何官方营养数值。</p>
      </div>
    </div>

    <div class="cb-block">
      <div class="cb-block__head">
        <span class="cb-block__title">代码加料</span>
        <span class="cb-block__sub">可选 · 读公开信息，不读代码内容</span>
      </div>
      <div class="cb-card">
        <p class="cb-lead" style="margin:0">输入公开 GitHub 用户名，给你的堡加一份代码配料。</p>
        <div class="cb-field">
          <input class="cb-field__input" value="quzhiii" aria-label="GitHub 用户名">
          <button class="cb-field__btn">加料</button>
        </div>
        <div class="cb-result-line">
          <span>检测到主语言 <b>TypeScript</b></span>
          <span style="margin-left:auto" class="cb-badge cb-badge--virtual-t">已加：代码脆片</span>
        </div>
        <p class="cb-note">只用公开的仓库语言与标签，不评价能力、不换算成任何分数。读不到时自动跳过，不影响汉堡生成。</p>
      </div>
    </div>

    <div class="cb-actions">
      <button class="cb-btn cb-btn--primary">把这个堡喂给 Agent</button>
      <div class="cb-btn-row">
        <button class="cb-btn cb-btn--ghost">生成分享卡</button>
        <button class="cb-btn cb-btn--ghost">重测一次</button>
      </div>
      <p class="cb-note cb-note--center">人格结果为趣味内容。虚拟配料为原创，与任何真实餐品无关。</p>
    </div>
  </div>
</div>`,
};

// ---------------------------------------------------------------------------
// 页面 3 · Agent 投喂互动页
// ---------------------------------------------------------------------------
const PAGE3 = {
  file: '03-Agent投喂互动页.html',
  title: 'CodeBurger · Agent 投喂页',
  body: `
<div class="cb-page cb-page--plain">
  ${topbar(chip('虚拟机制', 'demo'))}

  <div class="cb-main">
    <h1 class="cb-h1" style="font-size:23px">喂给你的 Agent</h1>
    <p class="cb-lead">汉堡的口味会改变你的 Agent 今天的状态。状态只在这个页面里生效，是一套纯虚构的游戏机制。</p>

    <div class="cb-block">
      <div class="cb-card">
        <div class="cb-agent">
          <div class="cb-agent__screen"><div class="cb-agent__eyes"><i class="cb-agent__eye"></i><i class="cb-agent__eye"></i></div></div>
          <div class="cb-agent__meta">
            <div class="cb-agent__name">你的 Agent</div>
            <div class="cb-agent__desc">刚吃下「灵感芝士堡」，正在发亮。</div>
          </div>
        </div>
        <div class="cb-energy">
          <div class="cb-energy__row"><span>今天的状态值</span><span>64 / 100</span></div>
          <div class="cb-energy__track"><div class="cb-energy__fill"></div></div>
        </div>
      </div>
    </div>

    <div class="cb-block">
      <div class="cb-block__head">
        <span class="cb-block__title">它现在的状态</span>
        <span class="cb-block__sub">四种，取决于你喂了什么</span>
      </div>
      <div class="cb-moods">
        <button class="cb-mood"><span class="cb-mood__emo">🎯</span>专注</button>
        <button class="cb-mood is-on"><span class="cb-mood__emo">💡</span>灵感</button>
        <button class="cb-mood"><span class="cb-mood__emo">🐛</span>Bug</button>
        <button class="cb-mood"><span class="cb-mood__emo">🌙</span>摸鱼</button>
      </div>
      <div class="cb-bubble">
        <div class="cb-bubble__who">AGENT</div>
        芝士拉丝的那一刻我想通了，那个卡了半天的写法其实可以整个删掉。要不要现在就动手？
      </div>
    </div>

    <div class="cb-block">
      <div class="cb-block__head">
        <span class="cb-block__title">投喂</span>
        <span class="cb-block__sub">一次一个</span>
      </div>
      <div class="cb-drop">
        ${character('cheese-spark', 104, { float: true })}
        <div class="cb-drop__txt">把它拖进去，或者点下面那颗按钮</div>
      </div>
      <div class="cb-actions">
        <button class="cb-btn cb-btn--primary">喂给 Agent</button>
      </div>
      <p class="cb-note cb-note--center">投喂奖励全部是页面内的虚拟效果，不会增加任何真实 AI 额度，也不涉及任何积分或优惠券。</p>
    </div>

    <div class="cb-block">
      <div class="cb-block__head"><span class="cb-block__title">再喂一只</span><span class="cb-block__sub">状态会叠加</span></div>
      <div class="cb-strip">
        ${['chili-social', 'calm-double', 'night-slack', 'risky-cod']
          .map((id) => {
            return `<div class="cb-strip__item"><div class="cb-strip__box">${character(id, 68)}</div><div class="cb-strip__name">${PERSONA[id].name}</div></div>`;
          })
          .join('')}
      </div>
    </div>
  </div>
</div>`,
};

// ---------------------------------------------------------------------------
// 页面 4 · 分享卡及真实餐品参考页
// ---------------------------------------------------------------------------
const PAGE4 = {
  file: '04-分享卡与真实餐品参考页.html',
  title: 'CodeBurger · 分享卡与参考页',
  body: `
<div class="cb-page cb-page--plain">
  ${topbar(chip('Demo'))}

  <div class="cb-main">
    <h1 class="cb-h1" style="font-size:23px">把这只堡带走</h1>
    <p class="cb-lead">分享卡是 3:4，导出 900 × 1200 的 PNG，可以直接发朋友圈。</p>

    <div class="cb-block">
      <div class="cb-share">
        <div class="cb-share__top">
          <div>
            <div class="cb-share__brand">CodeBurger</div>
            <div class="cb-share__slogan">FEED YOUR AGENT.</div>
          </div>
          <div class="cb-share__mark">麦门人格汉堡工厂</div>
        </div>
        <div class="cb-share__art">${character('cheese-spark', 168, { float: true })}</div>
        <div>
          <div class="cb-share__name">灵感芝士堡</div>
          <div class="cb-share__line">刚又想出三个主意，一个都没记住。</div>
          <div class="cb-share__tags">
            <span class="cb-share__tag">好奇心重</span>
            <span class="cb-share__tag">点子跳脱</span>
            <span class="cb-share__tag">灵感型 Agent</span>
          </div>
        </div>
        <div class="cb-share__foot">
          <div class="cb-share__handle">@CodeBurger · 扫码做一个</div>
          <div class="cb-share__qr"><div class="cb-share__qrbox"></div></div>
        </div>
      </div>
    </div>

    <div class="cb-block">
      <div class="cb-block__head"><span class="cb-block__title">怎么存到相册</span><span class="cb-block__sub">分场景给不同办法</span></div>
      <div class="cb-card">
        <div class="cb-steps">
          <div class="cb-step"><span class="cb-step__n">1</span><span>在微信或小红书里打开：卡片会放成整屏大图，<b>长按图片 → 保存图片</b>。</span></div>
          <div class="cb-step"><span class="cb-step__n">2</span><span>如果长按没反应：点右上角「···」，选<b>用系统浏览器打开</b>，再点下面的保存按钮。</span></div>
          <div class="cb-step"><span class="cb-step__n">3</span><span>在 Safari / Chrome 里：直接点「保存到相册」，不需要授权相册权限以外的任何东西。</span></div>
        </div>
        <div class="cb-actions">
          <button class="cb-btn cb-btn--primary">保存图片</button>
          <div class="cb-btn-row">
            <button class="cb-btn cb-btn--ghost">复制链接</button>
            <button class="cb-btn cb-btn--ghost">用系统浏览器打开</button>
          </div>
        </div>
      </div>
    </div>

    <div class="cb-block">
      <div class="cb-block__head">
        <span class="cb-block__title">真实餐品参考</span>
        <span class="cb-block__sub">默认关闭</span>
      </div>
      <div class="cb-locked">
        <div class="cb-locked__icon">🔒</div>
        <div>
          <div class="cb-locked__t">参考层未开启</div>
          <div class="cb-locked__d">官方营养数据的公开使用范围尚未确认，因此这里默认不展示任何真实数据。你的汉堡结果不受影响。</div>
        </div>
      </div>

      <div class="cb-card" style="margin-top:12px;opacity:.92">
        <div class="cb-block__head" style="margin-bottom:8px">
          <span class="cb-block__title" style="font-size:13px">开启后会是这样</span>
          <span class="cb-badge cb-badge--demo">demo · 虚构示例</span>
        </div>
        <div class="cb-spec">
          <div class="cb-spec__row"><span class="cb-spec__k">餐品</span><span class="cb-spec__v">示例餐品名 <span class="cb-badge cb-badge--reference">reference</span></span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">来源</span><span class="cb-spec__v">演示占位，非真实数值</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">抓取日</span><span class="cb-spec__v">—— / ——</span></div>
        </div>
        <p class="cb-note">这里展示的是<b>布局结构</b>，数字全部是占位符。真实数值只有在你本地、用你自己的凭证查到之后才会出现，并且会逐条标注来源与抓取日期。</p>
      </div>

      <div class="cb-card" style="margin-top:12px">
        <div class="cb-block__head" style="margin-bottom:8px">
          <span class="cb-block__title" style="font-size:13px">趣味人格映射</span>
          <span class="cb-badge cb-badge--virtual-t">非科学结论</span>
        </div>
        <div class="cb-spec">
          <div class="cb-spec__row"><span class="cb-spec__k">你的堡</span><span class="cb-spec__v">灵感芝士堡 · 好奇心重、点子跳脱</span></div>
          <div class="cb-spec__row"><span class="cb-spec__k">对应类别</span><span class="cb-spec__v">奶香芝士类</span></div>
        </div>
        <p class="cb-note">这是「人格 → 餐品类别」的趣味对应，不是营养建议，也不是推荐你该吃什么。</p>
      </div>
    </div>

    <p class="cb-note cb-note--center">
      本页为设计稿，用于确认版式与信息层级。<br>
      CodeBurger 与麦当劳官方无隶属关系，未使用任何官方商标或角色素材。
    </p>
  </div>
</div>`,
};

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------
function build({ file, title, body }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#FFF7EC">
<title>${f(title)}</title>
<style>${CSS}</style>
</head>
<body>
${body}
<script>
/* 角色画法：与 src/renderer 同源，视觉 Gate 通过后原样移植 */
${artSource}
</script>
</body>
</html>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
const pages = [PAGE0, PAGE_SHEET, PAGE1, PAGE2, PAGE3, PAGE4];
for (const p of pages) {
  const out = path.join(OUT_DIR, p.file);
  writeFileSync(out, build(p), 'utf8');
  console.log('已生成 ' + path.relative(process.cwd(), out));
}
console.log(`\n共 ${pages.length} 张设计稿，无外部依赖，双击即可打开。`);
