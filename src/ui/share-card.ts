/**
 * 分享卡导出。
 *
 * 用原生 Canvas 2D 生成 3:4 竖版 PNG，不引第三方库。
 * 角色图通过同源 asset 路径加载，加载失败时降级为纯文字卡，
 * 保证任何环境下都能导出成功。
 */

import type { BurgerSpec, AgentState } from '../spec/burger-spec.ts';
import { AGENT_STATE_META } from '../spec/burger-spec.ts';

const W = 1080;
const H = 1440;

/** 中文换行。逐字测量，避免超宽字符被截断。 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface ShareCardInput {
  spec: BurgerSpec;
  state: AgentState;
  /** 本地图片 URL，可为空 */
  portraitUrl: string | null;
  /** GitHub 用户名，可为空 */
  githubUsername: string | null;
}

/**
 * 绘制分享卡并返回 PNG Blob。
 * 全程离线：不联网，不上传。
 */
export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas');

  const { spec, state, portraitUrl, githubUsername } = input;
  const agentMeta = AGENT_STATE_META[state];

  // ---- 背景：暖白 + 顶部品牌色晕染 ----
  ctx.fillStyle = '#FFF7EC';
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 190, 20, W / 2, 190, 620);
  glow.addColorStop(0, hexToRgba(spec.color, 0.3));
  glow.addColorStop(1, hexToRgba(spec.color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ---- 顶部品牌 ----
  ctx.textAlign = 'center';
  ctx.fillStyle = '#E23B26';
  ctx.font = '800 44px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  ctx.fillText('CodeBurger', W / 2, 92);

  ctx.fillStyle = '#0FB5A6';
  ctx.font = '700 26px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  ctx.fillText('Feed Your Agent.', W / 2, 134);

  // ---- 角色图 ----
  const img = await loadImage(portraitUrl);
  const boxTop = 176;
  const boxSize = 560;
  const boxX = (W - boxSize) / 2;

  // 柔和底盘，让角色不是贴上去而是站在卡片里
  const plate = ctx.createRadialGradient(
    W / 2, boxTop + boxSize * 0.55, 10,
    W / 2, boxTop + boxSize * 0.55, boxSize * 0.5,
  );
  plate.addColorStop(0, hexToRgba(spec.color, 0.28));
  plate.addColorStop(1, hexToRgba(spec.color, 0));
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.arc(W / 2, boxTop + boxSize * 0.55, boxSize * 0.5, 0, Math.PI * 2);
  ctx.fill();

  if (img) {
    ctx.drawImage(img, boxX, boxTop, boxSize, boxSize);
  } else {
    // 降级：画一个用主色构成的抽象汉堡，让卡片依然成立
    drawFallbackBurger(ctx, W / 2, boxTop + boxSize / 2, boxSize * 0.62, spec);
  }

  // ---- 角色名 ----
  let y = boxTop + boxSize + 76;
  ctx.fillStyle = '#241A14';
  ctx.font = '800 66px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  ctx.fillText(spec.name, W / 2, y);

  y += 46;
  ctx.fillStyle = spec.color;
  ctx.font = '700 30px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  ctx.fillText(spec.keyword, W / 2, y);

  // ---- 一句话 ----
  y += 66;
  ctx.fillStyle = '#6B5A4D';
  ctx.font = '400 33px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  for (const line of wrapText(ctx, spec.tagline, W - 200)) {
    ctx.fillText(line, W / 2, y);
    y += 46;
  }

  // ---- Agent 状态条 ----
  y = Math.max(y + 24, boxTop + boxSize + 300);
  const barW = W - 200;
  const barX = 100;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, barX, y, barW, 108, 26);
  ctx.fill();
  ctx.strokeStyle = 'rgba(36,26,20,0.10)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = agentMeta.color;
  roundRect(ctx, barX + 28, y + 30, 132, 48, 24);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 26px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  ctx.fillText(agentMeta.label, barX + 94, y + 63);

  ctx.fillStyle = '#241A14';
  ctx.textAlign = 'left';
  ctx.font = '700 27px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  ctx.fillText('Agent 现在的状态', barX + 184, y + 62);
  ctx.textAlign = 'center';

  // ---- 配料 ----
  y += 156;
  ctx.fillStyle = '#241A14';
  ctx.font = '700 28px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  ctx.fillText('这一只的配料', W / 2, y);

  y += 16;
  const labels = spec.toppings.length > 0
    ? spec.toppings.map((t) => t.label)
    : ['经典原味'];
  ctx.font = '400 25px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  const chips = layoutChips(ctx, labels, W - 160);
  let chipY = y + 26;
  for (const row of chips) {
    let cx = (W - row.width) / 2;
    for (const label of row.items) {
      const w = ctx.measureText(label).width + 44;
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, cx, chipY, w, 54, 27);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(spec.color, 0.35);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#6B5A4D';
      ctx.fillText(label, cx + w / 2, chipY + 36);
      cx += w + 14;
    }
    chipY += 66;
  }

  // ---- 页脚 ----
  ctx.textAlign = 'center';
  ctx.fillStyle = '#A39284';
  ctx.font = '400 22px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  ctx.fillText(
    githubUsername ? `代码加料来自 github.com/${githubUsername}` : '答 5 道题，测出你的汉堡人格',
    W / 2,
    H - 96,
  );
  ctx.fillText('趣味娱乐内容 · 非官方产品 · 投喂效果为虚拟游戏机制', W / 2, H - 58);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('导出失败'));
    }, 'image/png');
  });
}

/** 把配料标签排成多行，返回每行的标签与总宽 */
function layoutChips(
  ctx: CanvasRenderingContext2D,
  labels: string[],
  maxWidth: number,
): Array<{ items: string[]; width: number }> {
  const rows: Array<{ items: string[]; width: number }> = [];
  let current: string[] = [];
  let width = 0;

  for (const label of labels) {
    const w = ctx.measureText(label).width + 44;
    if (current.length > 0 && width + w + 14 > maxWidth) {
      rows.push({ items: current, width });
      current = [];
      width = 0;
    }
    current.push(label);
    width += w + (current.length > 1 ? 14 : 0);
  }
  if (current.length > 0) rows.push({ items: current, width });
  return rows;
}

/** 图片加载。失败返回 null，由调用方降级。 */
function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** 图片加载失败时的抽象汉堡，占位不报错 */
function drawFallbackBurger(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  spec: BurgerSpec,
): void {
  const halfW = size / 2;
  const bunTop = cy - size * 0.32;
  const bunH = size * 0.24;

  ctx.fillStyle = '#E8B96B';
  roundRect(ctx, cx - halfW, bunTop, size, bunH, bunH / 2);
  ctx.fill();

  ctx.fillStyle = spec.color;
  roundRect(ctx, cx - halfW * 0.98, bunTop + bunH + 8, size * 0.98, size * 0.1, 10);
  ctx.fill();

  ctx.fillStyle = '#7DBE4E';
  roundRect(ctx, cx - halfW * 0.9, bunTop + bunH + size * 0.12, size * 0.9, size * 0.08, 8);
  ctx.fill();

  ctx.fillStyle = '#C97B3C';
  roundRect(ctx, cx - halfW * 0.86, bunTop + bunH + size * 0.22, size * 0.86, size * 0.12, 12);
  ctx.fill();
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 立刻 revoke 会让部分浏览器下载失败，延迟释放
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}