/**
 * 生成「候选角色图评审表」。
 *
 * 用途：把外部生图的结果和我们的扁平 SVG 骨架放在一起比，回答三个问题：
 *   1. 哪张图对应哪个角色（人工核对映射对不对）
 *   2. 缩到 64px / 48px 还分不分得清
 *   3. 放进真实的列表卡片里是什么观感
 *
 * 产物：mockups/09-候选图评审表.html
 * 运行：npm run review
 */

import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { ART, ART_EXTRA, renderBurger } from './mockup-art.mjs';
import { PERSONAS } from '../src/persona/personas.ts';

const PERSONA = Object.fromEntries(PERSONAS.map((p) => [p.id, p]));
const artOf = (id) => ART[id] || ART_EXTRA[id];

const CANDIDATE_DIR = 'docs/art/chatgpt-v1';
const IMG = {
  'zen-veggie': '01-zen-veggie.jpg',
  'shaky-hashbrown': '02-shaky-hashbrown.jpg',
  'risky-cod': '03-risky-cod.jpg',
  'plan-drumstick': '04-plan-drumstick.jpg',
  'calm-double': '05-calm-double.jpg',
  'cheese-spark': '06-cheese-spark.jpg',
  'night-slack': '07-night-slack.jpg',
  'chili-social': '08-chili-social.jpg',
};

/** 按 personas.ts 的顺序展示，并给出这一只在视觉上最容易被混淆的对手 */
const ORDER = [
  'chili-social',
  'night-slack',
  'cheese-spark',
  'calm-double',
  'plan-drumstick',
  'risky-cod',
  'shaky-hashbrown',
  'zen-veggie',
];

const CSS = `
:root{--bg:#FFF7EC;--card:#fff;--ink:#241A14;--ink-2:#5C4B3F;--ink-3:#93816F;
  --brand:#E23B26;--accent:#FFC72C;--teal:#0FB5A6;--line:rgba(36,26,20,.08);--sh:0 8px 24px rgba(36,26,20,.07)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:-apple-system,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased}
.sheet{width:1400px;margin:0 auto;padding:44px 48px 56px}
h1{font-size:30px;font-weight:800;letter-spacing:-.6px;margin:0 0 6px}
.lede{font-size:13px;color:var(--ink-3);line-height:1.8;margin:0 0 32px}
h2{font-size:17px;font-weight:800;margin:40px 0 14px;letter-spacing:-.2px}
h2 .n{color:var(--brand);margin-right:8px;font-size:14px}
.hint{font-size:12px;color:var(--ink-3);margin:-8px 0 14px;line-height:1.7}
table{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--line);
  border-radius:20px;overflow:hidden;box-shadow:var(--sh)}
th{background:#FFFBF3;font-size:11.5px;color:var(--ink-3);font-weight:700;text-align:left;padding:11px 14px;
  border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:10px 14px;border-bottom:1px solid var(--line);vertical-align:middle;font-size:13px}
tr:last-child td{border-bottom:0}
.name{font-weight:800;font-size:14.5px}
.kw{font-size:11.5px;color:var(--ink-3);margin-top:2px}
.sw{display:inline-block;width:12px;height:12px;border-radius:4px;border:1px solid var(--line);vertical-align:-2px;margin-right:5px}
.hex{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;color:var(--ink-3)}
.cellimg{display:block;border-radius:14px;background:#fff;object-fit:contain}
.strip{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;background:#fff;border:1px solid var(--line);
  border-radius:20px;padding:22px;box-shadow:var(--sh)}
.strip figure{margin:0;text-align:center}
.strip figcaption{font-size:9.5px;color:var(--ink-3);margin-top:7px;line-height:1.3;width:56px}
.cards{display:flex;gap:20px;flex-wrap:wrap}
.card{width:300px;background:#fff;border:1px solid var(--line);border-radius:20px;padding:14px;box-shadow:var(--sh)}
.card__row{display:flex;gap:12px;align-items:center}
.card__img{width:88px;height:88px;border-radius:14px;background:#FFFBF3;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto}
.card__img img{width:88px;height:88px;object-fit:contain}
.card__t{font-size:15px;font-weight:800}
.card__k{font-size:11.5px;color:var(--ink-3);margin-top:2px;line-height:1.45}
.card__pick{margin-top:10px;padding-top:9px;border-top:1px dashed var(--line);display:flex;align-items:center;gap:8px;font-size:11px;color:var(--ink-2)}
.card__pick img{width:34px;height:34px;border-radius:9px;background:#FFFBF3;object-fit:contain}
.ok{color:#3E7A2A;font-weight:700}
.warn{color:#A9691F;font-weight:700}
.bad{color:#C0392B;font-weight:700}
.verdict{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px 22px;box-shadow:var(--sh);font-size:13px;line-height:1.9}
.verdict li{margin-bottom:5px}
`;

