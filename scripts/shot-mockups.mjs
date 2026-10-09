#!/usr/bin/env node
/**
 * 把 mockups/ 下的四张设计稿截成 PNG，方便快速自查版式。
 *
 * 只是自查工具：截图产物落在 .preview/，已被 .gitignore 排除，不入库。
 * 浏览器可执行文件按下面的顺序找：
 *   1. 环境变量 CHROME_PATH
 *   2. Playwright 的 chrome-headless-shell（本机已装）
 *   3. 系统 Chrome / Edge 常见路径
 *
 * 用法：npm run shot
 */

import { readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  path.join(
    os.homedir(),
    'AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe',
  ),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error('没找到浏览器。可以先设置环境变量 CHROME_PATH 指向 chrome 或 msedge。');
  process.exit(1);
}

const MOCKUP_DIR = path.resolve('mockups');
const OUT_DIR = path.resolve('.preview');
mkdirSync(OUT_DIR, { recursive: true });

const pages = readdirSync(MOCKUP_DIR).filter((n) => n.endsWith('.html'));
if (!pages.length) {
  console.error('mockups/ 里没有 HTML，先跑 npm run mockups');
  process.exit(1);
}

console.log(`浏览器：${chrome}\n`);
for (const name of pages) {
  const src = path.join(MOCKUP_DIR, name);
  // 宽版设定表用桌面尺寸，手机页面用 430 宽
  const isWide = readFileSync(src, 'utf8').includes('class="cb-sheet"');
  const size = isWide ? '1280,980' : '430,1400';
  const out = path.join(OUT_DIR, name.replace(/\.html$/, '.png'));
  const r = spawnSync(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${size}`,
      `--screenshot=${out}`,
      src,
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    const why = r.error ? `${r.error.code || ''} ${r.error.message}` : r.stderr || `退出码 ${r.status}`;
    console.error(`截图失败：${name} → ${why}`);
    if (r.error && r.error.code === 'EBUSY') {
      console.error('  （受限沙箱里 node 无法 spawn 子进程。改用命令行直接调浏览器：）');
      console.error(`  "${chrome}" --headless --disable-gpu --hide-scrollbars --window-size=${size} --screenshot="${out}" "${src}"`);
    }
    process.exitCode = 1;
    continue;
  }
  console.log(`已截图 ${name} → .preview/${path.basename(out)}（${size}）`);
}
console.log('\n截图产物在 .preview/（已 gitignore，不入库）。');
