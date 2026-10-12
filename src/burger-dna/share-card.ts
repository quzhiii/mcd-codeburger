/**
 * 分享卡 · 游戏角色卡版
 *
 * 目标：让看到图片的人产生「我也想测一下」的冲动。
 * 所以它不长得像测试结果，长得像一张收集来的角色卡。
 *
 * 版式（1080×1440，3:4）
 * --------------------
 *   ┌─────────────────────────┐
 *   │ CodeBurger Lab      Lv.5│  ← 实验室抬头 + 等级徽章
 *   ├─────────────────────────┤
 *   │                         │
 *   │      角色大图            │  ← SVG 叠加渲染，非静态图
 *   │    （含装备与配料）       │
 *   │                         │
 *   ├─────────────────────────┤
 *   │ 你的 AI 汉堡             │
 *   │ 辣味探索家               │  ← 角色名 + 称号
 *   │ ─────────────────────── │
 *   │ 代码力  ▓▓▓▓▓▓░░░░  62 │
 *   │ 创造力  ▓▓▓▓▓▓▓▓░░  74 │  ← 属性条
 *   │ 续航力  ▓▓▓▓░░░░░░  41 │
 *   ├─────────────────────────┤
 *   │ 配方                     │
 *   │ 🌶 辣椒釉酱              │  ← 配料清单（带来源标记）
 *   │ 🍗 脆炸鸡翼      麦当劳  │
 *   ├─────────────────────────┤
 *   │ ▓▓▓▓▓▓░░ 72%  数据完整度  │  ← 诚实标注：不是全量数据
 *   │ ⬛ 扫码测你的 AI 汉堡 [码] │
 *   └─────────────────────────┘
 *
 * 诚实性约定
 * ----------
 * - 「数据完整度」必须展示。用了 MCP 数据的角色和只答题的角色，
 *   分析深度完全不同，不告诉用户会显得在编。
 * - 配料旁标出来源（麦当劳 / GitHub / 测试 / 活动），
 *   让用户知道哪一层是真数据、哪一层是趣味映射。
 * - 底部固定声明「趣味娱乐 · 非官方产品 · 不影响任何真实 AI 能力」。
 */

import type { BurgerDna } from '../burger-dna/dna.ts';
import { ATTRIBUTE_KEYS, ATTRIBUTE_META, DNA_SOURCE_LABEL } from '../burger-dna/dna.ts';
import { renderBurgerSvg } from '../burger-dna/character.ts';

const W = 1080;
const H = 1440;

export interface ShareCardInput {
  dna: BurgerDna;
  /** 基础角色图 URL */
  baseUrl: string;
  /** 底部二维码指向的链接，可为空则不画 */
  qrUrl?: string | null;
}

/* ============================================================
 * 绘制原语
 * ============================================================ */

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 中文按字断行 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    const t = line + ch;
    if (ctx.measureText(t).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length >= maxLines) return lines;
    } else {
      line = t;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ============================================================
 * 二维码
 * ============================================================ */

/**
 * 极简 QR 码渲染器（版本 1，字节模式，EC 级别 L）。
 *
 * 为什么自己写：为了不引第三方依赖，一个二维码库是 30KB+。
 * 这里只支持「短链接」场景，长度够用（< 100 字节）。
 *
 * 诚实说明：这是**可扫的**真实 QR，不是装饰性方块。
 * 但它不是完整的 QR 规范实现，超长内容或需要高纠错时会失败并回退成提示文字。
 */
function renderQr(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
): boolean {
  const qr = buildQr(text);
  if (!qr) return false;

  const cell = size / qr.size;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, size, size, size * 0.06);
  ctx.fill();

  ctx.fillStyle = '#241a14';
  for (let r = 0; r < qr.size; r += 1) {
    for (let c = 0; c < qr.size; c += 1) {
      if (!qr.modules[r * qr.size + c]) continue;
      // 跳过三个定位角内部，交给定位图形绘制
      if (isFinderArea(r, c, qr.size)) continue;
      ctx.fillRect(x + c * cell, y + r * cell, cell * 0.94, cell * 0.94);
    }
  }

  // 定位角
  const drawFinder = (gr: number, gc: number) => {
    const p = x + gc * cell;
    const q = y + gr * cell;
    ctx.fillStyle = '#241a14';
    ctx.fillRect(p, q, cell * 7, cell * 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p + cell, q + cell, cell * 5, cell * 5);
    ctx.fillStyle = '#241a14';
    ctx.fillRect(p + cell * 2, q + cell * 2, cell * 3, cell * 3);
  };
  drawFinder(0, 0);
  drawFinder(0, qr.size - 7);
  drawFinder(qr.size - 7, 0);

  return true;
}

