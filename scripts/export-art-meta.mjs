/**
 * 导出 Python 侧需要的美术元数据。
 *
 * 为什么要这一层：去底脚本要用每个角色的主色和深色搭档，
 * 但这两个值一部��存在 personas.ts（主色）、一部分存在 art-extra.mjs（深色搭档）。
 * 让 Python 直接解析 TypeScript 是不现实的，所以由 Node 导出一份 JSON 当桥梁。
 * 数据源仍是唯一的，只是多了一层可机器读的形式。
 *
 * 产物：docs/art/chatgpt-v1/meta.json
 */

import { writeFileSync } from 'node:fs';
import { PERSONAS } from '../src/persona/personas.ts';
import { ART_EXTRA } from './art-extra.mjs';

const meta = {};
for (const p of PERSONAS) {
  meta[p.id] = {
    name: p.name,
    color: p.visual.color,
    deep: ART_EXTRA[p.id]?.deep ?? p.visual.color,
    bunShape: p.visual.bunShape,
  };
}

writeFileSync('docs/art/chatgpt-v1/meta.json', JSON.stringify(meta, null, 2), 'utf8');
console.log('已导出 ' + Object.keys(meta).length + ' 个角色的元数据 → docs/art/chatgpt-v1/meta.json');
