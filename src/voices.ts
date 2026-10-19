/**
 * 随包的预设音色：女声、男声各一，放在 `assets/voices/<id>.wav`,参考文字在同名 `.txt`。
 * 由 MOSS-VoiceGenerator 按描述生成，描述、种子与解码参数见 `assets/voices/prompts.json`。
 * 面板也用这张表，所以这里不引用 Node 模块;文件路径在 world.ts 里拼。
 */
import type { Language } from 'cortico/core/language.ts';

export const VOICE_PRESETS = ['female', 'male'] as const;
export type VoicePreset = (typeof VOICE_PRESETS)[number];
export const DEFAULT_PRESET: VoicePreset = 'female';

const LABEL = {
  zh: { female: '女声', male: '男声' },
  en: { female: 'Female', male: 'Male' },
};

export function presetLabel(id: VoicePreset, language: Language): string {
  return (language === 'zh' || language === 'zh-Hant' ? LABEL.zh : LABEL.en)[id];
}

export const isPreset = (v: string): v is VoicePreset => (VOICE_PRESETS as readonly string[]).includes(v);
