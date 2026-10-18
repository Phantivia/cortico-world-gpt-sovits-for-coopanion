/**
 * 随包的预设音色：Coopanion 四个开局人设(默认 Coo、铸、心、冬)各一男一女，放在 `assets/voices/<id>.wav`,
 * 参考文字在同名 `.txt`。由 MOSS-VoiceGenerator 按描述生成，要求快、平、不带语气和感情，生成描述见 `assets/voices/prompts.json`。
 * 面板也用这张表，所以这里不引用 Node 模块;文件路径在 world.ts 里拼。
 */
import type { Language } from 'cortico/core/language.ts';

export const VOICE_PRESETS = ['coo-f', 'coo-m', 'forge-f', 'forge-m', 'heart-f', 'heart-m', 'winter-f', 'winter-m'] as const;
export type VoicePreset = (typeof VOICE_PRESETS)[number];
export const DEFAULT_PRESET: VoicePreset = 'coo-f';

const PERSONA = {
  zh: { coo: '默认 Coo', forge: '铸', heart: '心', winter: '冬', f: '女声', m: '男声' },
  en: { coo: 'Default Coo', forge: 'Forge', heart: 'Heart', winter: 'Winter', f: 'female', m: 'male' },
};

export function presetLabel(id: VoicePreset, language: Language): string {
  const t = language === 'zh' || language === 'zh-Hant' ? PERSONA.zh : PERSONA.en;
  const [persona, gender] = id.split('-') as [keyof typeof t, 'f' | 'm'];
  return `${t[persona]} · ${t[gender]}`;
}

export const isPreset = (v: string): v is VoicePreset => (VOICE_PRESETS as readonly string[]).includes(v);
