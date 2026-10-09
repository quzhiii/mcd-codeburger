/**
 * 麦当劳 MCP 返回值里用到的数据类型。
 *
 * 说明：这里的字段名全部来自 `list-nutrition-foods` 的真机返回，
 * 证据见 docs/gate-a-raw/nutrition-sample.json 与 docs/GATE_A_EVIDENCE.md。
 */

/** MCP 工具返回的两种信封 */
export interface McdEnvelope {
  success: boolean;
  code: number;
  message: string;
  datetime?: string;
  traceId?: string;
  data: unknown;
}

/** 官方营养表的一行（真实数据，非虚拟角色属性） */
export interface NutritionRow {
  /** 餐品名称，如「巨无霸」 */
  productName: string;
  /** 营养说明，实测多为 null */
  nutritionDescription: string | null;
  /** 能量，千焦 */
  energyKj: number;
  /** 能量，千卡 */
  energyKcal: number;
  /** 蛋白质，克 */
  protein: number;
  /** 脂肪，克 */
  fat: number;
  /** 碳水化合物，克 */
  carbohydrate: number;
  /** 钠，毫克 */
  sodium: number;
  /** 钙，毫克 */
  calcium: number;
}

/** 紧凑表格的解析结果 */
export interface CompactTable {
  /** 表头声明的行数 `[160]` */
  declaredCount: number | null;
  fieldNames: string[];
  rows: string[][];
  /** 解析时被跳过或修正的行，用于自称自查 */
  warnings: string[];
}
