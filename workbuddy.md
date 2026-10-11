# WorkBuddy 上下文文件

> 本文件描述 CodeBurger 是如何在 WorkBuddy 里被构建出来的，供复现与评估参考。

---

## 一、协作模式

不是「一句话生成一个项目」，是一条**验证优先**的流水线：每一层的结论都必须先落到磁盘上、能被复核，才允许往下走。

```
外部规则取证 → 工程骨架 → 人格引擎 → 视觉设计稿 → 美术资产评审 → 页面实现
     ↑              ↑           ↑            ↑              ↑
  Gate A 证据    构建通过    单测全绿      用户确认        客观测试
```

具体的门：

| Gate | 验什么 | 证据落在哪 |
| --- | --- | --- |
| A | MCP 条款原文 + 真机连通性 | 条款原文抓取脚本 + 验证记录（本地留存，不公开） |
| 构建 | `tsc --noEmit` + 纯静态 `dist/` | `npm run build` |
| 人格 | 1024 种答题组合全覆盖 | `tests/persona.test.mjs` |
| 解析 | 真机返回原文的回归 | `tests/fixtures/nutrition-response.json` |
| 契约 | 虚拟层不得携带真实营养数据 | `tests/burger-spec.test.mjs` |
| 投喂 | 无配料也能走通主流程 | `tests/feed.test.mjs` |
| 加料 | GitHub 失败必须降级 | `tests/github.test.mjs` |

Git 历史、内部评审材料与 MCP 原始取证留痕**不在公开仓库内**，保存在本地工作目录。
公开仓库只保留产品交付物与可复现的验证手段（测试与 CI）。

## 二、WorkBuddy 具体承担了什么

### 1. 合规取证（人工做会非常费时）

《麦当劳MCP服务规则》那页是 JS 渲染的，正文内嵌在 `window.page.configInfo[].datasource.html` 里。
WorkBuddy 直接从页面源码里抽出内嵌 JSON 取出正文，把 1794 字的原文和抓取时间一起落盘 ——
这保证了引用的是**页面真正渲染的那段字**，不是第三方转述。

然后逐字比对条款和几种可能的架构，把「个人 Token 嵌公开页」「访客自带 Token」「公开分发数据集」
这几个看起来很自然的方案**全部判为 BLOCKED**，架构被迫改成现在的双通路隔离。

这一步如果靠人读条款，很容易漏掉「第六条2 把自动化工具调用列为禁止行为」这一条，
从而做出一个上线即违规的设计。

### 2. 真机验证 + 解析层

- 单发探针跑通 `initialize` / `tools/list` / 三个只读工具，记录无授权路径返回 403
- 摸清 `list-nutrition-foods` 的**两层信封**返回格式（markdown 外壳 + 紧凑表格字符串）
- 把解析写成纯函数，用真机返回的原文做夹具，11 条单测

### 3. 内容生成的「机制一致性」而不是「人工盯一致性」

角色设定表不是手写的，是脚本从 `src/persona/personas.ts` 生成的。角色美术需求表同理。

原因：只要有第二个人、或者同一人隔几天再改，手写多份必然漂移。用单一事实来源 + 生成脚本，
「四张统一」「表里写的和代码一致」是机制保证的，不靠自觉。

### 4. 美术资产的客观评审

8 张角色图回来之后，没有直接说好或不好，做了三件可量化的事：

- **色彩连续性**：统计 512px 下不透明像素里的不同颜色数（48.8%–75.7%），用数据说明这是连续色阶的厚涂渲染，不是扁平插画
- **小尺寸压力测试**：1:1 逐档压到 64 / 48 / 36 / 24px，找出「剪影区分度不足」这个真问题
- **本地补救**：给每只垫主色底盘，底盘亮度统一压到同一视觉重量，实测 36px 下能分开

以及明确否掉了「自动描摹成 SVG」这个看起来很合理的请求，并给出为什么不合理的理由。

### 5. 资产管线

去白底用**从四边做连通域漫水填充**，只删和边框连通的白色 —— 面包高光被角色包围，不会被误伤。
裁到内容外接框、补正方形、留 4% 边距，导出 512² 去底 PNG 作为网页正式资产。
处理脚本留在本地，最终产物（8 张 512² PNG，约 2.5MB）入库到 `public/assets/personas/`。

### 6. 契约先行：Burger Spec

本地 Skill 与网页要交换汉堡数据，一开始就定了唯一契约（`src/spec/burger-spec.ts`），
并把「虚拟层不得携带真实营养数据」写成校验函数 + 单测 + CI 检查。
这样合规红线就不是靠自觉，而是靠一条会失败的测试。

## 三、Windows 受限沙箱下的三个坑（都记在文档里了）

| 坑 | 现象 | 处理 |
| --- | --- | --- |
| esbuild postinstall | `npm install` 报 EBUSY，构建报找不到 esbuild | 改用命令行参数 `npm install --ignore-scripts`，平台二进制由 `@esbuild/win32-x64` 直接提供；**不写进仓库 `.npmrc`**，避免影响所有克隆者 |
| 管道中断长跑脚本 | `node x.mjs \| head` 触发 EPIPE，进程被杀，证据文件写成 0 字节 | 一律 `> logfile 2>&1` 再读 |
| node spawn 子进程被拒 | `spawnSync` 同样 EBUSY | 脚本里打印出可直接复制的命令行，改由 shell 直调 |
| git 写入异常 | `git commit` 挂死；`git checkout -b` 后索引全变成 `A` | 改用 `git write-tree` + `git commit-tree` + 手写 ref 文件 |
| SSH 到 GitHub 不通 | github.com 解析到代理地址，22 端口 banner 阶段超时 | 改用 HTTPS，凭证助手是 `helper-selector -> gh`，无需交互输入 |
| 连接器无建仓权限 | `POST /user/repos` 返回 `403 Resource not accessible by integration` | 建仓手动做一次，之后推送可自动化 |

Windows 环境的三处坑与绕行办法，写在 `.npmrc` 的注释里，照着做即可。

## 四、人为把关的地方

以下几点是**人拍板，不是模型自动生成**的：

1. 删掉「由人格得分推导目标热量」的算法 —— 这是评审后主动砍掉的
2. 要求「虚拟配料不得承载官方营养数值」，三层结构严格分开
3. 视觉 Gate：先交设计稿，确认后才做完整前端
4. 报名 Issue 不在第一天提，等源码、文档、真实 MCP 集成都满足官方要求
5. 美术方向最终选了「接受 3D 角色、把页面风格往上靠」，而不是重生成

## 五、复现

```bash
git clone https://github.com/quzhiii/mcd-codeburger.git
cd mcd-codeburger
npm install
npm run build
npm test
npm run skill:demo
```

MCP 相关的部分需要你自己的 Token，见 `mcp-config.example.json`。
