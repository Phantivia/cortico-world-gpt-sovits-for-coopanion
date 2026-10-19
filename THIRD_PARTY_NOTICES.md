# Third-party notices

`assets/voices/` 的 2 段预设参考音频由 [OpenMOSS-Team/MOSS-VoiceGenerator](https://huggingface.co/OpenMOSS-Team/MOSS-VoiceGenerator)(Apache-2.0)按文字描述生成，不是任何真人的录音。

`vendor/audify/` 是 [audify](https://github.com/almoghamdani/audify) 1.10.1 官方发布的 napi-v10 win32-x64 预编译件(`audify.node`、`rtaudio.dll`、`opus.dll`),原样随包，用来放声。许可：audify MIT(`LICENSE`)、[RtAudio](https://github.com/thestk/rtaudio) MIT 式(`LICENSE.rtaudio`)、[Opus](https://opus-codec.org/) BSD-3-Clause(`COPYING.opus`)。

除此之外本包不含第三方代码与权重。托管安装时下载：

| 内容 | 来源 | 许可 |
|---|---|---|
| GPT-SoVITS 推理代码(运行时包内) | [RVC-Boss/GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) `e91506f` | MIT |
| 预训练权重(s1v3、s2Gv5turbo、vocoder、s2Gv2ProPlus、sv) | [lj1995/GPT-SoVITS](https://huggingface.co/lj1995/GPT-SoVITS)、[XXXXRT/GPT-SoVITS-Pretrained](https://www.modelscope.cn/models/XXXXRT/GPT-SoVITS-Pretrained) | MIT |
| chinese-roberta-wwm-ext-large | [hfl](https://huggingface.co/hfl/chinese-roberta-wwm-ext-large) | Apache-2.0 |
| chinese-hubert-base | [TencentGameMate](https://huggingface.co/TencentGameMate/chinese-hubert-base) | MIT |
| fast_langdetect lid.176.bin | [fastText](https://fasttext.cc/docs/en/language-identification.html) | CC BY-SA 3.0 |
| CPython 3.12(运行时包内) | [python-build-standalone](https://github.com/astral-sh/python-build-standalone) | PSF |
| PyTorch 等 Python 依赖(运行时包内) | PyPI / download.pytorch.org | 各自许可，见运行时包内各包的元数据 |
