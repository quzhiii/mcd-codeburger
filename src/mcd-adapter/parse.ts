/**
 * 麦当劳 MCP 返回值解析层。
 *
 * 真机返回长这样（`list-nutrition-foods` 实测；样本存于 tests/fixtures/nutrition-response.json，
 * 完整取证记录保存在本地工作目录，不随仓库分发）：
 *
 * ```
 * # API Response Information
 * ... 字段说明 ...
 * ## Original Response
 *
 * {"success":true,"code":200,"message":"请求成功","datetime":"...","traceId":"...",
 *  "data":"[160]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,
 *          carbohydrate,sodium,calcium}:\n  猪柳麦满分,null,1288,308,16,16,24,781,213\n  ..."}
 * ```
 *
 * 也就是两层信封：
 *  1. 外层是 markdown 文本，真正的 JSON 在 `## Original Response` 之后；
 *  2. 内层 `data` 是一个「紧凑表格」字符串，`[行数]{字段名}:` 开头，随后每行一条以逗号分隔。
 *
 * 这个解析层是纯函数、无副作用、不联网。它同时被真机探针（scripts/gate-a-probe.mjs）
 * 和前端演示模式复用，保证两边看到的数据结构完全一致。
 */

import type { CompactTable, McdEnvelope, NutritionRow } from './types.ts';

/** `[160]{a,b,c}:` —— 表头 */
const HEADER_RE = /\[(\d+)\]\s*\{([^}]*)\}\s*:/;

/**
 * 剥掉 markdown 外壳，取出 JSON。
 * 兼容三种情况：裸 JSON / `## Original Response` 之后 / 整段里最后一个 `{...}`。
 */
export function extractEnvelope(text: string): McdEnvelope | null {
  if (!text) return null;
  const trimmed = text.trim();

  const direct = tryJson(trimmed);
  if (direct) return direct;

  const marker = '## Original Response';
  const idx = trimmed.indexOf(marker);
  if (idx >= 0) {
    const after = trimmed.slice(idx + marker.length).trim();
    const parsed = tryJson(after);
    if (parsed) return parsed;
    // 兜底：从 marker 之后截取第一个平衡的 JSON 对象
    const sliced = sliceFirstJsonObject(after);
    const parsed2 = sliced ? tryJson(sliced) : null;
    if (parsed2) return parsed2;
  }

  const sliced = sliceFirstJsonObject(trimmed);
  const parsed3 = sliced ? tryJson(sliced) : null;
  return parsed3;
}

function tryJson(s: string): McdEnvelope | null {
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object') return v as McdEnvelope;
    return null;
  } catch {
    return null;
  }
}

/** 从字符串里截出第一个花括号平衡的 JSON 片段（跳过字符串内的括号） */
function sliceFirstJsonObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * 解析紧凑表格字符串。
 *
 * 分隔符是逗号，`null` 一律转成 null。餐品名理论上可能自带逗号，
 * 因此当某行切出来的字段数多于表头时，把多出来的部分并回**第一个**字段
 * （实测 160 条里没有出现，但保留这个修正以免以后加菜品就崩）。
 */
export function parseCompactTable(input: string): CompactTable {
  const out: CompactTable = { declaredCount: null, fieldNames: [], rows: [], warnings: [] };
  if (typeof input !== 'string' || !input.trim()) {
    out.warnings.push('输入为空');
    return out;
  }

  const header = HEADER_RE.exec(input);
  if (!header) {
    out.warnings.push('未找到表头 [n]{field,...}:');
    return out;
  }
  out.declaredCount = Number(header[1]);
  out.fieldNames = header[2]
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  const body = input.slice(header.index + header[0].length);
  const fieldCount = out.fieldNames.length;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let parts = line.split(',').map((p) => p.trim());
    if (parts.length > fieldCount) {
      const extra = parts.length - fieldCount;
      const merged = parts.slice(0, extra + 1).join(',');
      parts = [merged, ...parts.slice(extra + 1)];
      out.warnings.push(`字段数超出表头，已并回首个字段：${line.slice(0, 40)}`);
    }
    if (parts.length !== fieldCount) {
      out.warnings.push(`字段数 ${parts.length} 与表头 ${fieldCount} 不符，已跳过：${line.slice(0, 40)}`);
      continue;
    }
    out.rows.push(parts);
  }

  if (out.declaredCount !== null && out.declaredCount !== out.rows.length) {
    out.warnings.push(`表头声明 ${out.declaredCount} 行，实际解析出 ${out.rows.length} 行`);
  }
  return out;
}

function toNum(v: string | undefined): number {
  if (v === undefined) return 0;
  if (v === '' || v === 'null' || v === 'NULL' || v === '-') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toStr(v: string | undefined): string | null {
  if (v === undefined) return null;
  const t = v.trim();
  if (!t || t === 'null' || t === 'NULL' || t === '-') return null;
  return t;
}

/** 把紧凑表格转成结构化营养行。字段名以表头为准，未知字段名会被忽略。 */
export function toNutritionRows(table: CompactTable): NutritionRow[] {
  const col = (name: string) => table.fieldNames.indexOf(name);
  const iName = col('productName');
  if (iName < 0) return [];
  const iDesc = col('nutritionDescription');
  const iKj = col('energyKj');
  const iKcal = col('energyKcal');
  const iProtein = col('protein');
  const iFat = col('fat');
  const iCarb = col('carbohydrate');
  const iSodium = col('sodium');
  const iCalcium = col('calcium');

  return table.rows
    .map((row) => {
      const name = toStr(row[iName]);
      if (!name) return null;
      const item: NutritionRow = {
        productName: name,
        nutritionDescription: iDesc >= 0 ? toStr(row[iDesc]) : null,
        energyKj: iKj >= 0 ? toNum(row[iKj]) : 0,
        energyKcal: iKcal >= 0 ? toNum(row[iKcal]) : 0,
        protein: iProtein >= 0 ? toNum(row[iProtein]) : 0,
        fat: iFat >= 0 ? toNum(row[iFat]) : 0,
        carbohydrate: iCarb >= 0 ? toNum(row[iCarb]) : 0,
        sodium: iSodium >= 0 ? toNum(row[iSodium]) : 0,
        calcium: iCalcium >= 0 ? toNum(row[iCalcium]) : 0,
      };
      return item;
    })
    .filter((x): x is NutritionRow => x !== null);
}

/** 一步到位：MCP 工具返回的 markdown 文本 → 营养行数组 */
export function parseNutritionResponse(text: string): {
  rows: NutritionRow[];
  table: CompactTable | null;
  envelope: McdEnvelope | null;
  warnings: string[];
} {
  const envelope = extractEnvelope(text);
  if (!envelope) return { rows: [], table: null, envelope: null, warnings: ['未能解析出 JSON 信封'] };
  if (typeof envelope.data !== 'string') {
    return {
      rows: [],
      table: null,
      envelope,
      warnings: [`data 字段不是字符串，而是 ${typeof envelope.data}`],
    };
  }
  const table = parseCompactTable(envelope.data);
  const rows = toNutritionRows(table);
  return { rows, table, envelope, warnings: table.warnings };
}
