---
name: codeburger-feed
description: 用你自己的已授权麦当劳 MCP 连接查询真实营养数据，生成一份 CodeBurger Burger Spec JSON。当用户想把自己的汉堡人格配上真实餐品数据、或想了解某个汉堡人格「对应」的真实餐品营养参考时使用。只调用只读工具，不下单、不改账户、不使用优惠券。
---

# codeburger-feed

把 CodeBurger 的**虚拟人格**与麦当劳官方**真实营养数据**放在同一份 JSON 里返回。

## 合规边界（先读这一段）

《麦当劳MCP服务规则》（版本日期 2025年12月3日）里与本Skill 直接相关的条款：

- **第一条 1** 明确写道，本服务「旨在让您通过**自行使用的第三方 AI 工具**访问与处理……**由您授权触发的**相关操作」。
  这是本 Skill 存在的正当性依据：用户在 WorkBuddy 里由本人触发，属于条款预设的个人使用场景。
- **第三条 2**：仅面向个人正常使用场景，不支持批量、高频或自动化调用。
- **第六条 2**：不得利用脚本、爬虫或任何自动化工具调用本服务。
- **第二条 2**：严禁将凭证发布在公开网络或托管至非官方认证的第三方平台。

因此本 Skill 的设计原则是：**把调用次数压到最低、只读、不落凭证、不代替用户决策**。
下面是逐条的红线。

这个 Skill 只做两件事：

1. 读官方营养表（`list-nutrition-foods`）
2. 组装并输出 Burger Spec JSON

**明确不做**：

- 不调用 `create-order`、`cancel-order`、`auto-bind-coupons`、`delivery-create-address` 等任何写操作
- 不调用 `query-my-account`、`query-my-coupons`、`query-my-prizes`、`mall-order-list` 等涉及个人账户的工具
- 不循环、不批量、不重试轰炸。一次对话最多调一次 `list-nutrition-foods`，结果本地缓存复用
- 不把 Token 写进任何文件
- 不把真实营养数据说成是「这个人格的性格属性」

**分层诚实**：真实餐品的营养数值是**那款餐品的属性**，不是**这只虚拟汉堡人格的属性**。
输出时必须保留 `source: "reference"` 标记与`fetchedAt` 日期，并在给用户的说明里写清这一点。

## 前置条件

需要用户自己在 WorkBuddy 里配置好麦当劳 MCP 连接。**Skill 不索取 Token，也不代用户配置。**
若工具列表里找不到 `list-nutrition-foods`，直接告诉用户去配置 MCP，不要尝试绕过。

## 执行步骤

### 1. 确认人格

如果用户没说自己是哪只汉堡，先让用户去网页测一次，或从对话里问清人格名。
人格名到 id 的映射见下方对照表。

### 2. 拉取营养数据

调用 `list-nutrition-foods`，用 `src/mcd-adapter/parse.ts` 的解析逻辑取出结构化行。
返回是两层信封：markdown 外壳 +紧凑表格字符串。

### 3. 选一款真实餐品作为参考

按人格的`visual.filling` 关键词做语义匹配（比如「双层辣鸡腿」优先匹配双层辣鸡腿类）。
**说明这是趣味匹配，不是营养建议。**

### 4. 组装并输出 Burger Spec

严格按下面的 JSON 结构输出，不要增删字段。

## Burger Spec JSON 契约

```json
{
  "version": "1.0",
  "personaId": "chili-social",
  "name": "社牛辣椒堡",
  "keyword": "外向、热情、能量拉满",
  "tagline": "我认识的人比你刷的视频还多。",
  "color": "#e23b26",
  "bunShape": "classic-dome",
  "toppings": [
    { "id": "lang-typescript", "label": "typescript 脆片", "flavor": "入口带一点甜，越嚼越上头", "glyph": "TS", "agentBoost": 6 }
  ],
  "agentEffect": "inspiration",
  "source": "reference",
  "nutrition": {
    "productName": "真实餐品名",
    "energyKcal": 387,
    "protein": 23,
    "fat": 21,
    "carbohydrate": 25,
    "sodium": 846,
    "calcium": 243,
    "sourceUrl": "https://mcp.mcd.cn",
    "fetchedAt": "2026-10-10"
  },
  "recipeVersion": "mcp-1"
}
```

校验规则（`src/spec/burger-spec.ts` 的 `validateBurgerSpec`）：

| 规则 | 说明 |
| --- | --- |
| `version` | 必须等于 `"1.0"` |
| `source: "virtual"` | **不得**包含 `nutrition` 字段 |
| `source: "reference"` | **必须**包含 `nutrition`，且 `productName` / `sourceUrl` / `fetchedAt` 都不能为空 |
| `nutrition` 数值 | 六个营养字段必须是数字，不能是字符串 |
| `toppings[]` | 每项必须有 `id` / `label` / `flavor` / `glyph` |

## 人格对照表

| id | 名称 | 匹配倾向 |
| --- | --- | --- |
| `chili-social` | 社牛辣椒堡 | 辣味、双层肉、高热量 |
| `night-slack` | 深夜摸鱼堡 | 单一肉饼、料少 |
| `cheese-spark` | 灵感芝士堡 | 芝士类、早餐麦满分 |
| `calm-double` | 淡定双层堡 | 双层牛肉 |
| `plan-drumstick` | 计划鸡腿堡 | 鸡腿排、定量蔬菜 |
| `risky-cod` | 冒险鳕鱼堡 | 鱼类、海鲜 |
| `shaky-hashbrown` | 手抖薯饼堡 | 含薯饼的组合、麦满分 |
| `zen-veggie` | 佛系蔬菜堡 | 玉米杯、蔬菜、低热量 |

## 把结果展示到网页

**不要上传任何文件到服务器。**

如果用户想把Skill 生成的 JSON 放到 CodeBurger 网页上，唯一合规的方式是：

1. Skill 把 JSON 写到用户本地磁盘（例如 `~/codeburger-specs/<personaId>.json`）
2. 在网页上由**用户自己**选择这个本地文件
3. 只在浏览器本机解析，不发送任何网络请求

不要写「因为是用户自己触发的所以都算授权」这种推定。
《麦当劳MCP服务规则》第三条 2 与第六条 2对自动化与批量调用有明确限制，
最终是否允许某种用法应由用户自行判断，Skill 只负责把边界说清楚。

## 输出给用户时必须包含

1. 这份 JSON 的完整内容
2. 匹配到哪款真实餐品、依据是什么
3. **明确声明**：真实营养数据是该餐品的属性，不代表这只虚拟人格；数据抓取于 `fetchedAt`，非实时
4. 说明本次只调用了只读工具，未做任何账户或下单操作