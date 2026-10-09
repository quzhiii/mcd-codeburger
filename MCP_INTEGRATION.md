# MCP 集成说明

本文回答三件事：**接了什么、验过什么、为什么不那么用**。
可核验的原始留痕在 `docs/gate-a-raw/`，条款原文引用在 `docs/GATE_A_EVIDENCE.md`。

---

## 一、接的是什么

- 服务：金拱门（中国）有限公司提供的麦当劳 MCP 服务
- 端点：`https://mcp.mcd.cn`
- 传输：MCP Streamable HTTP
- 协议版本：`2025-06-18`
- 服务端：`mcd-mcp` v1.0.0
- 凭证：`Authorization: Bearer <TOKEN>`，与麦当劳会员账号强绑定
- 规则：《麦当劳MCP服务规则》，版本日期 **2025年12月3日**

配置文件见 `mcp-config.example.json`，只有环境变量占位符，不含任何真实凭证。

## 二、验过什么

2026-10-09 21:40（北京时间）用本人本机凭证做了一次单发探针，不是循环、不是批量、不是定时。

| 检查项 | 结果 | 关键观测 |
| --- | --- | --- |
| 服务规则取证 | PASS | HTTP 200，1794 字，版本日期 2025年12月3日，正文已落盘 |
| 无 Authorization | PASS | HTTP **403**，拒绝生效 |
| `initialize` | PASS | HTTP 200，server `mcd-mcp` v1.0.0，协议 `2025-06-18` |
| `tools/list` | PASS | HTTP 200，**35 个工具** |
| `list-nutrition-foods` | PASS | HTTP 200，**160 条**，9 字段，表头声明与实际一致，**零解析告警** |
| `now-time-info` | PASS | HTTP 200，返回 `envelope-json` 格式 |
| `campaign-calendar` | PASS | HTTP 200，15261 字节，返回 `markdown-text` 格式 |

### 35 个工具按用途归类

- **营养与餐品**：`list-nutrition-foods`、`query-meals`、`query-meal-detail`
- **门店与位置**：`query-nearby-stores`、`delivery-query-stores`、`delivery-query-addresses`、`delivery-create-address`
- **价格与下单**：`calculate-price`、`create-order`、`cancel-order`、`query-order`、`order-list`
- **优惠与券**：`query-my-coupons`、`query-store-coupons`、`available-coupons`、`auto-bind-coupons`、`query-survey-coupon`、`query-promotions`
- **会员与积分**：`query-my-account`、`mall-points-products`、`mall-product-detail`、`mall-create-order`、`mall-order-list`、`mall-order-detail`
- **活动**：`campaign-calendar`、`now-time-info`、`query-lottery-info`、`draw-lottery`、`query-my-prizes`
- **派对与团餐**：`query-party-city`、`query-party-store`、`query-party-store-date`、`query-party-store-session`、`party-order-create`、`query-meal-assistance`

### `list-nutrition-foods` 的返回结构

这是本项目用得最深的一个工具。返回是**两层信封**：

```
第一层：markdown 文本，"## Original Response" 之后是一段 JSON
第二层：JSON 的 data 字段是一个「紧凑表格」字符串

[160]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium}:
  猪柳麦满分,null,1288,308,16,16,24,781,213
  猪柳蛋麦满分,null,1618,387,23,21,25,846,243
  ...
```

- 表头声明 160 行，实际解析出 160 行，一致
- 字段 9 个，实测 `nutritionDescription` 一律为 `null`，产品侧按「可能为空」处理
- 解析层在 `src/mcd-adapter/parse.ts`，11 条单测，夹具是真机返回的原文

### 其他工具的入参约束

这些约束直接决定了哪些玩法在公开页面上做不了：