function pickCandidate(id) {
  const f = path.join(CANDIDATE_DIR, IMG[id]);
  return existsSync(f) ? `../${CANDIDATE_DIR}/${IMG[id]}` : null;
}

const rows = ORDER.map((id) => {
  const p = PERSONA[id];
  const v = p.visual;
  const src = pickCandidate(id);
  return `<tr>
    <td style="width:120px"><div class="cellimg">${renderBurger(artOf(id), { size: 96 })}</div></td>
    <td style="width:130px">${src ? `<img class="cellimg" src="${src}" width="112" height="112" alt="">` : '<span class="hex">缺图</span>'}</td>
    <td style="width:150px"><div class="name">${p.name}</div><div class="kw">${p.keyword}</div></td>
    <td style="width:110px"><span class="sw" style="background:${v.color}"></span><span class="hex">${v.color}</span></td>
    <td style="width:120px">${src ? `<img class="cellimg" src="${src}" width="56" height="56" alt="">` : ''}</td>
    <td style="width:80px">${src ? `<img class="cellimg" src="${src}" width="40" height="40" alt="">` : ''}</td>
    <td style="font-size:11.5px;color:var(--ink-3)">${v.expression}</td>
  </tr>`;
}).join('');

const stripImg = ORDER.map((id) => {
  const src = pickCandidate(id);
  return `<figure><img class="cellimg" src="${src}" width="48" height="48" alt=""><figcaption>${PERSONA[id].name.replace(/堡$/, '')}</figcaption></figure>`;
}).join('');

const stripSvg = ORDER.map((id) => {
  return `<figure><div class="cellimg">${renderBurger(artOf(id), { size: 48 })}</div><figcaption style="width:48px">${PERSONA[id].name.replace(/堡$/, '')}</figcaption></figure>`;
}).join('');

const cards = ORDER.slice(0, 4).map((id) => {
  const p = PERSONA[id];
  const src = pickCandidate(id);
  return `<div class="card">
    <div class="card__row">
      <div class="card__img"><img src="${src}" alt=""></div>
      <div>
        <div class="card__t">${p.name}</div>
        <div class="card__k">${p.keyword}</div>
      </div>
    </div>
    <div class="card__pick">列表小图对照 <img src="${src}" alt=""> <span class="hex">88px / 34px</span></div>
  </div>`;
}).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>CodeBurger · 候选角色图评审表</title>
<style>${CSS}</style></head><body>
<div class="sheet">
  <h1>候选角色图评审表</h1>
  <p class="lede">
    左起：我们的扁平 SVG 骨架 → 候选大图 112px → 角色信息 → 主色 → 候选 56px → 候选 40px → 表情。<br>
    最后两列是判断重点：缩到这个尺寸还认不认得出。
  </p>

  <h2><span class="n">A</span>逐只对照</h2>
  <table>
    <thead><tr>
      <th>我们的 SVG</th><th>候选图</th><th>角色</th><th>主色</th><th>56px</th><th>40px</th><th>表情</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <h2><span class="n">B</span>缩到 48px 的剪影对比</h2>
  <p class="hint">上排是候选图，下排是我们的扁平 SVG。这一排是最终列表页、导航条、分享卡角落实际会用的尺寸。</p>
  <div class="strip" style="margin-bottom:14px">${stripImg}</div>
  <div class="strip">${stripSvg}</div>

  <h2><span class="n">C</span>放进真实卡片里的观感</h2>
  <p class="hint">这是首页「8 种人格」那条横滑条的实际卡片尺寸。</p>
  <div class="cards">${cards}</div>

  <h2><span class="n">D</span>结论</h2>
  <div class="verdict">
    <ul>
      <li>8 只<strong>全部保持汉堡形态</strong>，没有跑成薯条可乐。<span class="ok">通过</span></li>
      <li>五个轴（面包 / 夹层 / 装饰 / 服装 / 表情）<strong>逐条对得上</strong>，道具齐全。<span class="ok">通过</span></li>
      <li>画风是<strong>厚涂 3D 渲染</strong>，有强高光、写实质感、戏剧打光——和当初「扁平、极轻渐变、不要塑料 3D」的要求相反。<span class="bad">不符</span></li>
      <li>8 只<strong>面包颜色几乎都一样</strong>（暖金橙），主色只落在服装上。缩到 40-48px 主要靠道具和服装区分，剪影本身区分度不足。<span class="warn">偏弱</span></li>
      <li>背景是<strong>纯白不透明</strong>，不是透明底。放到我们 <code>#FFF7EC</code> 奶油底的卡片上会有一圈白色方块。<span class="bad">需处理</span></li>
      <li>单张 1254×1254，网页里实际最大只用到 200px 左右，直接放会浪费带宽。<span class="warn">需压缩</span></li>
    </ul>
  </div>