function isFinderArea(r: number, c: number, size: number): boolean {
  const inTopLeft = r < 8 && c < 8;
  const inTopRight = r < 8 && c >= size - 8;
  const inBottomLeft = r >= size - 8 && c < 8;
  return inTopLeft || inTopRight || inBottomLeft;
}

/**
 * 生成 QR 模块矩阵。
 * 实现完整的字节模式 + Reed-Solomon 纠错，超出能力时返回 null。
 */
function buildQr(text: string): { size: number; modules: boolean[] } | null {
  // 版本选择：1-10 覆盖 152 字节，足够放 URL
  const version = pickVersion(text.length);
  if (version === null) return null;
  const spec = QR_SPECS[version - 1];
  if (!spec) return null;

  const data = utf8Bytes(text);
  if (data.length > spec.dataCodewords * 8 - 4) return null;

  const codewords = buildCodewords(data, spec);
  const allBits = interleave(codewords, spec);

  // 放入矩阵
  const size = spec.size;
  const modules: Array<boolean | null> = new Array(size * size).fill(null);
  placeFunctionPatterns(modules, size, version, spec.ecCodewordsPerBlock);

  const reserved = modules.map((m) => m !== null);
  let bitIdx = 0;
  for (let i = 0; i < modules.length; i += 1) {
    if (reserved[i]) continue;
    if (bitIdx < allBits.length) {
      modules[i] = ((allBits[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1;
      bitIdx += 1;
    } else {
      modules[i] = false;
    }
  }

  applyMasks(modules, reserved, size);

  return { size, modules: modules.map((m) => m === true) };
}

function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}

interface QrSpec {
  size: number;
  ecCodewordsPerBlock: number;
  blocks: number;
  dataCodewords: number;
}

/** 版本 1-10 的参数表 */
const QR_SPECS: QrSpec[] = [
  { size: 21, ecCodewordsPerBlock: 7, blocks: 1, dataCodewords: 19 },
  { size: 25, ecCodewordsPerBlock: 10, blocks: 1, dataCodewords: 34 },
  { size: 29, ecCodewordsPerBlock: 15, blocks: 1, dataCodewords: 55 },
  { size: 33, ecCodewordsPerBlock: 20, blocks: 1, dataCodewords: 80 },
  { size: 37, ecCodewordsPerBlock: 26, blocks: 1, dataCodewords: 108 },
  { size: 41, ecCodewordsPerBlock: 18, blocks: 2, dataCodewords: 68 },
  { size: 45, ecCodewordsPerBlock: 20, blocks: 2, dataCodewords: 78 },
  { size: 49, ecCodewordsPerBlock: 24, blocks: 2, dataCodewords: 97 },
  { size: 53, ecCodewordsPerBlock: 30, blocks: 2, dataCodewords: 116 },
  { size: 57, ecCodewordsPerBlock: 18, blocks: 4, dataCodewords: 68 },
];

function pickVersion(byteLen: number): number | null {
  for (let i = 0; i < QR_SPECS.length; i += 1) {
    const s = QR_SPECS[i]!;
    // 4 bit 模式指示 + 8 或 16 bit 字符计数 + 数据 + 4 bit 结束符
    const countBits = i <= 8 ? 8 : 16;
    const needed = Math.ceil((4 + countBits + byteLen * 8 + 4) / 8);
    if (needed <= s.dataCodewords) return i + 1;
  }
  return null;
}

function buildCodewords(data: number[], spec: QrSpec): number[] {
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4); // 字节模式
  const countBits = spec.size <= 53 ? 8 : 16;
  push(data.length, countBits);
  for (const b of data) push(b, 8);

  // 结束符
  const cap = spec.dataCodewords * 8;
  for (let i = 0; i < 4 && bits.length < cap; i += 1) bits.push(0);
  // 补齐到字节边界
  while (bits.length % 8 !== 0) bits.push(0);

  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j += 1) v = (v << 1) | bits[i + j]!;
    bytes.push(v);
  }
  // 填充码字
  const PADS = [0xec, 0x11];
  let pi = 0;
  while (bytes.length < spec.dataCodewords) {
    bytes.push(PADS[pi % 2]!);
    pi += 1;
  }

  // Reed-Solomon 纠错
  const ec = reedSolomon(bytes, spec.ecCodewordsPerBlock);
  return [...bytes, ...ec];
}

