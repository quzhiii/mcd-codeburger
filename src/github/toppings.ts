/**
 * GitHub 公开数据 → 汉堡配料。
 *
 * 合规红线：
 * 1. 只调用 GitHub 公开 API，不做任何登录，不读私有仓库，不使用 Token。
 * 2. 失败（用户不存在 / 限流 / 网络）必须降级，绝不阻塞人格测试主流程。
 * 3. 只取仓库名、语言、star 数这类公开计数，不取任何用户邮箱或个人信息。
 *
 * 隐私说明：用户输入的 GitHub 用户名会发送给 api.github.com（这是取得公开数据的
 * 唯一途径，等同于浏览器访问该用户的公开主页）。除此之外不上传任何数据。
 */

import type { VirtualTopping } from '../spec/burger-spec.ts';

const API = 'https://api.github.com';

/** 语言 → 中文配料名与口味描述的映射表。
 *  export 给 burger-dna/web-dna.ts 复用（装配角色卡时需要同一份字形与语义）。 */
export const LANGUAGE_TOPPING: Record<string, { label: string; flavor: string; glyph: string }> = {
  TypeScript: { label: 'typescript 脆片', flavor: '入口带一点甜，越嚼越上头', glyph: 'TS' },
  JavaScript: { label: 'javascript 软糖', flavor: '看着软，实际粘手', glyph: 'JS' },
  Python: { label: 'python 浓汤', flavor: '温热，慢炖，不能催', glyph: 'PY' },
  Java: { label: 'java 硬核饼干', flavor: '要嚼很久，但很扛饿', glyph: 'JV' },
  Go: { label: 'golang 精简压缩饼', flavor: '什么都没加，但跑得快', glyph: 'GO' },
  Rust: { label: 'rust 嘎吱脆片', flavor: '咬下去有金属声', glyph: 'RS' },
  C: { label: 'c 原味硬饼', flavor: '配料表只有一行', glyph: 'C' },
  'C++': { label: 'cpp 双层夹心', flavor: '层数多，顺序不能乱', glyph: 'C+' },
  'C#': { label: 'csharp 井字酥', flavor: '方方正正，转个弯就断', glyph: 'C#' },
  Ruby: { label: 'ruby 红糖糍粑', flavor: '黏，但很甜', glyph: 'RB' },
  PHP: { label: 'php 奶酪片', flavor: '兼容性意外地好', glyph: 'PHP' },
  Swift: { label: 'swift 气泡饮', flavor: '轻，快，编译完就凉了', glyph: 'SW' },
  Kotlin: { label: 'kotlin 夹心饼', flavor: 'Java 的表亲，味道更清爽', glyph: 'KT' },
  Shell: { label: 'shell 硬壳小点', flavor: '一口一个，跑起来就没了', glyph: 'SH' },
  HTML: { label: 'html 松软底托', flavor: '一切的基础，但不单独吃', glyph: 'HT' },
  CSS: { label: 'css 彩色糖霜', flavor: '好看，且可以只吃一层', glyph: 'CS' },
  Vue: { label: 'vue 清爽黄瓜片', flavor: '清爽，适合配任何主菜', glyph: 'VU' },
  Dockerfile: { label: 'dockerfile 层叠饼', flavor: '一层套一层，拆不开', glyph: 'DK' },
};

/** star 数 → 加料等级 */
function starTier(stars: number): { label: string; flavor: string; glyph: string } {
  if (stars >= 1000) {
    return { label: 'star 爆浆酱', flavor: '社区认可度拉满的那种', glyph: '★★★' };
  }
  if (stars >= 100) {
    return { label: 'star 招牌酱', flavor: '有回头客', glyph: '★★' };
  }
  if (stars >= 10) {
    return { label: 'star 提味酱', flavor: '有人愿意点第二口', glyph: '★' };
  }
  return { label: 'star 初榨酱', flavor: '新店试营业', glyph: '☆' };
}

export interface GithubProfile {
  username: string;
  publicRepos: number;
  followers: number;
  languages: string[];
  totalStars: number;
  topRepo: string | null;
}

export type GithubResult =
  | { ok: true; profile: GithubProfile; toppings: VirtualTopping[] }
  | { ok: false; reason: 'not-found' | 'rate-limit' | 'network' | 'no-repos'; message: string };

/** GitHub 用户名合法性：只允许字母数字与连字符，1-39 位 */
export function isValidUsername(name: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(name);
}

