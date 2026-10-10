/**
 * Agent 投喂机制测试。
 *
 * 重点验证「无配料也能走通主流程」——这是 GitHub 加料失败时的降级路径。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { feed, idleLine } from '../src/agent/feed.ts';

const mkTopping = (boost) => ({
  id: 'x',
  label: '配料',
  flavor: '测试用',
  glyph: 'X',
  agentBoost: boost,
});

test('无配料时饱腹度也必须增长，不能永远卡在 0', () => {
  let fullness = 0;
  for (let i = 0; i < 5; i++) {
    fullness = feed({ baseEffect: 'focus', toppings: [], fullness }).fullness;
  }
  assert.ok(fullness > 0, `无配料时饱腹度应增长，实际 ${fullness}`);
  assert.ok(fullness >= 55, `5 口之后应达到状态阈值，实际 ${fullness}`);
});

test('无配料也能走到 full 状态', () => {
  let fullness = 0;
  let last = null;
  for (let i = 0; i < 12; i++) {
    last = feed({ baseEffect: 'focus', toppings: [], fullness });
    fullness = last.fullness;
  }
  assert.equal(last.state, 'full');
  assert.equal(fullness, 100);
});

test('饱腹度永不超过 100', () => {
  let fullness = 90;
  for (let i = 0; i < 10; i++) {
    fullness = feed({
      baseEffect: 'bug',
      toppings: [mkTopping(50)],
      fullness,
    }).fullness;
  }
  assert.equal(fullness, 100);
});

test('配料越多推进越快，但不影响最终可达状态', () => {
  const noTopping = feed({ baseEffect: 'slack', toppings: [], fullness: 0 });
  const withTopping = feed({
    baseEffect: 'slack',
    toppings: [mkTopping(20), mkTopping(20), mkTopping(20)],
    fullness: 0,
  });
  assert.ok(
    withTopping.fullness > noTopping.fullness,
    '配料应带来更快的饱腹度增长',
  );
  assert.equal(withTopping.state, 'slack');
});

test('达到阈值后进入人格对应状态，四种效果各自生效', () => {
  for (const effect of ['focus', 'inspiration', 'bug', 'slack']) {
    const res = feed({
      baseEffect: effect,
      toppings: [mkTopping(60)],
      fullness: 0,
    });
    assert.equal(res.state, effect, `${effect} 应进入自身状态`);
    assert.ok(res.line.length > 0);
    assert.match(res.feedback, /进入/);
  }
});

test('未达阈值时不谎称已进入状态', () => {
  const res = feed({ baseEffect: 'focus', toppings: [], fullness: 0 });
  assert.doesNotMatch(res.feedback, /进入「/);
  assert.match(res.feedback, /再喂几口/);
});

test('idle 基础效果在未达阈值时保持 idle', () => {
  const res = feed({ baseEffect: 'idle', toppings: [], fullness: 0 });
  assert.equal(res.state, 'idle');
  assert.ok(res.line.length > 0);
});

test('idleLine 随饱腹度分层，总有话说', () => {
  for (const f of [0, 10, 40, 70, 100]) {
    assert.ok(idleLine(f).length > 0, `饱腹度 ${f} 应有台词`);
  }
});

test('投喂结果字段完整，UI 可直接渲染', () => {
  const res = feed({ baseEffect: 'bug', toppings: [mkTopping(10)], fullness: 0 });
  assert.equal(typeof res.state, 'string');
  assert.equal(typeof res.fullness, 'number');
  assert.equal(typeof res.line, 'string');
  assert.equal(typeof res.feedback, 'string');
  assert.equal(typeof res.boost, 'number');
  assert.ok(res.boost > 0);
});

test('配料缺agentBoost 时按默认值计算，不产生 NaN', () => {
  const noBoost = { id: 'a', label: 'a', flavor: 'a', glyph: 'A' };
  const res = feed({ baseEffect: 'focus', toppings: [noBoost], fullness: 0 });
  assert.ok(Number.isFinite(res.fullness), '饱腹度不应为 NaN');
  assert.ok(res.fullness > 0);
});