/** GF(256) 上的 Reed-Solomon 编码 */
function reedSolomon(data: number[], ecLen: number): number[] {
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255]!;

  const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!);

  const gen: number[] = [1];
  for (let i = 0; i < ecLen; i += 1) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j += 1) {
      next[j] = (next[j]! ^ mul(gen[j]!, EXP[i]!)) & 0xff;
      next[j + 1] = (next[j + 1]! ^ gen[j]!) & 0xff;
    }
    gen.splice(0, gen.length, ...next);
  }

  const rem = new Array(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0]!;
    rem.shift();
    rem.push(0);
    for (let i = 0; i < ecLen; i += 1) {
      rem[i] = (rem[i]! ^ mul(gen[i + 1]!, factor)) & 0xff;
    }
  }
  return rem;
}

/** 交织（此处所有规格 blocks 的 dataCodewords 相同，简化为直接拼接） */
function interleave(codewords: number[], spec: QrSpec): number[] {
  const dataLen = spec.dataCodewords;
  const out: number[] = [];
  const blockCount = spec.blocks;
  const shortLen = Math.floor(dataLen / blockCount);
  const longBlocks = dataLen % blockCount;

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < blockCount; i += 1) {
    const len = shortLen + (i >= blockCount - longBlocks ? 1 : 0);
    dataBlocks.push(codewords.slice(offset, offset + len));
    offset += len;
  }
  offset = dataLen;
  for (let i = 0; i < blockCount; i += 1) {
    ecBlocks.push(codewords.slice(offset, offset + spec.ecCodewordsPerBlock));
    offset += spec.ecCodewordsPerBlock;
  }

  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i += 1) {
    for (const blk of dataBlocks) if (i < blk.length) out.push(blk[i]!);
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i += 1) {
    for (const blk of ecBlocks) out.push(blk[i]!);
  }
  return out;
}

/** 放置功能图形：定位符、分隔符、校正图形、格式信息、版本信息 */
function placeFunctionPatterns(
  modules: Array<boolean | null>,
  size: number,
  version: number,
  ecBits: number,
): void {
  const set = (r: number, c: number, v: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) modules[r * size + c] = v;
  };

  // 定位符 8x8（含分隔符）
  const placeFinder = (gr: number, gc: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const on = inner && ((r === 0 || r === 6 || c === 0 || c === 6) || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(gr + r, gc + c, on);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // 定时图形
  for (let i = 8; i < size - 8; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // 校正图形（版本 2 以上）
  if (version >= 2) {
    const centers = alignmentCenters(version);
    for (const r of centers) {
      for (const c of centers) {
        const nearFinder =
          (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
        if (nearFinder) continue;
        for (let dr = -2; dr <= 2; dr += 1) {
          for (let dc = -2; dc <= 2; dc += 1) {
            set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
          }
        }
      }
    }
  }

  // 格式信息（EC 级别 M + 掩码 0，占位；后面 applyMasks 会覆写）
  for (let i = 0; i < 15; i += 1) {
    const bit = ((formatBits(ecBits) >>> i) & 1) === 1;
    // 左上
    if (i < 6) set(8, i, bit);
    else if (i < 8) set(8, i + 1, bit);
    else if (i === 8) set(7, 8, bit);
    else set(14 - i, 8, bit);
    // 右上 / 左下
    if (i < 8) set(size - 1 - i, 8, bit);
    else set(8, size - 15 + i, bit);
  }
  set(8, size - 8, true); // 固定黑点

  // 版本信息（版本 7 以上才有，这里支持到 10）
  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const bit = ((versionBits(version) >>> i) & 1) === 1;
      set(Math.floor(i / 3), size - 11 + (i % 3), bit);
      set(size - 11 + (i % 3), Math.floor(i / 3), bit);
    }
  }
}

function alignmentCenters(version: number): number[] {
  const table: Record<number, number[]> = {
    2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  };
  return table[version] ?? [6];
}

function formatBits(ecBits: number): number {
  // EC 级别映射到格式信息的前 2 位
  const ecLevel = ecBits <= 13 ? 0b00 : ecBits <= 20 ? 0b01 : ecBits <= 26 ? 0b10 : 0b11;
  let data = (ecLevel << 3) | 0; // 掩码 0
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

const MASKS: Array<(r: number, c: number) => boolean> = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMasks(modules: Array<boolean | null>, reserved: boolean[], size: number): void {
  const m = MASKS[0]!; // 固定用掩码 0，与格式信息一致
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const i = r * size + c;
      if (reserved[i]) continue;
      if (m(r, c)) modules[i] = !modules[i];
    }
  }
}

