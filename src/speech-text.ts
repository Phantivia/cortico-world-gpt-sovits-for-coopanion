/**
 * 从 `pet_say` 写法的台词里取出要念的文字：去掉 `【动作】` 与 `<动作>` 标记、Markdown 强调符号。
 * 标记的认法与桌宠 World 的 `parseScript` 一致：尖括号里超过 INLINE_TAG_MAX 字或换行的不算标记，原样念。
 */

/** 与桌宠 World `script.ts` 的同名常量一致。 */
export const INLINE_TAG_MAX = 32;

export function speechText(script: string): string {
  let out = '';
  let i = 0;
  while (i < script.length) {
    const ch = script[i]!;
    if (ch === '【') {
      const end = script.indexOf('】', i + 1);
      if (end < 0) break;
      out += ' ';
      i = end + 1;
      continue;
    }
    if (ch === '<' || ch === '＜') {
      const end = script.indexOf(ch === '<' ? '>' : '＞', i + 1);
      const inner = end < 0 ? '' : script.slice(i + 1, end);
      if (end >= 0 && inner.length <= INLINE_TAG_MAX && !inner.includes('\n')) { i = end + 1; continue; }
    }
    out += ch;
    i++;
  }
  return out.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
}
