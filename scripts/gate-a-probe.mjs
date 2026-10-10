#!/usr/bin/env node
/**
 * Gate A 探针 —— MCP 合规取证与真实接入验证
 *
 * 设计约束（合规红线）：
 *  1. 只做「本人 + 本机 + 一次性的连通性与能力核查」，不做循环、不做批量、不做定时。
 *  2. 全程不打印、不落盘任何 Token；只打印掩码指纹。
 *  3. 原始响应原文落盘到 docs/gate-a-raw/，作为可核验证据。
 *  4. 不采集全量营养数据快照。营养工具仅取样本条数与字段名，用于确认能力存在。
 *
 * 用法：
 *   npm run gate:a
 * 或：
 *   MCD_MCP_TOKEN=xxx node scripts/gate-a-probe.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { parseNutritionResponse, extractEnvelope } from '../src/mcd-adapter/parse.ts';

const ENDPOINT = 'https://mcp.mcd.cn';
const RULES_URL = 'https://cdn.mcd.cn/cms/pages/MCPServerRules.html';
const RAW_DIR = path.resolve('docs', 'gate-a-raw');
const MAX_SAMPLE_ITEMS = 12; // 只保留极少样本用于证明字段结构，不构成数据集分发

const log = (...a) => process.stdout.write(a.join(' ') + '\n');

/**
 * 凭证指纹。
 *
 * 刻意**不用**「前 3 位 + 后 4 位」那种掩码 —— 本仓库是公开的，
 * 那种写法等于把真实凭证的片段发到公开网络上，违反《麦当劳MCP服务规则》第二条2。
 * 改成 SHA-256 前 12 位：既能证明「多次运行用的是同一个 Token」，又不可逆、不泄露任何字符。
 */
function maskToken(raw) {
  if (!raw) return '(none)';
  const core = String(raw).replace(/^Bearer\s+/i, '').trim();
  const h = createHash('sha256').update(core).digest('hex').slice(0, 12);
  return `sha256:${h}`;
}

async function resolveToken() {
  const fromEnv = process.env.MCD_MCP_TOKEN;
  if (fromEnv && fromEnv.trim()) {
    return { token: fromEnv.trim().replace(/^Bearer\s+/i, ''), from: 'env:MCD_MCP_TOKEN' };
  }

  const candidates = [
    path.join(os.homedir(), '.workbuddy', 'mcp.json'),
    path.join(process.cwd(), 'mcp.json'),
    path.join(process.cwd(), '.mcp.json'),
  ];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    let json;
    try {
      json = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      continue;
    }
    const servers = json.mcpServers || {};
    for (const [name, cfg] of Object.entries(servers)) {
      const headers = cfg?.headers || {};
      const authKey = Object.keys(headers).find((k) => k.toLowerCase() === 'authorization');
      const raw = authKey ? headers[authKey] : cfg?.token;
      if (raw && String(raw).trim()) {
        return { token: String(raw).trim().replace(/^Bearer\s+/i, ''), from: `${file}#${name}` };
      }
    }
  }

  return { token: null, from: null };
}

/** 从 SSE 或纯 JSON 响应体中抽出 JSON-RPC 负载 */
function parseBody(text) {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fallthrough */
    }
  }
  // SSE：逐行找 data:
  const payloads = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const m = /^data:\s*(.*)$/.exec(line);
    if (m && m[1] && m[1] !== '[DONE]') payloads.push(m[1]);
  }
  if (!payloads.length) return null;
  const last = payloads[payloads.length - 1];
  try {
    return JSON.parse(last);
  } catch {
    return null;
  }
}

class McpClient {
  constructor(token) {
    this.token = token;
    this.sessionId = null;
    this.nextId = 1;
    this.trace = [];
  }

  async request(method, params, { notify = false, withAuth = true } = {}) {
    const id = notify ? undefined : this.nextId++;
    const body = notify
      ? { jsonrpc: '2.0', method, params }
      : { jsonrpc: '2.0', id, method, params };

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
      'User-Agent': 'codeburger-gate-a/0.1.0 (local, single-shot)',
    };
    if (withAuth && this.token) headers.Authorization = 'Bearer ' + this.token;
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId;