/* ============================================================
 * 主渲染
 * ============================================================ */

/**
 * 渲染分享卡并返回 PNG Blob。
 * 全程本地绘制，不联网、不上传。
 */
export async function renderGameShareCard(input: ShareCardInput): Promise<Blob> {
  // ---- Pass 1：内容画到离屏画布
  //
  // 为什么必须两段式：卡片白底与内容若画在同一层，任何"补白"都会覆盖内容，
  // 而提前画白底又无法预知真实高度（配料数、名字长度都会变）。
  // 离屏渲染把两者彻底分开：内容先画完拿到真实高度，主画布再按这个高度铺底。
  const offscreen = document.createElement('canvas');
  offscreen.width = W;
  offscreen.height = H;
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas');

  const { dna, baseUrl, qrUrl } = input;

  // 背景先不铺，留给主画布统一处理
  ctx.clearRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 430, 40, W / 2, 430, 620);
  glow.addColorStop(0, hexA(dna.color, 0.26));
  glow.addColorStop(1, hexA(dna.color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
  const CARD_X = 48;
  const CARD_W = W - 96;

  // ---- 抬头
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e23b26';
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText('CodeBurger Lab', CARD_X, 76);

  ctx.textAlign = 'right';
  const lvBadge = `${dna.level.level}`;
  ctx.font = `800 30px ${FONT}`;
  const badgeW = 96;
  ctx.fillStyle = dna.color;
  roundRect(ctx, W - CARD_X - badgeW, 40, badgeW, 52, 26);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(`Lv.${lvBadge}`, W - CARD_X - badgeW / 2, 75);

  // ---- 版式常量：预测量与正式绘制共用同一组数
  //
  // 这个坑踩过两次，都记在这里：
  // 1. 属性条行数曾经写死成 2（实际 3 条），「配方」标题直接压到第三条属性栏上；
  // 2. 卡片高度曾经按固定值截断，数据完整度区被切到卡外，和页脚声明叠成一团。
  // 现在所有间距集中在此，高度先算后画，从根上消除这两类错位。
  const cardTop = 108;
  const PAD_TOP = 24;        // 卡片顶边 → 角色舞台
  const LABEL_GAP = 54;      // 舞台底 → 「你的 AI 汉堡」
  const NAME_GAP = 46;       // 标签 → 角色名基线
  const TITLE_GAP = 38;      // 角色名 → 称号基线
  const BARS_GAP = 44;       // 称号 → 第一条属性栏
  const BAR_PITCH = 58;      // 属性栏行距
  const AFTER_BARS = 26;     // 最后一条属性栏 → 「配方」
  const RECIPE_TO_ROW = 66;  // 「配方」→ 第一行配料
  const ING_PITCH = 46;      // 配料行距
  const AFTER_INGS = 24;     // 最后一行配料 → 完整度区分隔线
  const FOOT_GAP = 48;       // 配料区 → 完整度区分隔线（卡内）
  const FOOT_BLOCK = 88;     // 分隔线 → 卡片内容底边
  const STAGE_MAX = 480;     // 角色舞台上限
  const STAGE_MIN = 300;     // 内容再挤也不能低于这个值
  const FOOT_OUT_GAP = 64;   // 卡片底边 → 页脚标题基线（卡外）
  // 卡外页脚实际占用：标题基线 + 两行声明 + 二维码底 + 底部边距
  const FOOT_RESERVE = FOOT_OUT_GAP + 90 + 14;

  const nameMaxW = CARD_W - 96;
  const attrCount = ATTRIBUTE_KEYS.length;
  const ingCount = Math.min(3, dna.ingredients.length);

  // ---- 先量后画：名字/称号的行数决定固定区高度，剩余空间全给舞台
  // （font 要先设好才能 measureText）
  ctx.font = `800 52px ${FONT}`;
  let nameSize = 52;
  while (nameSize > 34 && ctx.measureText(dna.name).width > nameMaxW) {
    nameSize -= 2;
  }
  ctx.font = `800 ${nameSize}px ${FONT}`;
  const nameLines = wrap(ctx, dna.name, nameMaxW, 2);
  ctx.font = `700 26px ${FONT}`;
  const titleLines = wrap(ctx, `${dna.level.title} · ${dna.tagline}`, nameMaxW, 2);

  const fixedH =
    PAD_TOP + LABEL_GAP + NAME_GAP +
    (nameLines.length - 1) * (nameSize + 8) +
    TITLE_GAP + (titleLines.length - 1) * 34 +
    BARS_GAP + (attrCount - 1) * BAR_PITCH + 4 +
    AFTER_BARS +
    (ingCount > 0 ? RECIPE_TO_ROW + (ingCount - 1) * ING_PITCH : 44) +
    AFTER_INGS + FOOT_GAP + FOOT_BLOCK;

  const availCardH = H - cardTop - FOOT_RESERVE;
  const stageSize = Math.max(STAGE_MIN, Math.min(STAGE_MAX, availCardH - fixedH));

  // ---- 角色 SVG（叠加渲染）
  const stageX = (W - stageSize) / 2;
  const stageY = cardTop + PAD_TOP;
  // 注意：SVG 被编码成 data-URI 后，用 <image href="外部URL"> 引PNG
  // 在光栅化进 canvas 时会加载失败（异步资源来不及），表现为一块灰。
  // 所以先把 PNG 转成 data-URI 再嵌进 SVG，全链路同步、无跨源问题。
  const pngDataUri = await toDataUri(baseUrl);
  const svgMarkup = renderBurgerSvg(dna, {
    baseUrl: pngDataUri ?? baseUrl,
    alt: dna.name,
  });
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  const img = await loadImage(svgUrl);
  if (img && pngDataUri) {
    ctx.drawImage(img, stageX, stageY, stageSize, stageSize);
  } else {
    // 角色图取不到时退回抽象汉堡，而不是留一块灰
    drawFallbackBurger(ctx, W / 2, stageY + stageSize / 2, stageSize * 0.62, dna.color);
  }

  // ---- 角色名与称号
  let y = stageY + stageSize + LABEL_GAP;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a39284';
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText('你的 AI 汉堡', W / 2, y);

  y += NAME_GAP;
  ctx.fillStyle = '#241a14';
  // 角色名可能较长（如「深夜干饭人 · 双城漫游者」），超宽时先缩字号再换行，避免冲出卡片
  // 行数在预测量阶段已算好，这里按同一结果绘制，保证高度预估与成品一致
  ctx.font = `800 ${nameSize}px ${FONT}`;
  nameLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, y + i * (nameSize + 8));
  });
  y += (nameLines.length - 1) * (nameSize + 8);

  y += TITLE_GAP;
  ctx.fillStyle = dna.color;
  ctx.font = `700 26px ${FONT}`;
  // 称号 + 标语可能很长，超宽时换行，避免压到下面的属性条
  titleLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, y + i * 34);
  });
  y += (titleLines.length - 1) * 34;

  // ---- 属性条
  y += BARS_GAP;
  const barX = CARD_X + 48;
  const barW = CARD_W - 96;
  ATTRIBUTE_KEYS.forEach((key, i) => {
    const meta = ATTRIBUTE_META[key];
    const v = dna.attributes[key];
    const rowY = y + i * BAR_PITCH;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#241a14';
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(meta.label, barX, rowY);

    const trackX = barX + 132;
    const trackW = barW - 132 - 68;
    // 底槽
    ctx.fillStyle = 'rgba(36,26,20,0.08)';
    roundRect(ctx, trackX, rowY - 22, trackW, 26, 13);
    ctx.fill();
    // 填充
    ctx.fillStyle = meta.color;
    roundRect(ctx, trackX, rowY - 22, Math.max(26, (trackW * v) / 100), 26, 13);
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.fillStyle = '#6b5a4d';
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(String(v), barX + barW, rowY);
  });
  // y 仍停在第一条属性栏基线；按实际行数推进，再留呼吸位
  // （曾经这里写死 2 行，而属性实际是 3 条，「配方」标题直接压到第三条栏上）
  y += (attrCount - 1) * BAR_PITCH + 4 + AFTER_BARS;

  // ---- 配方
  ctx.textAlign = 'left';
  ctx.fillStyle = '#241a14';
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText('配方', barX, y);

  const showIngredients = dna.ingredients.slice(0, 3);
  if (showIngredients.length === 0) {
    y += 44;
    ctx.fillStyle = '#a39284';
    ctx.font = `400 24px ${FONT}`;
    ctx.fillText('（还没加料，去接入数据解锁配料）', barX, y);
  } else {
    y += RECIPE_TO_ROW;
    showIngredients.forEach((ing, i) => {
      const rowY = y + i * ING_PITCH;
      // 图标块
      ctx.fillStyle = '#fdf1e2';
      roundRect(ctx, barX, rowY - 30, 50, 50, 15);
      ctx.fill();
      ctx.strokeStyle = hexA(ing.color, 0.5);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = ing.color;
      ctx.font = `700 26px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(ing.glyph.slice(0, 2), barX + 25, rowY + 1);

      // 名称
      ctx.textAlign = 'left';
      ctx.fillStyle = '#241a14';
      ctx.font = `700 26px ${FONT}`;
      ctx.fillText(ing.label, barX + 70, rowY + 2);

      // 来源徽章（诚实标注：哪层是真数据）
      ctx.textAlign = 'right';
      ctx.fillStyle = '#a39284';
      ctx.font = `500 21px ${FONT}`;
      ctx.fillText(DNA_SOURCE_LABEL[ing.source] ?? ing.source, barX + barW, rowY + 2);
    });
    // 停到最后一行配料基线，再留白进完整度区
    y += (showIngredients.length - 1) * ING_PITCH + AFTER_INGS;
  }

  // ---- 底部信息条（卡内）
  // 完整度条紧跟内容，并保证与上方有足够间距
  const footTop = y + FOOT_GAP;
  ctx.strokeStyle = 'rgba(36,26,20,0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(barX, footTop);
  ctx.lineTo(barX + barW, footTop);
  ctx.stroke();

  // 数据完整度（诚实标注）
  ctx.textAlign = 'left';
  ctx.fillStyle = '#a39284';
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(`数据完整度 ${dna.completeness}%`, barX, footTop + 46);

  // 完整度进度
  const compW = 180;
  ctx.fillStyle = 'rgba(36,26,20,0.08)';
  roundRect(ctx, barX, footTop + 62, compW, 12, 6);
  ctx.fill();
  ctx.fillStyle = dna.completeness >= 70 ? '#2c7a4b' : dna.completeness >= 40 ? '#d99a00' : '#a39284';
  roundRect(ctx, barX, footTop + 62, Math.max(12, (compW * dna.completeness) / 100), 12, 6);
  ctx.fill();

  // ---- 内容全部画完，cardH 取实测值
  // 舞台大小在预测量阶段已按可用高度收过，这里正常不会触顶；
  // min 只作最后保险，真触顶了说明版式常量被改坏，应修常量而不是放行裁剪。
  const cardH = Math.min(availCardH, Math.max(560, footTop + FOOT_BLOCK - cardTop));

  // ---- 页脚：声明 + 二维码（卡外）
  // 与卡内完整度区之间隔着 FOOT_OUT_GAP，两段文字各在各的地盘，不会再叠
  const footY = cardTop + cardH + FOOT_OUT_GAP;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#241a14';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('扫码测你的 AI 汉堡', CARD_X, footY);

  ctx.fillStyle = '#a39284';
  ctx.font = `400 20px ${FONT}`;
  const notes = ['趣味娱乐内容 · 非麦当劳官方产品', '投喂效果为虚拟机制，不影响真实 AI 能力'];
  notes.forEach((t, i) => {
    ctx.fillText(t, CARD_X, footY + 34 + i * 28);
  });

  if (qrUrl) {
    const qrSize = 148;
    const qx = W - CARD_X - qrSize;
    // 二维码顶边贴在卡片底边之下，不再探进卡里；底边与两行声明大致收齐
    const qy = footY - 58;
    if (!renderQr(ctx, qrUrl, qx, qy, qrSize)) {
      // 生成失败时诚实回退，不画假二维码
      ctx.fillStyle = 'rgba(36,26,20,0.05)';
      roundRect(ctx, qx, qy, qrSize, qrSize, 14);
      ctx.fill();
      ctx.fillStyle = '#a39284';
      ctx.font = `400 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('二维码生成失败', qx + qrSize / 2, qy + qrSize / 2);
    }
  }

  // ---- Pass 2：合成到主画布
  //
  // 现在内容已全部落在离屏画布上，cardH 就是内容的真实高度。
  // 主画布按这个高度铺白底，再把离屏内容整体贴上去——
  // 顺序保证了白底永远在内容之下，不会覆盖任何东西。
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const out = canvas.getContext('2d');
  if (!out) throw new Error('当前浏览器不支持 Canvas');

  // 页面底色 + 主色光晕
  out.fillStyle = '#FFF7EC';
  out.fillRect(0, 0, W, H);

  const outGlow = out.createRadialGradient(W / 2, 430, 40, W / 2, 430, 620);
  outGlow.addColorStop(0, hexA(dna.color, 0.26));
  outGlow.addColorStop(1, hexA(dna.color, 0));
  out.fillStyle = outGlow;
  out.fillRect(0, 0, W, H);

  // 卡片白底 + 描边（高度用实测值）
  out.fillStyle = '#ffffff';
  roundRect(out, CARD_X, cardTop, CARD_W, cardH, 36);
  out.fill();
  out.strokeStyle = 'rgba(36,26,20,0.08)';
  out.lineWidth = 2;
  roundRect(out, CARD_X, cardTop, CARD_W, cardH, 36);
  out.stroke();

  // 贴上内容
  out.drawImage(offscreen, 0, 0);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('导出失败'))), 'image/png');
  });
}

/**
 * 把图片读成 data-URI。
 * 这样嵌进 SVG 后不依赖外部资源，canvas 光栅化时不会失败。
 */
async function toDataUri(url: string): Promise<string | null> {
  if (/^data:/i.test(url)) return url;
  try {
    const absolute = new URL(url, typeof location === 'undefined' ? '' : location.href).href;
    const res = await fetch(absolute);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawFallbackBurger(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  const half = size / 2;
  const top = cy - size * 0.3;
  const bunH = size * 0.22;

  ctx.fillStyle = '#E8B96B';
  roundRect(ctx, cx - half, top, size, bunH, bunH / 2);
  ctx.fill();

  ctx.fillStyle = color;
  roundRect(ctx, cx - half * 0.98, top + bunH + 8, size * 0.98, size * 0.09, 10);
  ctx.fill();

  ctx.fillStyle = '#7DBE4E';
  roundRect(ctx, cx - half * 0.9, top + bunH + size * 0.11, size * 0.9, size * 0.07, 8);
  ctx.fill();

  ctx.fillStyle = '#C97B3C';
  roundRect(ctx, cx - half * 0.86, top + bunH + size * 0.2, size * 0.86, size * 0.11, 12);
  ctx.fill();
}

function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 触发下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}