/**
 * 自备训练权重的识别与校验。
 *
 * GPT-SoVITS 的两个权重分工不同：GPT(`.ckpt`, s1/T2S) 学「文本 → 语义 token」，SoVITS(`.pth`, s2)
 * 学音色与声学细节。自己训出来的通常是 s1 某个 epoch 的 `.ckpt` 加 s2 的 LoRA `.pth`。
 *
 * `.pth` 头两个字节是版本标记(LoRA 文件形如 `08`)，据此能判断它配不配当前推理档——本扩展的运行时
 * 只带 v5turbo(显卡档)与 v2ProPlus(CPU 档)两套底座，版本对不上时底座缺失，加载必然失败，
 * 因此在写进配置之前就拦下来，给出可读的原因。
 */
import { closeSync, existsSync, openSync, readSync } from 'node:fs';
import { extname } from 'node:path';
import type { ModelVersion } from './catalog.ts';

export interface TrainedWeights {
  /** GPT(T2S)权重，`.ckpt`。 */
  gpt: string;
  /** SoVITS(s2)权重，`.pth`。 */
  sovits: string;
}

/** `.pth` 头两字节 -> 版本。`version` 为 null 表示本扩展的运行时里没有这套底座。 */
export const SOVITS_HEADERS: Readonly<Record<string, { lang: string; version: ModelVersion | null }>> = {
  '00': { lang: 'v1', version: null },
  '01': { lang: 'v2', version: null },
  '02': { lang: 'v3', version: null },
  '03': { lang: 'v3 LoRA', version: null },
  '04': { lang: 'v4 LoRA', version: null },
  '05': { lang: 'v2Pro', version: null },
  '06': { lang: 'v2ProPlus', version: 'v2ProPlus' },
  '07': { lang: 'v5 LoRA', version: null },
  '08': { lang: 'v5turbo LoRA', version: 'v5turbo' },
};

/** 读 `.pth` 头两字节；不是 torch 存档(头不是 ASCII 数字)时返回 null。 */
export function readSovitsHeader(file: string): string | null {
  let fd: number | null = null;
  try {
    fd = openSync(file, 'r');
    const buf = Buffer.alloc(2);
    if (readSync(fd, buf, 0, 2, 0) < 2) return null;
    const code = buf.toString('ascii');
    return /^[0-9]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

/** SoVITS 权重的版本；读不出来返回 null。 */
export function sovitsVersion(file: string): { code: string; lang: string; version: ModelVersion | null } | null {
  const code = readSovitsHeader(file);
  if (!code) return null;
  const hit = SOVITS_HEADERS[code];
  return hit ? { code, ...hit } : { code, lang: `未知(${code})`, version: null };
}

export interface TrainedResult {
  /** 可用的权重；用不上时为 null。 */
  weights: TrainedWeights | null;
  /** 填了但用不上的原因，直给用户看。 */
  problem: string | null;
}

/**
 * 校验配置里的自备权重。两个都留空才算「用内置权重」；只填一个是常见的手误，直接当问题报出来，
 * 而不是悄悄只换一半——只换 s1 不换 s2 出来的音色是不对的。
 */
export function resolveTrained(setting: Partial<TrainedWeights> | undefined, expected: ModelVersion): TrainedResult {
  const gpt = (setting?.gpt ?? '').trim();
  const sovits = (setting?.sovits ?? '').trim();
  if (!gpt && !sovits) return { weights: null, problem: null };
  if (!gpt) return { weights: null, problem: '自备权重只填了 SoVITS(.pth)，GPT(.ckpt)还空着；两个要一起填。' };
  if (!sovits) return { weights: null, problem: '自备权重只填了 GPT(.ckpt)，SoVITS(.pth)还空着；两个要一起填。' };
  if (extname(gpt).toLowerCase() !== '.ckpt') return { weights: null, problem: `GPT 权重要是 .ckpt，现在是 ${extname(gpt) || '没有扩展名'}。` };
  if (extname(sovits).toLowerCase() !== '.pth') return { weights: null, problem: `SoVITS 权重要是 .pth，现在是 ${extname(sovits) || '没有扩展名'}。` };
  if (!existsSync(gpt)) return { weights: null, problem: `找不到 GPT 权重：${gpt}` };
  if (!existsSync(sovits)) return { weights: null, problem: `找不到 SoVITS 权重：${sovits}` };

  const v = sovitsVersion(sovits);
  if (!v) return { weights: null, problem: `读不出 SoVITS 权重的版本头，可能不是 GPT-SoVITS 的 .pth：${sovits}` };
  if (!v.version) return { weights: null, problem: `这套运行时没有 ${v.lang} 的底座，只支持 v5turbo(08) 与 v2ProPlus(06)。` };
  if (v.version !== expected) {
    return { weights: null, problem: `权重是 ${v.lang}，当前推理档用的是 ${expected}；换推理档或换成对应版本的权重。` };
  }
  return { weights: { gpt, sovits }, problem: null };
}
