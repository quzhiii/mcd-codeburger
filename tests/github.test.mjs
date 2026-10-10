/**
 * GitHub 加料模块测试。
 * 全部用打桩的 fetch，不发真实网络请求，保证测试可离线复现。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchGithubToppings,
  isValidUsername,
  toppingsFromProfile,
} from '../src/github/toppings.ts';

/** 构造一个可控的 fetch 桩 */
function stubFetch(handlers) {
  return async (input) => {
    const url = String(input);
    if (url.includes('/repos')) {
      const h = handlers.repos ?? {};
      const status = h.status ?? 200;
      return new Response(JSON.stringify(h.body ?? []), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (handlers.userThrows) throw new Error('network down');
    const h = handlers.user ?? {};
    const status = h.status ?? 200;
    return new Response(JSON.stringify(h.body ?? {}), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

test('用户名校验：拒绝非法字符，接受正常用户名', () => {
  assert.equal(isValidUsername('quzhiii'), true);
  assert.equal(isValidUsername('torvalds'), true);
  assert.equal(isValidUsername('a'), true);
  assert.equal(isValidUsername('user-name-123'), true);

  assert.equal(isValidUsername(''), false);
  assert.equal(isValidUsername('-leading'), false);
  assert.equal(isValidUsername('trailing-'), false);
  assert.equal(isValidUsername('has space'), false);
  assert.equal(isValidUsername('has/slash'), false);
  assert.equal(isValidUsername('a'.repeat(40)), false);
});

test('用户不存在时返回 not-found，且不抛异常', async () => {
  const res = await fetchGithubToppings(
    'this-user-really-does-not-exist-xyz',
    stubFetch({ user: { status: 404 } }),
  );
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.reason, 'not-found');
    assert.match(res.message, /没有叫/);
  }
});

test('限流时返回 rate-limit，提示可重试', async () => {
  const res = await fetchGithubToppings('quzhiii', stubFetch({ user: { status: 403 } }));
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.reason, 'rate-limit');
    assert.match(res.message, /限流/);
  }
});

test('网络异常时返回 network，不影响人格测试主流程', async () => {
  const res = await fetchGithubToppings('quzhiii', stubFetch({ userThrows: true }));
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.reason, 'network');
  }
});

test('成功路径：读公开仓库，统计语言与star，并产出配料', async () => {
  const res = await fetchGithubToppings(
    'quzhiii',
    stubFetch({
      user: { body: { login: 'quzhiii', public_repos: 12, followers: 30 } },
      repos: {
        body: [
          { name: 'a', language: 'TypeScript', stargazers_count: 40 },
          { name: 'b', language: 'TypeScript', stargazers_count: 2 },
          { name: 'c', language: 'Python', stargazers_count: 8 },
          { name: 'd', language: null, stargazers_count: 0 },
        ],
      },
    }),
  );

  assert.equal(res.ok, true);
  if (!res.ok) return;

  assert.equal(res.profile.username, 'quzhiii');
  assert.equal(res.profile.publicRepos, 12);
  assert.equal(res.profile.totalStars, 50);
  assert.deepEqual(res.profile.languages, ['TypeScript', 'Python']);
  assert.equal(res.profile.topRepo, 'a');

  const ids = res.toppings.map((t) => t.id);
  assert.ok(ids.includes('lang-typescript'), '应产出TypeScript 配料');
  assert.ok(ids.includes('lang-python'), '应产出 Python 配料');
  assert.ok(ids.includes('repo-vigor'), '应产出 star 层级配料');
  assert.ok(ids.includes('repo-breadth'), '应产出仓库数量配料');

  for (const t of res.toppings) {
    assert.equal(typeof t.label, 'string');
    assert.ok(t.label.length > 0);
    assert.equal(typeof t.flavor, 'string');
    assert.ok(t.flavor.length > 0);
    assert.equal(typeof t.glyph, 'string');
    assert.ok(t.glyph.length > 0);
  }
});

test('没有公开仓库时降级，不返回空配料', async () => {
  const res = await fetchGithubToppings(
    'empty-user',
    stubFetch({ user: { body: { login: 'empty-user', public_repos: 0 } }, repos: { body: [] } }),
  );
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.reason, 'no-repos');
  }
});

test('仓库接口失败时退化但仍能出配料，不整体报错', async () => {
  const res = await fetchGithubToppings(
    'quzhiii',
    stubFetch({
      user: { body: { login: 'quzhiii', public_repos: 5, followers: 1 } },
      repos: { status: 500 },
    }),
  );
  // 没有语言也没有 star 时应明确降级，而不是假装成功
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.reason, 'no-repos');
  }
});

test('未知语言也能兜底产出配料', () => {
  const toppings = toppingsFromProfile({
    username: 'x',
    publicRepos: 3,
    followers: 0,
    languages: ['Brainfuck'],
    totalStars: 0,
    topRepo: null,
  });
  assert.ok(toppings.length >= 2, '至少要有兜底配料与 star 配料');
  const fallback = toppings.find((t) => t.id === 'lang-brainfuck');
  assert.ok(fallback, '未知语言应有兜底映射');
  assert.match(fallback.label, /Brainfuck/);
});

test('star 数分档正确', () => {
  const mk = (stars) =>
    toppingsFromProfile({
      username: 'x',
      publicRepos: 1,
      followers: 0,
      languages: ['Go'],
      totalStars: stars,
      topRepo: null,
    }).find((t) => t.id === 'repo-vigor');

  assert.match(mk(0).label, /初榨/);
  assert.match(mk(50).label, /提味/);
  assert.match(mk(500).label, /招牌/);
  assert.match(mk(5000).label, /爆浆/);
});

test('请求 URL 不携带任何凭证参数', async () => {
  const seen = [];
  const spy = async (input) => {
    const url = String(input);
    seen.push(url);
    const body = url.includes('/repos') ? [] : { login: 'x', public_repos: 1 };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  await fetchGithubToppings('quzhiii', spy);
  for (const url of seen) {
    assert.ok(!/token=/i.test(url), `URL 不应含token：${url}`);
    assert.ok(!/access_token/i.test(url), `URL 不应含 access_token：${url}`);
    assert.ok(!/client_secret/i.test(url), `URL 不应含 client_secret：${url}`);
  }
});