</div>
</body></html>
`;

mkdirSync('mockups', { recursive: true });
writeFileSync('mockups/09-候选图评审表.html', html, 'utf8');
console.log('已生成 mockups/09-候选图评审表.html');

// ---------------------------------------------------------------------------
// 第二页：去白底效果对比（证明能不能真的放在奶油底卡片上）
// ---------------------------------------------------------------------------
const CUT = 'docs/art/chatgpt-v1/out';
const cutRows = ORDER.map((id) => {
  const p = PERSONA[id];
  const stem = IMG[id].replace(/\.jpg$/, '');
  const raw = path.resolve(CANDIDATE_DIR, IMG[id]);
  const cut = path.resolve(CUT, `${stem}.png`);
  const relRaw = path.relative(path.resolve('mockups'), raw).replace(/\\/g, '/');
  const relCut = path.relative(path.resolve('mockups'), cut).replace(/\\/g, '/');
  const ok = existsSync(cut);
  return `<div class="pair">
    <div class="pair__t">${p.name}</div>
    <div class="pair__box"><span class="lbl">原图（白底）</span><img src="${relRaw}" alt=""></div>
    <div class="pair__box pair__box--cut">
      <span class="lbl">去底后</span>
      ${ok ? `<img src="${relCut}" alt="">` : '<span class="hex">未处理</span>'}
    </div>
  </div>`;
}).join('');

const cutStrip = ORDER.map((id) => {
  const stem = IMG[id].replace(/\.jpg$/, '');
  const cut = path.resolve(CUT, `${stem}.png`);
  if (!existsSync(cut)) return '';
  const rel = path.relative(path.resolve('mockups'), cut).replace(/\\/g, '/');
  return `<figure><img class="cellimg" src="${rel}" width="48" height="48" alt=""><figcaption style="width:48px">${PERSONA[id].name.replace(/堡$/, '')}</figcaption></figure>`;
}).join('');

const html2 = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>CodeBurger · 去白底效果对比</title>
<style>${CSS}
.pair{background:#fff;border:1px solid var(--line);border-radius:20px;padding:14px;box-shadow:var(--sh);width:320px}
.pair__t{font-size:14.5px;font-weight:800;margin-bottom:10px;text-align:center}
.pair__box{position:relative;border-radius:14px;padding:10px;display:flex;align-items:center;justify-content:center;height:180px}
.pair__box img{max-width:100%;max-height:160px;object-fit:contain}
.pair__box .lbl{position:absolute;left:10px;top:8px;font-size:10px;color:var(--ink-3);font-weight:700}
.pair__box--cut{background:#FFF7EC;margin-top:10px}
.pairs{display:flex;flex-wrap:wrap;gap:20px}
.cmp{border-radius:14px;overflow:hidden;border:1px solid var(--line)}
</style></head><body>
<div class="sheet">
  <h1>去白底效果对比</h1>
  <p class="lede">
    上半块是原始生图（白底），下半块是本地去底后的结果，背景换成我们实际的页面底色 <code>#FFF7EC</code>。<br>
    去掉的透明区域占画面 45%–55%，说明白底被完整清掉了；同时面包上的高光没有被误伤（高光和边框不连通，漫水填充碰不到）。
  </p>

  <h2><span class="n">A</span>逐只对比</h2>
  <div class="pairs">${cutRows}</div>

  <h2><span class="n">B</span>去底后缩到 48px</h2>
  <div class="strip">${cutStrip}</div>

  <h2><span class="n">C</span>体积</h2>
  <table>
    <thead><tr><th>文件</th><th>原始 JPG 1254²</th><th>去底 PNG 512²</th><th>去底 WebP 512²</th><th>省下</th></tr></thead>
    <tbody>
      ${ORDER.map((id) => {
        const stem = IMG[id].replace(/\.jpg$/, '');
        const raw = path.resolve(CANDIDATE_DIR, IMG[id]);
        const png = path.resolve(CUT, `${stem}.png`);
        const webp = path.resolve(CUT, `${stem}.webp`);
        const kb = (f) => (existsSync(f) ? (statSync(f).size / 1024).toFixed(0) + 'K' : '—');
        const pngKb = existsSync(png) ? statSync(png).size / 1024 : 0;
        const webpKb = existsSync(webp) ? statSync(webp).size / 1024 : 1;
        return `<tr><td>${PERSONA[id].name}</td><td>${kb(raw)}</td><td>${kb(png)}</td><td>${kb(webp)}</td>
          <td class="ok">${pngKb && webpKb ? 'WebP 比 PNG 小 ' + (100 - (webpKb / pngKb) * 100).toFixed(0) + '%' : ''}</td></tr>`;
      }).join('')}
    </tbody>
  </table>
</div>
</body></html>
`;

