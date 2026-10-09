import './ui/styles/base.css';

/**
 * CodeBurger 入口。
 *
 * 合规红线（务必保持）：
 * 1. 本应用是纯静态前端，公众访客路径下不发起任何 MCP 调用。
 * 2. 不内置、不转发、不收集任何 MCP Token 或个人凭证。
 * 3. 所有「官方真实餐品」信息必须带来源与抓取日期标注，且不得描述为实时。
 * 4. Agent 投喂奖励全部是虚拟游戏机制，不得宣称增加任何真实 AI 额度。
 */
const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <main class="boot">
      <p class="boot__brand">CodeBurger</p>
      <h1 class="boot__title">麦门人格汉堡工厂</h1>
      <p class="boot__slogan">Feed Your Agent.</p>
      <p class="boot__note">工程骨架已就绪，四屏体验正在接入。</p>
    </main>
  `;
}

export {};
