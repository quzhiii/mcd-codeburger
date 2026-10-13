/**
 * 自研 QR 编码器测试。
 *
 * 两条验证线：
 * 1. 结构性断言：定位符 / 分隔符 / 定时线 / 暗点 / 格式信息位置，逐格核对；
 * 2. Reed-Solomon 根校验：码字多项式必须在 g(x) 的根 α^0..α^{ecLen-1} 上取 0，
 *    这是纯数学性质，不依赖任何参考实现。
 *
 * 另有本地比对：与 python-qrcode 同参数（v3 / EC-L / mask 0）输出逐位一致，
 * 以及无头浏览器渲染后的真实扫码解码（见 .v4-shots 脚本）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildQr, reedSolomon } from '../src/burger-dna/share-card.ts';

const URL_ = 'https://codeburger.app.workbuddy.host/';

/* ---------- GF(256) 小工具（仅测试用） ---------- */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
let xx = 1;
for (let i = 0; i < 255; i += 1) {
  EXP[i] = xx;
  LOG[xx] = i;
  xx <<= 1;
  if (xx & 0x100) xx ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** 对多项式（系数高次在前）在 α^power 处求值 */
function evalPoly(coefs, power) {
  let acc = 0;
  for (const c of coefs) acc = mul(acc, EXP[power % 255]) ^ c;
  return acc;
}

const mod = (qr, r, c) => qr.modules[r * qr.size + c];

function checkFinders(qr) {
  const check = (r0, c0) => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const ring = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        assert.equal(mod(qr, r0 + r, c0 + c), ring || core, `定位符(${r0},${c0}) 第(${r},${c})格`);
      }
    }
  };
  check(0, 0);
  check(0, qr.size - 7);
  check(qr.size - 7, 0);
  // 分隔符应为浅色
  for (let i = 0; i < 8; i += 1) {
    assert.equal(mod(qr, 7, i), false, `分隔符行 7 列 ${i}`);
    assert.equal(mod(qr, i, 7), false, `分隔符列 7 行 ${i}`);
  }
}

function checkTiming(qr) {
  for (let i = 8; i < qr.size - 8; i += 1) {
    assert.equal(mod(qr, 6, i), i % 2 === 0, `行 6 列 ${i} 的定时线`);
    assert.equal(mod(qr, i, 6), i % 2 === 0, `列 6 行 ${i} 的定时线`);
  }
}

/* ---------- Reed-Solomon ---------- */

test('RS：码字多项式在 α^0..α^{ecLen-1} 处取 0（生成多项式的根）', () => {
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  for (const ecLen of [7, 10, 15, 26]) {
    const ec = reedSolomon(data, ecLen);
    assert.equal(ec.length, ecLen, `ecLen=${ecLen} 长度`);
    const codeword = [...data, ...ec];
    for (let i = 0; i < ecLen; i += 1) {
      assert.equal(evalPoly(codeword, i), 0, `ecLen=${ecLen}：α^${i} 应为根`);
    }
  }
});

/* ---------- 矩阵结构 ---------- */

test('buildQr：短链接走 3 版（29×29），结构完整', () => {
  const qr = buildQr(URL_);
  assert.ok(qr, '应能编码');
  assert.equal(qr.size, 29);
  checkFinders(qr);
  checkTiming(qr);
  // 固定暗点
  assert.equal(mod(qr, qr.size - 8, 8), true, '暗点 (size-8, 8)');
});

test('buildQr：格式信息两份副本位置正确（EC-L + 掩码 0）', () => {
  const qr = buildQr(URL_);
  // 用同样的 BCH 算法算出期望值
  const data = (0b01 << 3) | 0;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const fmt = ((data << 10) | rem) ^ 0x5412;
  const bit = (i) => ((fmt >>> i) & 1) === 1;

  // 副本一：第 8 列上段 + 第 8 行左段
  for (let i = 0; i <= 5; i += 1) assert.equal(mod(qr, i, 8), bit(i), `副本一 列8 行${i}`);
  assert.equal(mod(qr, 7, 8), bit(6));
  assert.equal(mod(qr, 8, 8), bit(7));
  assert.equal(mod(qr, 8, 7), bit(8));
  for (let i = 9; i < 15; i += 1) assert.equal(mod(qr, 8, 14 - i), bit(i), `副本一 行8 列${14 - i}`);

  // 副本二：第 8 行右段 + 第 8 列下段
  for (let i = 0; i < 8; i += 1) assert.equal(mod(qr, 8, qr.size - 1 - i), bit(i), `副本二 行8 列${qr.size - 1 - i}`);
  for (let i = 8; i < 15; i += 1) assert.equal(mod(qr, qr.size - 15 + i, 8), bit(i), `副本二 列8 行${qr.size - 15 + i}`);
});

test('buildQr：深色比例合理、同输入完全确定', () => {
  const a = buildQr(URL_);
  const b = buildQr(URL_);
  assert.equal(JSON.stringify(a), JSON.stringify(b), '同输入必须逐位一致');
  const dark = a.modules.filter(Boolean).length / a.modules.length;
  assert.ok(dark > 0.35 && dark < 0.65, `深色比例异常：${dark.toFixed(2)}`);
});

test('buildQr：长内容走 v6（多块版本）仍然结构完整', () => {
  const long = `${URL_}?d=${'x'.repeat(80)}`;
  const qr = buildQr(long);
  assert.ok(qr, '应能编码');
  assert.equal(qr.size, 41, '应选择版本 6');
  checkFinders(qr);
  checkTiming(qr);
  assert.equal(mod(qr, qr.size - 8, 8), true);
  const dark = qr.modules.filter(Boolean).length / qr.modules.length;
  assert.ok(dark > 0.35 && dark < 0.65);
});

test('buildQr：超出 10 版容量返回 null（走回退提示）', () => {
  assert.equal(buildQr('x'.repeat(300)), null);
});