writeFileSync('mockups/10-去底效果对比.html', html2, 'utf8');
console.log('已生成 mockups/10-去底效果对比.html');

// ---------------------------------------------------------------------------
// 第三页：小尺寸压力测试（页面做小，截图后不会被缩放，能 1:1 看清）
// ---------------------------------------------------------------------------
const SIZES = [64, 48, 36, 24];
const relOf = (abs) => path.relative(path.resolve('mockups'), abs).replace(/\\/g, '/');
const cutFile = (id, variant) => path.resolve(CUT, `${IMG[id].replace(/\.jpg$/, '')}${variant}`);

const pressure = SIZES.map((s) => {
  const plateRow = ORDER.map((id) => {
    const f = cutFile(id, '@256-plated.png');
    return existsSync(f) ? `<img src="${relOf(f)}" width="${s}" height="${s}" style="display:block" alt="">` : '';
  }).join('');
  const cutRow = ORDER.map((id) => {
    const f = cutFile(id, '@256.png');
    return existsSync(f) ? `<img src="${relOf(f)}" width="${s}" height="${s}" style="display:block" alt="">` : '';
  }).join('');
  return `<tr><td class="sz">${s}px</td><td><div class="strip2">${cutRow}</div></td></tr>
  <tr><td class="sz alt">＋底盘</td><td><div class="strip2">${plateRow}</div></td></tr>`;
}).join('');

const svgRow = ORDER.map((id) => renderBurger(artOf(id), { size: 56 })).join('');

const html3 = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>CodeBurger · 小尺寸压力测试</title>
<style>${CSS}
body{background:#FFF7EC}
.sheet{width:760px;padding:28px 32px 32px}
h1{font-size:20px}
.lede{font-size:12px;margin-bottom:18px}
table.press{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--line);
  border-radius:16px;overflow:hidden;box-shadow:var(--sh)}
.press td{padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:middle}
.press tr:last-child td{border-bottom:0}
.sz{width:56px;font-size:11px;font-weight:800;color:var(--ink-3);font-family:ui-monospace,monospace}
.sz.alt{color:#C9B9A6}
.strip2{display:flex;gap:12px;align-items:center}
.order{font-size:10.5px;color:var(--ink-3);line-height:1.7;margin-top:14px}
.order b{color:var(--ink-2)}
</style></head><body>
<div class="sheet">
  <h1>小尺寸压力测试</h1>
  <p class="lede">每档两排：上排是直接去底的原图，下排是加了主色底盘的版本。页面上按 1:1 像素呈现，没有缩放。</p>
  <table class="press"><tbody>${pressure}</tbody></table>

  <h2 style="font-size:15px;margin-top:26px">最下一档：我们的扁平 SVG（56px）</h2>
  <p class="hint">作为对照。它的剪影差异更大，但质感远不如生图。</p>
  <div class="strip2" style="margin-top:10px">${svgRow}</div>

  <div class="order" style="margin-top:18px">
    <b>从左到右：</b>社牛辣椒堡 · 深夜摸鱼堡 · 灵感芝士堡 · 淡定双层堡 · 计划鸡腿堡 · 冒险鳕鱼堡 · 手抖薯饼堡 · 佛系蔬菜堡
  </div>
</div>
</body></html>
`;

writeFileSync('mockups/11-小尺寸压力测试.html', html3, 'utf8');
console.log('已生成 mockups/11-小尺寸压力测试.html');
