# GPTSovits 语音(cortico-world-gpt-sovits-for-coopanion)

Owner: `src/world.ts`

给 Coopanion 的桌宠配上声音：Coo 每次 `pet_say` 之前在同一次回复里先调用 `sovits_speak`,
扩展用本机的 [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) 流式合成这句话，从声卡播出。
`sovits_speak` 等第一块音频写进声卡才返回，主循环按顺序执行同一次回复里的工具调用，所以紧跟其后的
`pet_say` 在声音开始时出气泡。没调 `sovits_speak` 的 `pet_say` 不出声。

设置在 Coopanion 高级模式的「GPTSovits 语音」页。

## 两档

| 档 | 条件 | 模型 | 本机实测(RTX 5090 Laptop / Core Ultra 9 290HX) |
|---|---|---|---|
| 显卡 | NVIDIA 显卡 | V5 turbo | 首包 0.5–1.0 s,实时率 0.22–0.41,显存 3.5 GB |
| CPU | 其余 | v2ProPlus | 首包 0.8–1.1 s,实时率 0.8–1.1,内存 5.8 GB |

推理档默认自动：`nvidia-smi` 列得出显卡就用显卡档。V5 turbo 在这台机器的 CPU 上首包 3–4 s、实时率 1.2–1.5,
跟不上播放，所以 CPU 档用 v2ProPlus。v2ProPlus 的输出电平低(峰值约 −27 dBFS),播放时乘 8 倍并软限幅。

首次启动显卡档要编译 CUDA 内核，本机第一次 74 s,之后约 11 s。服务起来后用中、英、日各一句预热，预热完才算可用。

## 预设音色

随包带女声、男声两个预设音色，在配置「音色」里选择，默认女声。
面板上传了自定义参考音频时用自定义的，「改回预设音色」清掉它。

预设音色由 [MOSS-VoiceGenerator](https://huggingface.co/OpenMOSS-Team/MOSS-VoiceGenerator) 按文字描述生成，参考文字是一句带语气词的口语，
时长 3–10 秒，经 Whisper 核对与参考文字一致。描述、种子与解码参数在 `assets/voices/prompts.json`。

## 推理后端

按优先级取第一个：

1. **已有服务**:`worlds.gpt-sovits.serverUrl` 填一个 api_v2 地址，直接连它。
2. **自备目录**:`runtimeDir` 填一个含 `runtime/python.exe` 与 `api_v2.py` 的 GPT-SoVITS 目录(比如官方整合包),
   在里面起服务，权重用它自己的。
3. **托管安装**:面板上「安装并启动」下载本扩展打的运行时包(上游推理代码、独立 CPython 3.12 与依赖、G2PW、NLTK、
   Open JTalk 词典)和权重，装到部署根下的 `runtimes/gpt-sovits/<版本>/<档>/` 与 `models/gpt-sovits/pretrained_models/`,
   目录约定见 Cortico `docs/runtimes.md`。每个文件按顺序试多个来源，大小与 SHA-256 对上才算装好。

本机服务以 `runtime/python.exe -I -X utf8 -u api_v2.py` 在运行时根下启动，监听 127.0.0.1 的空闲端口。

## 自备训练权重

默认只用插件自己下载的底座权重(`s1v3.ckpt` + `s2Gv5turbo.pth` / `s2Gv2ProPlus.pth`)，自己用 GPT-SoVITS 训出来的模型没处放。
填了 `weights.gpt` 与 `weights.sovits` 就换成自己的:

| 键 | 文件 | 是什么 |
|---|---|---|
| `weights.gpt` | `.ckpt` | s1 / T2S，「文本 → 语义 token」那一半;训练产物形如 `我的模型-e12.ckpt` |
| `weights.sovits` | `.pth` | s2 / VITS，音色与声学那一半;LoRA 训练产物形如 `我的模型_e8_s672_l32.pth` |

几条约定:

- **两个要一起填**。只换 s1 不换 s2 出来的音色是不对的，插件会当成配置错误报出来，不静默生效。
- **版本要和推理档一致**：显卡档是 `v5turbo`，CPU 档是 `v2ProPlus`。插件读 `.pth` 头两个字节判版本，
  对不上就拦下来并说明原因，不让它到加载底座时才崩。
- **配对取同一轮**：`-e8.ckpt` 配 `_e8_*.pth`，跨 epoch 混搭音色容易飘。
- **生效方式**：本机后端写进 `tts_infer.<tier>.yaml`，随服务启动加载;服务已在跑时改成自备权重，
  会调 `/set_gpt_weights` 与 `/set_sovits_weights` 就地换，**不用重启**。
  清空回内置权重需要重启一次服务。
- **`serverUrl`(连已有服务)也能用**：那种后端插件不写 yaml，自备权重完全靠就地换这条路生效。

`.pth` 头字节对照(能在 `src/weights.ts` 里查到同一张表):

| 头 | 版本 | 本扩展可用 |
|---|---|---|
| `08` | v5turbo LoRA | ✅ 显卡档 |
| `06` | v2ProPlus | ✅ CPU 档 |
| `07` | v5 LoRA | ❌ 底座不同 |
| `05` | v2Pro | ❌ |
| `04` / `03` / `02` / `01` / `00` | v4 / v3 / v2 / v1 | ❌ |

## 工具与事件

- `sovits_speak(text)`:去掉 `【…】` 与 `<…>` 标记后合成，排在没念完的句子后面。
- `sovits_hush()`:停下当前一句并清空队列。
- 事件 `gpt-sovits.state`:语音变为可用或不可用(piggyback,随下一批事件送达)。环境提示词里的状态是前缀重建时的快照，以事件为准。

## 配置(`worlds.gpt-sovits`)

| 键 | 默认 | 说明 |
|---|---|---|
| `tier` | `auto` | `auto` / `cuda` / `cpu`,重启推理服务生效 |
| `voice.preset` | `female` | 预设音色:`female` / `male` |
| `voice.audio`、`voice.text` | 空 | 自定义参考音频(3–10 秒 WAV)与它的台本;配置里可选本机文件，语音页可上传，填了就不用预设音色 |
| `weights.gpt`、`weights.sovits` | 空 | 自备训练权重:自己训的 s1(`.ckpt`)与 s2(`.pth`)。两个都填才生效，留空用内置权重;版本要和推理档一致 |
| `speed` | 1 | 语速，对应 api_v2 的 `speed_factor` |
| `volume` | 1 | 0–1 |
| `outputDevice` | 空 | 输出设备名，空为系统默认 |
| `autoStart` | true | World 启动时启动本机推理服务 |
| `serverUrl`、`runtimeDir` | 空 | 见上 |
| `promptLanguage` | `zh` | 环境提示词语言 |

## 开发

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build        # src/webui → dist/webui.js、dist/webui.css
```

自描述 `describe.json` 用 Cortico 的 `pnpm describe:extension <本目录>` 生成。
