/**
 * 麦门 DNA 推导引擎测试。
 *
 * 全部用例基于 2026-10-12 MCP 真机返回的数据形状。
 * 重点回归一个真实踩过的坑：奖品中奖时间混进消费时段，
 * 把「晚餐派」误判成「深夜干饭人」。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeMcd, parseCityForTest } from '../src/burger-dna/mcd-dna.ts';

const quizSource = {
  source: 'quiz',
  vector: [0, 0, 0, 0, 0],
  personaId: 'chili-social',
  personaName: '社牛辣椒堡',
  color: '#e23b26',
};

/** 真机order-list 形状 */
const realOrders = [
  {
    createTime: '2026-06-18 19:17:58',
    storeName: '麦当劳杭州滨江双城国际餐厅',
    orderProductList: [
      {
        productName: '人气超值四件套随心选',
        quantity: 1,
        comboItemList: [
          { name: '板烧鸡腿堡', quantity: 1 },
          { name: '中薯条', quantity: 1 },
          { name: '麦辣鸡翅2块', quantity: 1 },
          { name: '可乐中杯', quantity: 1 },
        ],
      },
      { productName: '高达吉士双牛堡', quantity: 1, comboItemList: [] },
    ],
    realTotalAmount: '63.9',
  },
  {
    createTime: '2026-03-11 14:46:06',
    storeName: '麦当劳深圳北站站内四店(A18/A19检票口上方)餐厅',
    orderProductList: [
      {
        productName: '巨无霸三件套',
        quantity: 1,
        comboItemList: [
          { name: '巨无霸', quantity: 1 },
          { name: '中薯条', quantity: 1 },
          { name: '可乐中杯', quantity: 1 },
        ],
      },
    ],
    realTotalAmount: '54.5',
  },
  {
    createTime: '2025-10-24 18:52:53',
    storeName: '麦当劳杭州滨江区华洲中心写字楼餐厅',
    orderProductList: [
      { productName: '白松露风味摇摇薯条', quantity: 1, comboItemList: [] },
      {
        productName: '随心配1+1超值套餐',
        quantity: 1,
        comboItemList: [
          { name: '小薯条', quantity: 1 },
          { name: '可乐中杯', quantity: 1 },
        ],
      },
      { productName: '麦辣鸡翅-2块', quantity: 1, comboItemList: [] },
    ],
    realTotalAmount: '39.8',
  },
];

/** 真机 query-my-prizes 形状，含 00:40 的深夜抽奖记录 */
const realPrizes = [
  { name: '芒种', recordTime: '2026-06-18 19:18:10' },
  { name: '惊蛰', recordTime: '2026-03-11 14:46:19' },
  { name: '二等奖：麦旋风二选一', recordTime: '2026-02-28 18:58:28' },
  { name: '二等奖：牛气满满三件套', recordTime: '2026-02-28 18:58:08' },
  { name: '二等奖：双重薯薯', recordTime: '2026-02-28 18:57:45' },
  { name: '二等奖：麦旋风二选一', recordTime: '2025-11-22 00:40:34' },
  { name: '二等奖：辣翅麦乐鸡', recordTime: '2025-06-14 09:01:30' },
  { name: '二等奖：辣薯二件套', recordTime: '2025-06-14 00:16:12' },
];

const realPoints = { accumulativePoint: '5824.7', availablePoint: '497.3', usedPoint: '1061' };

test('真实数据：判定为辣味探索家，不是深夜干饭人', () => {
  const r = analyzeMcd({ orders: realOrders, prizes: realPrizes, points: realPoints });
  assert.equal(r.dna.archetype, '辣味探索家');
});

test('真实数据：消费时段只认下单时间，应为晚餐派', () => {
  const r = analyzeMcd({ orders: realOrders, prizes: realPrizes, points: realPoints });
  assert.equal(r.dna.rhythmTag, '晚餐派');
  // 3笔订单分别是 19:17 / 14:46 / 18:52 → 2 晚 1 下午，晚餐应占优
});

test('真实数据：口味标签含辣味与鸡肉', () => {
  const r = analyzeMcd({ orders: realOrders, prizes: realPrizes, points: realPoints });
  assert.ok(r.dna.tasteTags.includes('辣味'), '麦辣鸡翅/辣薯应命中辣味');
  assert.ok(r.dna.tasteTags.includes('鸡肉'), '板烧鸡腿堡应命中鸡肉');
  assert.ok(r.dna.tasteTags.includes('牛肉'), '巨无霸应命中牛肉');
});