/**
 * 拉取公开信息并转成配料。纯网络层，无 DOM 依赖，便于单测。
 * 传入 fetch 实现方便测试。
 */
export async function fetchGithubToppings(
  username: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GithubResult> {
  const name = username.trim();
  if (!isValidUsername(name)) {
    return { ok: false, reason: 'network', message: 'GitHub 用户名格式不对' };
  }

  const headers = { Accept: 'application/vnd.github+json' };

  let userRes: Response;
  try {
    userRes = await fetchImpl(`${API}/users/${encodeURIComponent(name)}`, { headers });
  } catch {
    return { ok: false, reason: 'network', message: '网络请求失败，检查一下连接' };
  }

  if (userRes.status === 404) {
    return { ok: false, reason: 'not-found', message: `GitHub 上没有叫 ${name} 的用户` };
  }
  if (userRes.status === 403 || userRes.status === 429) {
    return { ok: false, reason: 'rate-limit', message: 'GitHub 请求限流了，等一会儿再试' };
  }
  if (!userRes.ok) {
    return { ok: false, reason: 'network', message: `GitHub 返回 ${userRes.status}` };
  }

  const user = (await userRes.json()) as {
    login?: string;
    public_repos?: number;
    followers?: number;
  };

  // 仓库列表取前 30 个足够推断主语言，不需要全量分页
  let repos: Array<{ name?: string; stargazers_count?: number; language?: string | null }> = [];
  try {
    const repoRes = await fetchImpl(
      `${API}/users/${encodeURIComponent(name)}/repos?per_page=100&sort=pushed`,
      { headers },
    );
    if (repoRes.ok) {
      repos = (await repoRes.json()) as typeof repos;
    }
  } catch {
    // 仓库列表拿不到不影响主流程，退化成只看用户维度
    repos = [];
  }

  // 只统计公开仓库的 fork 以外部分，避免把上游仓库算成自己的成绩
  const ownRepos = repos.filter((r) => !String(r.name ?? '').endsWith('.git'));
  const totalStars = ownRepos.reduce((sum, r) => sum + (r.stargazers_count ?? 0), 0);

  const langCount = new Map<string, number>();
  for (const r of ownRepos) {
    const lang = r.language;
    if (lang) langCount.set(lang, (langCount.get(lang) ?? 0) + 1);
  }
  const languages = [...langCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([l]) => l);

  if (languages.length === 0 && totalStars === 0) {
    return {
      ok: false,
      reason: 'no-repos',
      message: `${name} 还没有公开仓库，换个账号试试`,
    };
  }

  const profile: GithubProfile = {
    username: user.login ?? name,
    publicRepos: user.public_repos ?? ownRepos.length,
    followers: user.followers ?? 0,
    languages,
    totalStars,
    topRepo:
      ownRepos.length > 0
        ? ownRepos.reduce((a, b) =>
            (b.stargazers_count ?? 0) > (a.stargazers_count ?? 0) ? b : a,
          ).name ?? null
        : null,
  };

  return { ok: true, profile, toppings: toppingsFromProfile(profile) };
}

/** 从公开资料推导配料。纯函数，便于单测。 */
export function toppingsFromProfile(profile: GithubProfile): VirtualTopping[] {
  const toppings: VirtualTopping[] = [];

  for (const lang of profile.languages) {
    const mapped = LANGUAGE_TOPPING[lang];
    if (mapped) {
      toppings.push({
        id: `lang-${lang.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: mapped.label,
        flavor: mapped.flavor,
        glyph: mapped.glyph,
        agentBoost: 6,
      });
    }
  }

  // 主力语言之外的兜底，保证任何语言组合都至少有一层配料
  if (toppings.length === 0) {
    for (const lang of profile.languages.slice(0, 2)) {
      toppings.push({
        id: `lang-${lang.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: `${lang} 风味层`,
        flavor: '没在配料表里，但你确实写了这个语言',
        glyph: lang.slice(0, 2).toUpperCase(),
        agentBoost: 5,
      });
    }
  }

  const tier = starTier(profile.totalStars);
  toppings.push({
    id: 'repo-vigor',
    label: tier.label,
    flavor: tier.flavor,
    glyph: tier.glyph,
    agentBoost: 8,
  });

  toppings.push({
    id: 'repo-breadth',
    label: `仓库派 ${profile.publicRepos} 片`,
    flavor: profile.publicRepos > 30 ? '囤了不少，够吃一阵' : '刚够摆一桌',
    glyph: `${profile.publicRepos}`,
    agentBoost: 5,
  });

  return toppings;
}