    const startedAt = new Date().toISOString();
    let res;
    const record = { method, id, startedAt, withAuth };
    try {
      res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (err) {
      record.error = String(err && err.message ? err.message : err);
      this.trace.push(record);
      return { ok: false, record, error: record.error };
    }

    const text = await res.text();
    const sid = res.headers.get('mcp-session-id');
    if (sid) this.sessionId = sid;

    record.status = res.status;
    record.contentType = res.headers.get('content-type') || '';
    record.sessionId = sid || null;
    record.rateLimit = res.headers.get('ratelimit') || res.headers.get('x-ratelimit-limit') || null;
    record.bodyBytes = Buffer.byteLength(text, 'utf8');
    record.rawBody = text.length > 60000 ? text.slice(0, 60000) + '\n...[truncated]' : text;
    const parsed = parseBody(text);
    record.parsed = parsed;
    this.trace.push(record);

    return { ok: res.ok, status: res.status, parsed, raw: text, record, error: null };
  }

  async initialize() {
    const r = await this.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      clientInfo: { name: 'codeburger-gate-a', version: '0.1.0' },
    });
    await this.request('notifications/initialized', {}, { notify: true });
    return r;
  }
}

async function snapshotRules() {
  const out = { url: RULES_URL, fetchedAt: new Date().toISOString(), status: null, clauses: [], notes: [] };
  let res;
  try {
    res = await fetch(RULES_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; gate-a/0.1.0)' } });
  } catch (err) {
    out.notes.push('抓取失败：' + String(err && err.message ? err.message : err));
    return out;
  }
  out.status = res.status;
  const html = await res.text();
  await writeFile(path.join(RAW_DIR, 'mcp-server-rules.html'), html, 'utf8');

  // 规则正文被内嵌在 window.page.configInfo[].datasource.html 里
  const m = /"datasource"\s*:\s*\{\s*"html"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(html);
  if (!m) {
    out.notes.push('未在页面中找到内嵌的 datasource.html，可能页面结构已变更。原始 HTML 已落盘。');
    return out;
  }
  let innerHtml = '';
  try {
    innerHtml = JSON.parse('"' + m[1] + '"');
  } catch {
    out.notes.push('内嵌 HTML 反转义失败。');
    return out;
  }
  await writeFile(path.join(RAW_DIR, 'mcp-server-rules.embedded.html'), innerHtml, 'utf8');

  const text = innerHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();

  await writeFile(path.join(RAW_DIR, 'mcp-server-rules.txt'), text, 'utf8');
  out.charCount = text.length;

  const versionMatch = /(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(text);
  out.versionDateFound = versionMatch ? versionMatch[0] : null;
  out.text = text;
  return out;
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  const summary = {
    generatedAt: new Date().toISOString(),
    endpoint: ENDPOINT,
    runtime: process.version,
    rules: null,
    tokenSource: null,
    tokenMask: null,
    checks: [],
  };

  // ---- 1. 服务规则取证 ----
  log('');
  log('=== 1. MCP 服务规则取证 ===');
  const rules = await snapshotRules();
  summary.rules = {
    url: rules.url,
    status: rules.status,
    fetchedAt: rules.fetchedAt,
    charCount: rules.charCount || 0,
    versionDateFound: rules.versionDateFound || null,
    notes: rules.notes,
  };
  log(`  HTTP ${rules.status} · ${rules.charCount || 0} 字 · 版本日期 ${rules.versionDateFound || '未识别'}`);
  for (const n of rules.notes) log('  ! ' + n);

  // ---- 2. 凭证 ----
  const { token, from } = await resolveToken();
  summary.tokenSource = from;
  summary.tokenMask = maskToken(token);

  log('');
  log('=== 2. 凭证 ===');
  if (!token) {
    summary.checks.push({ name: 'resolve-token', result: 'BLOCKED', detail: '未找到 Token（env:MCD_MCP_TOKEN 或 ~/.workbuddy/mcp.json）' });
    log('  BLOCKED：未找到 Token。请先运行 tools/set-mcd-token.ps1。');
    await writeFile(path.join(RAW_DIR, 'gate-a-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
    return;
  }
  log(`  来源 ${from}`);
  log(`  指纹 ${summary.tokenMask}`);

  const client = new McpClient(token);

  // ---- 3. 负向用例：无授权必须 401 ----
  log('');
  log('=== 3. 负向用例：无 Authorization ===');
  const noAuth = await client.request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'codeburger-gate-a', version: '0.1.0' },
  }, { withAuth: false });
  summary.checks.push({
    name: 'unauthorized-initialize',
    result: noAuth.status === 401 || noAuth.status === 403 ? 'PASS' : `REVIEW(status=${noAuth.status})`,
    httpStatus: noAuth.status,
  });
  log(`  HTTP ${noAuth.status} → ${summary.checks[summary.checks.length - 1].result}`);

  // ---- 4. 正向：initialize ----
  log('');
  log('=== 4. initialize ===');
  const init = await client.initialize();
  const serverInfo = init.parsed?.result?.serverInfo || null;
  summary.checks.push({
    name: 'initialize',
    result: init.ok && !!init.parsed?.result ? 'PASS' : 'FAIL',
    httpStatus: init.status,
    serverInfo,
    protocolVersion: init.parsed?.result?.protocolVersion || null,
    capabilities: init.parsed?.result?.capabilities || null,
  });
  log(`  HTTP ${init.status} · server=${serverInfo?.name || '?'} v${serverInfo?.version || '?'} · 协议 ${init.parsed?.result?.protocolVersion || '?'}`);

  if (!init.ok) {
    log('  initialize 未通过，后续工具调用跳过。');
    await writeFile(path.join(RAW_DIR, 'gate-a-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
    await writeFile(path.join(RAW_DIR, 'gate-a-trace.json'), JSON.stringify(client.trace, null, 2), 'utf8');
    return;
  }

  // ---- 5. tools/list ----
  log('');
  log('=== 5. tools/list ===');
  const toolsRes = await client.request('tools/list', {});
  const tools = toolsRes.parsed?.result?.tools || [];
  summary.checks.push({
    name: 'tools/list',
    result: tools.length > 0 ? 'PASS' : 'FAIL',
    httpStatus: toolsRes.status,
    toolCount: tools.length,
    toolNames: tools.map((t) => t.name),
  });
  log(`  HTTP ${toolsRes.status} · 工具数 ${tools.length}`);
  for (const t of tools) log(`    - ${t.name}`);
  await writeFile(path.join(RAW_DIR, 'tools-list.json'), JSON.stringify(toolsRes.parsed, null, 2), 'utf8');

  const hasTool = (n) => tools.some((t) => t.name === n);

  async function callTool(name, args) {
    const r = await client.request('tools/call', { name, arguments: args });
    const content = r.parsed?.result?.content || [];
    const textPart = content.map((c) => c.text).filter(Boolean).join('\n');
    let payload = null;
    if (textPart) {
      payload = extractEnvelope(textPart);
    }
    return { r, content, textPart, payload };
  }

  // ---- 6. list-nutrition-foods（只取样本，不分发数据集）----
  log('');
  log('=== 6. list-nutrition-foods（样本）===');
  if (!hasTool('list-nutrition-foods')) {
    summary.checks.push({ name: 'list-nutrition-foods', result: 'UNKNOWN', detail: '工具未在 tools/list 中出现' });
    log('  UNKNOWN：工具未出现。');
  } else {
    const r = await callTool('list-nutrition-foods', {});
    const parsed = parseNutritionResponse(r.textPart);
    const rows = parsed.rows;
    const first = rows[0] || null;
    const sample = rows.slice(0, MAX_SAMPLE_ITEMS);
    summary.checks.push({
      name: 'list-nutrition-foods',
      result: rows.length > 0 ? 'PASS' : 'REVIEW',
      httpStatus: r.r.status,
      envelopeSuccess: parsed.envelope?.success ?? null,
      envelopeCode: parsed.envelope?.code ?? null,
      envelopeMessage: parsed.envelope?.message ?? null,
      itemCount: rows.length,
      declaredCount: parsed.table?.declaredCount ?? null,
      fieldNames: parsed.table?.fieldNames ?? null,
      parseWarnings: parsed.warnings,
      note: '仅保留前 ' + MAX_SAMPLE_ITEMS + ' 条用于验证字段结构，不构成数据集分发',
    });
    log(`  HTTP ${r.r.status} · success=${parsed.envelope?.success} code=${parsed.envelope?.code} · 解析条数 ${rows.length}（表头声明 ${parsed.table?.declaredCount ?? '?'}）`);
    log(`  字段 ${parsed.table?.fieldNames.join(', ') || '?'}`);
    if (first) log(`  首条 ${first.productName} · ${first.energyKcal} kcal · 蛋白 ${first.protein}g · 脂肪 ${first.fat}g · 碳水 ${first.carbohydrate}g · 钠 ${first.sodium}mg`);
    for (const w of parsed.warnings.slice(0, 5)) log('  ! ' + w);
    if (sample.length) {
      await writeFile(path.join(RAW_DIR, 'nutrition-sample.json'), JSON.stringify(sample, null, 2), 'utf8');
      log(`  已落盘前 ${sample.length} 条样本 → docs/gate-a-raw/nutrition-sample.json`);
    }
  }

  // ---- 7. now-time-info ----
  log('');
  log('=== 7. now-time-info ===');
  if (!hasTool('now-time-info')) {
    summary.checks.push({ name: 'now-time-info', result: 'UNKNOWN', detail: '工具未出现' });
    log('  UNKNOWN：工具未出现。');
  } else {
    const r = await callTool('now-time-info', {});
    const ok = r.r.ok && r.textPart.length > 0;
    summary.checks.push({
      name: 'now-time-info',
      result: ok ? 'PASS' : 'FAIL',
      httpStatus: r.r.status,
      responseFormat: r.payload ? 'envelope-json' : 'markdown-text',
      envelopeCode: r.payload?.code ?? null,
      textBytes: Buffer.byteLength(r.textPart, 'utf8'),
      preview: r.textPart.slice(0, 300),
    });
    log(`  HTTP ${r.r.status} · 格式 ${r.payload ? 'envelope-json' : 'markdown-text'} · ${Buffer.byteLength(r.textPart, 'utf8')} 字节`);
    log(`  ${r.textPart.slice(0, 140).replace(/\s+/g, ' ')}`);
  }

  // ---- 8. campaign-calendar ----
  log('');
  log('=== 8. campaign-calendar ===');
  if (!hasTool('campaign-calendar')) {
    summary.checks.push({ name: 'campaign-calendar', result: 'UNKNOWN', detail: '工具未出现' });
    log('  UNKNOWN：工具未出现。');
  } else {
    const r = await callTool('campaign-calendar', {});
    const ok = r.r.ok && r.textPart.length > 0;
    summary.checks.push({
      name: 'campaign-calendar',
      result: ok ? 'PASS' : 'FAIL',
      httpStatus: r.r.status,
      responseFormat: r.payload ? 'envelope-json' : 'markdown-text',
      envelopeCode: r.payload?.code ?? null,
      textBytes: Buffer.byteLength(r.textPart, 'utf8'),
      preview: r.textPart.slice(0, 600),
    });
    log(`  HTTP ${r.r.status} · 格式 ${r.payload ? 'envelope-json' : 'markdown-text'} · ${Buffer.byteLength(r.textPart, 'utf8')} 字节`);
    log(`  ${r.textPart.slice(0, 200).replace(/\s+/g, ' ')}`);
  }

  // ---- 落盘 ----
  const redactedTrace = client.trace.map((t) => {
    const clone = { ...t };
    if (clone.rawBody) clone.rawBody = clone.rawBody.replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, '$1<REDACTED>');
    return clone;
  });
  await writeFile(path.join(RAW_DIR, 'gate-a-trace.json'), JSON.stringify(redactedTrace, null, 2), 'utf8');
  await writeFile(path.join(RAW_DIR, 'gate-a-summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  // ---- 汇总 ----
  log('');
  log('=== 汇总 ===');
  for (const c of summary.checks) {
    log(`  [${c.result}] ${c.name}${c.httpStatus ? ' (HTTP ' + c.httpStatus + ')' : ''}${c.toolCount !== undefined ? ' tools=' + c.toolCount : ''}${c.itemCount !== undefined ? ' items=' + c.itemCount : ''}`);
  }
  log('');
  log('证据目录：docs/gate-a-raw/');
  log('');
}

main().catch((err) => {
  process.stderr.write('探针异常：' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