test('真实数据：统计量准确，样本量必须带上', () => {
  const r = analyzeMcd({ orders: realOrders, prizes: realPrizes, points: realPoints });
  assert.equal(r.dna.stats.orderCount, 3);
  assert.equal(r.dna.stats.prizeCount, 8);
  assert.equal(r.dna.stats.cityCount, 2, '杭州 + 深圳');
  assert.equal(r.dna.stats.spendRange, '39-64');
});

test('小样本时措辞必须诚实，不能说「翻了 N 单」', () => {
  const r = analyzeMcd({ orders: realOrders, prizes: realPrizes, points: realPoints });
  assert.ok(
    r.dna.summary.includes('就这几笔'),
    `样本少时应说明样本量，实际：${r.dna.summary}`,
  );
  assert.ok(!r.dna.summary.includes('翻了'), '不应在 3 单时说「翻了」');
});

test('深夜原型必须真有深夜下单记录', () => {
  // 只有深夜抽奖记录，没有深夜下单 → 不该判深夜干饭人
  const r = analyzeMcd({ orders: realOrders, prizes: realPrizes, points: realPoints });
  assert.notEqual(r.dna.archetype, '深夜干饭人');

  // 补一笔深夜下单 → 应命中
  const withLateOrder = [
    ...realOrders,
    {
      createTime: '2026-10-11 00:30:12',
      storeName: '麦当劳杭州武林广场餐厅',
      orderProductList: [{ productName: '麦辣鸡腿堡三件套', quantity: 1, comboItemList: [] }],
      realTotalAmount: '29.9',
    },
  ];
  const r2 = analyzeMcd({ orders: withLateOrder, prizes: realPrizes, points: realPoints });
  assert.equal(r2.dna.archetype, '深夜干饭人');
});

test('无任何数据时返回 null，不硬造', () => {
  const r = analyzeMcd({});
  assert.equal(r.dna, null);
  assert.deepEqual(r.ingredients, []);
  assert.deepEqual(r.equipment, []);
});

test('只有奖品没有订单时也能出 DNA', () => {
  const r = analyzeMcd({ prizes: realPrizes });
  assert.ok(r.dna, '有奖品就该有 DNA');
  assert.equal(r.dna.stats.orderCount, 0);
  assert.ok(r.dna.summary.includes('没有历史订单'));
});

test('只有订单没有奖品时也能出 DNA', () => {
  const r = analyzeMcd({ orders: realOrders });
  assert.ok(r.dna);
  assert.equal(r.dna.stats.prizeCount, 0);
});

test('单笔订单不算客单价区间', () => {
  const r = analyzeMcd({ orders: [realOrders[0]] });
  assert.equal(r.dna.stats.spendRange, null, '样本不足时不给区间');
});

test('城市识别只取门店名里的城市 token', () => {
  assert.equal(parseCityForTest('麦当劳杭州滨江双城国际餐厅'), '杭州');
  assert.equal(parseCityForTest('麦当劳深圳北站站内四店(A18/A19检票口上方)餐厅'), '深圳');
  assert.equal(parseCityForTest('麦当劳上海'), '上海');
  assert.equal(parseCityForTest('某家不知名餐厅'), null);
  assert.equal(parseCityForTest(undefined), null);
});

test('坏数据不抛异常，稳健降级', () => {
  const bad = [
    { orders: null },
    { orders: [{}] },
    { orders: [{ createTime: 'not-a-date', storeName: '', orderProductList: null }] },
    { orders: [{ orderProductList: [{ productName: null }] }] },
    { orders: [{ realTotalAmount: 'abc' }] },
    { prizes: [{}] },
    { points: { accumulativePoint: 'not-a-number' } },
  ];
  for (const input of bad) {
    const r = analyzeMcd(input);
    assert.ok(r.dna === null || typeof r.dna.archetype === 'string');
  }
});

test('配料与装备的 source 一律标为 mcd', () => {
  const r = analyzeMcd({ orders: realOrders, prizes: realPrizes, points: realPoints });
  for (const ing of r.ingredients) assert.equal(ing.source, 'mcd');
  for (const eq of r.equipment) assert.equal(eq.source, 'mcd');
});

test('推理出的配料符合契约要求', () => {
  const r = analyzeMcd({ orders: realOrders, prizes: realPrizes, points: realPoints });
  for (const ing of r.ingredients) {
    for (const key of ['id', 'label', 'taste', 'glyph', 'color']) {
      assert.ok(typeof ing[key] === 'string' && ing[key].length > 0, `${key} 必须非空`);
    }
    assert.ok(Number.isInteger(ing.layer) && ing.layer >= 0);
  }
});

test('等级依据带上积分信息', () => {
  const r = analyzeMcd({ orders: realOrders, prizes: realPrizes, points: realPoints });
  assert.ok(r.dna.levelBasis.includes('5824.7'));
});