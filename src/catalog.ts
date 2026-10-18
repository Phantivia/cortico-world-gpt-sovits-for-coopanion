/**
 * 钉住的运行时包与权重：每个文件写明字节数、SHA-256 与按顺序尝试的来源。
 *
 * 运行时包是本仓 `scripts/build-runtime.sh` 打出来的 zip:上游 GPT-SoVITS 在 UPSTREAM_COMMIT 的推理代码、
 * `runtime/` 里的独立 CPython 3.12 与依赖(显卡档带 CUDA 版 torch 与 FlashAttention)、G2PW 与 NLTK、
 * Open JTalk 词典;不含 `GPT_SoVITS/pretrained_models/`,那里在启动前接到权重目录。
 */
import type { Tier } from './config.ts';

export const UPSTREAM_REPO = 'RVC-Boss/GPT-SoVITS';
export const UPSTREAM_COMMIT = 'e91506f1fba265e1841617c3042a1573206a7351';

/** 运行时版本：上游 commit 短号加本仓的打包序号。 */
export const RUNTIME_VERSION = 'e91506f-1';

export interface PinnedFile {
  /** 落盘的相对路径。 */
  path: string;
  bytes: number;
  sha256: string;
  /** 下载地址，按顺序尝试。 */
  sources: readonly string[];
}

/** 一档运行时：一个 zip,可分片(GitHub Release 单个附件不能超过 2 GiB),按顺序拼回后校验整体。 */
export interface RuntimeAsset {
  file: string;
  bytes: number;
  sha256: string;
  /** 整包的下载地址，按顺序尝试。 */
  sources: readonly string[];
  /** 分片的下载地址;整包地址都失败后才用。 */
  parts?: ReadonlyArray<{ bytes: number; sources: readonly string[] }>;
}

const MS_OWN = 'https://www.modelscope.cn/models/Phantivia/gpt-sovits-for-coopanion/resolve/master';

/** bytes 为 0 的档还没有发布包，只能用自备目录或已有服务。 */
export const RUNTIME_ASSETS: Readonly<Record<Tier, RuntimeAsset>> = {
  cuda: { file: `gpt-sovits-${RUNTIME_VERSION}-win-x64-cu128.zip`, bytes: 0, sha256: '', sources: [] },
  cpu: { file: `gpt-sovits-${RUNTIME_VERSION}-win-x64-cpu.zip`, bytes: 0, sha256: '', sources: [] },
};

/** 每档用的模型版本，即 api_v2 配置里的 `version`。 */
export const TIER_MODEL: Readonly<Record<Tier, ModelVersion>> = {
  cuda: 'v5turbo',
  cpu: 'v2ProPlus',
};

export type ModelVersion = 'v5turbo' | 'v2ProPlus';

/**
 * 播放时乘的增益。v2ProPlus 经 api_v2 出来的峰值约 −27 dBFS(CPU 与显卡一样),V5 接近满幅。
 */
export const OUTPUT_GAIN: Readonly<Record<ModelVersion, number>> = {
  v5turbo: 1,
  v2ProPlus: 8,
};

const MS_UP = 'https://www.modelscope.cn/models/XXXXRT/GPT-SoVITS-Pretrained/resolve/master/pretrained_models';
const HF_UP = 'https://huggingface.co/lj1995/GPT-SoVITS/resolve/main';

/** 上游两个仓库里同一路径的文件。 */
const upstream = (path: string, bytes: number, sha256: string): PinnedFile => ({
  path, bytes, sha256, sources: [`${MS_UP}/${path}`, `${HF_UP}/${path}`],
});

/** 两个版本共用的文本与参考音频特征模型。 */
const SHARED: readonly PinnedFile[] = [
  upstream('s1v3.ckpt', 155284856, ''),
  upstream('chinese-hubert-base/config.json', 1449, ''),
  upstream('chinese-hubert-base/preprocessor_config.json', 212, ''),
  upstream('chinese-hubert-base/pytorch_model.bin', 188811417, ''),
  upstream('chinese-roberta-wwm-ext-large/config.json', 963, ''),
  upstream('chinese-roberta-wwm-ext-large/pytorch_model.bin', 0, ''),
  upstream('chinese-roberta-wwm-ext-large/tokenizer.json', 0, ''),
  upstream('fast_langdetect/lid.176.bin', 0, ''),
];

/** 上游魔搭仓库还没有 V5 权重：先试本扩展的魔搭仓库，再试上游 Hugging Face。 */
const v5 = (path: string, bytes: number, sha256: string): PinnedFile => ({
  path, bytes, sha256, sources: [`${MS_OWN}/pretrained_models/${path}`, `${HF_UP}/${path}`],
});

export const MODEL_FILES: Readonly<Record<ModelVersion, readonly PinnedFile[]>> = {
  v5turbo: [...SHARED, v5('gsv-v5-pretrained/s2Gv5turbo.pth', 766406144, ''), v5('gsv-v5-pretrained/vocoder.pth', 0, '')],
  v2ProPlus: [...SHARED, upstream('v2Pro/s2Gv2ProPlus.pth', 200125741, ''), upstream('sv/pretrained_eres2netv2w24s4ep4.ckpt', 0, '')],
};

/** api_v2 配置里的权重路径(相对运行时根)。 */
export function weightPaths(version: ModelVersion): { t2s: string; vits: string } {
  return {
    t2s: 'GPT_SoVITS/pretrained_models/s1v3.ckpt',
    vits: version === 'v5turbo' ? 'GPT_SoVITS/pretrained_models/gsv-v5-pretrained/s2Gv5turbo.pth' : 'GPT_SoVITS/pretrained_models/v2Pro/s2Gv2ProPlus.pth',
  };
}