| 工具 | 必填 | 含义 |
| --- | --- | --- |
| `list-nutrition-foods` | **无** | 可以直接拿全量营养表 |
| `campaign-calendar` | **无** | 可直接拿当月活动 |
| `now-time-info` | **无** | 可直接拿服务端时间 |
| `query-nearby-stores` | `beType`、`searchType` | 要门店必须给定位或收藏店 |
| `query-meals` | `beType`、`orderType`、`storeCode` | 必须先有门店 |
| `query-meal-detail` | `storeCode`、`code`、`beType`、`orderType` | 必须先有门店和餐品编码 |
| `calculate-price` | `storeCode`、`beType`、`orderType`、`items` | 必须先有门店 |
| `query-my-account` / `query-my-coupons` | 无 | 但属于**账号个人数据**，绝不能出现在公开页面 |

## 三、为什么不那么用

### 被明确排除的做法

| 方案 | 为什么不行 | 依据条款 |
| --- | --- | --- |
| 公开 H5 让访客填自己的 Token、存 localStorage | 部署到公开网络即「托管至非官方认证的第三方平台」；且页面脚本代访客调用 = 自动化工具调用 | 第二条2、第六条2 |
| 公开 H5 用开发者的 Token 代所有访客调用 | 代他人调用 + 自动化批量调用 | 第三条2、第六条2 |
| 打包 160 条营养数据进公开仓库分发 | 只获得接口访问权，未获得底层数据权利 | 第一条3、第三条1 |
| 脚本 / 定时任务轮询 MCP 做数据同步 | 批量、高频、自动化 | 第三条2、第六条2 |
| 代下单、代领券、自动绑券 | 明确列举的禁止行为 | 第六条1 |
| 拿 MCP 数据做付费产品 | 仅限个人非商业目的 | 第一条2 |

### 采用的架构

```
公开页面（纯静态，谁都能玩）
  · 零 MCP 调用
  · 零官方数据集
  · L2 趣味人格映射 + L3 原创虚拟配料

WorkBuddy Skill（本地）
  · 使用者自己配置的 MCP 凭证
  · 由使用者本人在对话里触发
  ← 这一层才落在「个人正常使用场景」里
```

MCP 调用是**使用者本人触发的个人使用行为**，不是网页代所有访客调用。
这样既绕开了「自动化调用」这条禁止项，又保住了「真实 MCP 集成」这件事本身。

### 授权状态

| 事项 | 状态 | 处理 |
| --- | --- | --- |
| 官方是否允许公开发布营养数据快照 | **UNKNOWN** | 不发布。公开页面只用原创虚构数据 |
| 官方是否会给参赛作品额外数据授权 | **UNKNOWN** | 拿到书面授权前，一律按「无授权」处理 |
| 「自动化调用」边界里，本机单发脚本算不算违规 | 按保守处理 | 探针跑完即止，不作为运行路径 |

## 四、它在产品里扮演什么角色

不是噱头，也不是跑个脚本交差。

1. **人格 → 餐品类别的映射有真实依据。** L2 那层「你的堡属于奶香芝士类」不是拍脑袋，是从 160 条真实营养表的分类结构上来的。
2. **使用者自己的 Skill 里能看到真实数据。** 你在本地问「我这个人格对应的餐品热量大概多少」，走的是真机 `list-nutrition-foods`。
3. **解析层是可复用的工程产出。** 两层信封这个返回格式，官方没给 SDK，我们把它摸清了、写成纯函数、配了真机夹具的单测。任何人接麦当劳 MCP 都能直接抄。

## 五、自己复核

```bash
npm run gate:a    # 重跑探针，刷新 docs/gate-a-raw/ 下的全部证据
npm test          # 19 条，含解析层对真机返回的回归
```

`gate-a-summary.json` 里的 `generatedAt` 就是抓取时刻。重跑会刷新时间戳，旧结论不覆盖。

## 六、一条硬提醒

`scripts/gate-a-probe.mjs` 是**一次性合规核查工具**，不是产品运行时路径。
不得改造为批量、定时或并发的采集器。这是条款要求，不是建议。
