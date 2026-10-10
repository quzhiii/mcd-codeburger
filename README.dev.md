# 开发者文档

## 架构一句话

**一个 Vite 应用，两条互相隔离的数据通路。**

```
                      ┌──────────────────────────┐
                      │  公开页面（纯静态）        │
                      │  · 零 MCP 调用            │
                      │  · 零官方数据集            │
                      │  · L2 趣味映射 + L3 原创  │
                      └──────────────────────────┘
                                   ▲
                   导出一个汉堡规格 JSON │ 手动
                                   │
                      ┌──────────────────────────┐
                      │  WorkBuddy Skill（本地）  │
                      │  · 使用者自己的 MCP 凭证  │
                      │  · 真实 list-nutrition-…  │
                      └──────────────────────────┘
```

隔离不是偏好问题，是条款问题。条款要点与判定见本文与 `MCP_INTEGRATION.md`；完整取证记录保存在本地工作目录，不随公开仓库分发。

## 为什么是单应用而不是 monorepo

就四屏，全是前端。服务端没有、也不该有 —— 一旦有服务端，就变成了「非官方认证的第三方平台」托管调用，
直接踩《麦当劳MCP服务规则》第二条2。

## 模块

| 目录 | 职责 | 可复用性 |
| --- | --- | --- |
| `src/persona/` | 题库、8 个角色、确定性映射 | 纯函数，可单独抽成库 |
| `src/mcd-adapter/` | MCP 返回值的两层信封解析 | **任何接麦当劳 MCP 的项目都能直接抄** |
| `src/renderer/` | 角色 SVG 画法 | 目前在设计稿阶段 |
| `scripts/` | 探针、设计稿生成、资产处理 | — |

### `src/mcd-adapter/` 是本项目最有复用价值的部分

麦当劳 MCP 的返回值有两层信封：

```
第一层：markdown 文本，"## Original Response" 之后是一段 JSON
第二层：JSON 的 data 字段是一个「紧凑表格」字符串
        [160]{productName,nutritionDescription,energyKj,...}:
          猪柳麦满分,null,1288,308,16,16,24,781,213
          ...
```

`parse.ts` 把它拆成三个纯函数：

- `extractEnvelope(text)` —— 剥 markdown 外壳
- `parseCompactTable(str)` —— 解析紧凑表格，字段数超表头时会把多出来的并回首个字段
- `parseNutritionResponse(text)` —— 一步到位

有 11 条单元测试，夹具用的是真机返回的原文（`tests/fixtures/nutrition-response.json`）。

## 人格引擎

**禁止随机。**

```
5 题 × 4 选项 → 五维向量（每维 ∈ {−1, 0, +1}）
              → 与 8 个原型向量算加权欧氏距离
              → 取最近；并列时按 personaId 字典序
```

单测枚举了全部 4⁵ = 1024 种答题组合，断言：

- 每一种都有归属
- 只落在 8 个人格内
- 不存在「永远不会被抽到」的死人格
- 同一份答案重复求值结果完全一致

想加人格，改 `src/persona/personas.ts` 一处，测试会立刻告诉你有没有破坏覆盖性和唯一性。

## 数据模式三级开关（构建期）

| 模式 | 用在哪 | 内容 |
| --- | --- | --- |
| `none` | 公开页面 | 零官方数据，只有 L2 + L3 |
| `reference` | 公开页面（**未授权，默认关闭**） | ≤12 条真实餐品作参考，逐条标来源与抓取日期 |
| `live` | 本地 Skill | 真实 MCP 调用，使用者本人凭证 |

## 安装

```bash
npm install
```

**Windows 受限沙箱下会失败**，报 `Cannot find package 'esbuild'`。
原因是 esbuild 的 postinstall 要 spawn 子进程被拒（`EBUSY`）。
解决方式是用命令行参数 `npm install --ignore-scripts`，**不要写进仓库的 `.npmrc`** —— 那会影响所有克隆者的安装行为。

## 常用命令

```bash
npm run dev         # 开发服务器，5180
npm run build       # tsc --noEmit && vite build，产出纯静态 dist/
npm test            # 49 条
npm run gate:a      # 重跑 MCP 合规取证（需自己的 Token）
npm run skill:demo  # Burger Spec 本地自检（不联网、不用 Token）
npm run art:meta    # 导出角色主色给 Python 处理脚本
npm run art:prep    # 去白底 + 裁切 + 多档导出 + 生成带底盘小图
```

## 角色资产管线

```
ChatGPT 生图（1254² 白底）
   → public/assets/personas/（最终产物）
   → npm run art:prep
        · 从四边漫水填充去白底（不会伤到面包高光）
        · 裁到内容外接框 → 补正方形 → 留 4% 边距
        · 导出 512² PNG/WebP + 256² PNG + 256² 带主色底盘
```

带底盘的小图是给列表用的：这 8 只的剪影差异不大，36px 以下要靠主色底盘分开。
底盘亮度统一压到同一视觉重量，浅色角色按亮度往深色搭档方向拉。

## 合规红线（改代码前先看）

1. 公开页面零 MCP 调用，绝不内置或转发任何 Token
2. 不公开分发完整官方数据集
3. 演示 / 参考数据必须标来源与抓取日期，不得描述为实时
4. 投喂奖励全是虚拟游戏机制，不得宣称增加真实 AI 额度
5. 不强制登录、不强制 Star、不做 Star 换奖励
6. 不使用未经许可的麦当劳商标 / 角色 / 商业素材
7. 人格测评标注为趣味内容，不宣称科学效度
8. `.gitignore` 排除 `mcp.json`、`*.local.json`、任何含 Token 的文件
9. 删除了由人格得分推导目标热量的算法，不要再往回加
10. 不把真实餐品的营养数值解释为虚拟配料的属性

## 还没做的

- 组装动画（要分层资产）
- GitHub 加料（P0，未实现）
- 分享卡 Canvas 导出（未实现）
- 真实餐品参考层（等授权）
