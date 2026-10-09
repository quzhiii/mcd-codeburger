import { test } from 'node:test';
import assert from 'node:assert/strict';

import { QUESTIONS } from '../src/persona/questions.ts';
import { PERSONAS } from '../src/persona/personas.ts';
import { evaluate, resolvePersona, scoreAnswers } from '../src/persona/scoring.ts';
import { DIMENSIONS } from '../src/persona/types.ts';

test('题库：5 题，每题只覆盖一个维度，五个维度全覆盖', () => {
  assert.equal(QUESTIONS.length, 5, '题库必须是 5 题');
  const dims = QUESTIONS.map((q) => q.dimension);
  assert.deepEqual(new Set(dims).size, 5, '五个维度必须各出一题');
  for (const d of DIMENSIONS) {
    assert.ok(dims.includes(d), `缺少维度 ${d}`);
  }
});

test('题库：每题选项 id 唯一，且权重只取 -1 / 0 / +1', () => {
  for (const q of QUESTIONS) {
    const ids = q.options.map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, `${q.id} 的选项 id 有重复`);
    for (const o of q.options) {
      for (const v of Object.values(o.weights)) {
        assert.ok([-1, 0, 1].includes(v), `${q.id}/${o.id} 权重只能是 -1/0/+1，实际 ${v}`);
      }
    }
  }
});

test('角色：8 个，personaId 唯一，且全部是汉堡形态（有面包与夹层描述）', () => {
  assert.equal(PERSONAS.length, 8, '必须是 8 个角色');
  const ids = PERSONAS.map((p) => p.id);
  assert.equal(new Set(ids).size, 8, 'personaId 必须唯一');
  for (const p of PERSONAS) {
    assert.ok(p.visual.bun.length > 0, `${p.id} 缺少面包描述`);
    assert.ok(p.visual.filling.length > 0, `${p.id} 缺少夹层描述`);
    assert.ok(p.visual.prop.length > 0, `${p.id} 缺少装饰描述`);
    assert.ok(p.visual.outfit.length > 0, `${p.id} 缺少服装描述`);
    assert.ok(p.visual.expression.length > 0, `${p.id} 缺少表情描述`);
    assert.ok(p.vec.length === 5, `${p.id} 五维向量长度不对`);
  }
});

test('角色：主色两两不同，保证小尺寸可辨识', () => {
  const colors = PERSONAS.map((p) => p.visual.color.toLowerCase());
  assert.equal(new Set(colors).size, colors.length, '主色有重复');
});

test('原型自洽：把每个角色自身的向量喂回去，必须命中它自己', () => {
  for (const p of PERSONAS) {
    const hit = resolvePersona(p.vec);
    assert.equal(hit.id, p.id, `原型 ${p.id} 的向量命中了 ${hit.id}`);
  }
});

test('全覆盖：枚举全部答案组合，每种都有确定归属，且只落在 8 个角色内', () => {
  const ids = new Set(PERSONAS.map((p) => p.id));
  const answerKeys = new Set();
  const vectors = new Set();
  let count = 0;

  for (const o0 of QUESTIONS[0].options)
    for (const o1 of QUESTIONS[1].options)
      for (const o2 of QUESTIONS[2].options)
        for (const o3 of QUESTIONS[3].options)
          for (const o4 of QUESTIONS[4].options) {
            const answers = {
              [QUESTIONS[0].id]: o0.id,
              [QUESTIONS[1].id]: o1.id,
              [QUESTIONS[2].id]: o2.id,
              [QUESTIONS[3].id]: o3.id,
              [QUESTIONS[4].id]: o4.id,
            };
            const r = evaluate(answers);
            assert.ok(ids.has(r.persona.id), `未命中任何角色：${r.answerKey}`);
            // 每维必须落在 -1 / 0 / +1
            for (const v of r.vec) {
              assert.ok([-1, 0, 1].includes(v), `向量越界：${r.vec.join(',')}`);
            }
            answerKeys.add(r.answerKey);
            vectors.add(r.vec.join(','));
            count += 1;
          }

  // 每题 4 个选项 → 4^5 = 1024 种答题组合
  assert.equal(count, 1024, '答题组合数必须是 4^5 = 1024');
  assert.equal(answerKeys.size, 1024, '存在无法区分的答案组合');
  // 五维向量每个维度只有 3 种取值 → 最多 3^5 = 243 种不同向量
  assert.ok(vectors.size <= 243, `不同向量数 ${vectors.size} 超过 3^5 = 243`);
  // 8 个角色都要被覆盖到，否则属于死角色
  const used = new Set([...answerKeys].map((k) => evaluate(parseKey(k)).persona.id));
  assert.equal(used.size, 8, `只有 ${used.size} 个角色被命中，存在死角色`);
});

/** 把 answerKey 还原成答案表（仅测试用） */
function parseKey(key) {
  const answers = {};
  for (const part of key.split('|')) {
    const [qid, oid] = part.split(':');
    answers[qid] = oid;
  }
  return answers;
}

test('幂等：同一份答案重复求值，结果完全一致', () => {
  const answers = {
    [QUESTIONS[0].id]: 'crowd',
    [QUESTIONS[1].id]: 'ask-staff',
    [QUESTIONS[2].id]: 'same-day',
    [QUESTIONS[3].id]: 'coffee',
    [QUESTIONS[4].id]: 'photo',
  };
  const a = evaluate(answers);
  const b = evaluate({ ...answers });
  assert.equal(a.persona.id, b.persona.id);
  assert.deepEqual(a.vec, b.vec);
  assert.equal(a.answerKey, b.answerKey);
});

test('空答案不抛异常，且返回一个合法角色（用于容错）', () => {
  const vec = scoreAnswers({});
  assert.deepEqual(vec, [0, 0, 0, 0, 0]);
  const p = resolvePersona(vec);
  assert.ok(PERSONAS.some((x) => x.id === p.id));
});
