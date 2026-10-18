/**
 * 「语音」面板：推理档、运行时、权重、推理服务四行状态与操作，音色(参考音频与文字)，试听。
 * 数据经 `ctx.invoke` 走 World 的 `invoke('voice', …)`,每秒轮询一次状态。
 */
import type { WebUiClientBundle, WebUiPanel, WebUiPanelContext } from 'cortico/web/shared/client-panel.ts';
import { panelText } from '../i18n.ts';
import type { PanelState } from '../world.ts';
import './style.css';

const MB = (n: number) => Math.round(n / 1048576);
const pct = (done: number, total: number) => (total ? `${Math.round((done / total) * 100)}%` : `${MB(done)} MB`);
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

const voicePanel: WebUiPanel = {
  mount(ctx: WebUiPanelContext) {
    const { ui } = ctx;
    const t = panelText(ctx.language);
    const msg = ui.msgline();
    let state: PanelState | null = null;

    const call = async (method: string, args: unknown[] = []) => {
      msg.textContent = '';
      try {
        const next = await ctx.invoke<PanelState | { text: string; failed?: true }>(method, args);
        if (next && 'backend' in next) render(next);
        else if (next && 'text' in next) { msg.textContent = next.text; msg.classList.toggle('bad', !!next.failed); }
      } catch (err) {
        msg.textContent = errText(err);
        msg.classList.add('bad');
      }
    };

    // ---- 状态四行
    const status = ui.section(t.panel, t.panelHint);
    const row = (name: string) => {
      const el = ui.h('div', 'gsv-row');
      const label = ui.h('span', 'gsv-name', name);
      const pill = ui.h('span', 'gsv-pill');
      const detail = ui.h('span', 'gsv-detail');
      const acts = ui.h('span', 'gsv-acts');
      el.append(label, pill, detail, acts);
      status.append(el);
      return { pill, detail, acts };
    };
    const tierRow = row(t.tier), runtimeRow = row(t.runtime), weightsRow = row(t.weights), serverRow = row(t.server);
    const installBtn = ui.button(t.install, { variant: 'primary', size: 'sm', onClick: () => void call('install') });
    const cancelBtn = ui.button(t.cancel, { size: 'sm', onClick: () => void call('cancel') });
    runtimeRow.acts.append(installBtn, cancelBtn);
    const startBtn = ui.button(t.start, { size: 'sm', onClick: () => void call('start') });
    const restartBtn = ui.button(t.restart, { size: 'sm', onClick: () => void call('restart') });
    const stopBtn = ui.button(t.stop, { size: 'sm', onClick: () => void call('stop') });
    serverRow.acts.append(startBtn, restartBtn, stopBtn);
    const output = ui.h('pre', 'gsv-output');
    status.append(output);

    // ---- 音色
    const voice = ui.section(t.voice, t.voiceHint);
    const current = ui.h('div', 'gsv-voice-current');
    const file = ui.input({});
    file.type = 'file';
    file.accept = '.wav,audio/wav';
    const text = ui.textarea({});
    text.rows = 2;
    const save = ui.button(t.saveVoice, { size: 'sm', onClick: () => void saveVoice() });
    const reset = ui.button(t.defaultVoice, { size: 'sm', onClick: () => void call('resetVoice') });
    const voiceActs = ui.actions();
    voiceActs.append(save, reset);
    voice.append(current, ui.field(t.pickVoice, file), ui.field(t.voiceText, text), voiceActs);

    async function saveVoice() {
      const f = file.files?.[0];
      if (!f) { msg.textContent = t.pickVoice; return; }
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      await call('setVoice', [f.name, btoa(bin), text.value]);
    }

    // ---- 试听
    const test = ui.section(t.test);
    const line = ui.input({});
    line.value = t.testText;
    const testActs = ui.actions();
    testActs.append(
      ui.button(t.test, { variant: 'primary', size: 'sm', onClick: () => void call('test', [line.value]) }),
      ui.button(t.hush, { size: 'sm', onClick: () => void call('hush') }),
    );
    const queue = ui.h('span', 'gsv-detail');
    test.append(line, testActs, queue);

    ctx.root.append(status, voice, test, msg);

    const setPill = (el: HTMLElement, label: string, tone: 'on' | 'off' | 'warn' | 'bad') => {
      el.textContent = label;
      el.dataset.tone = tone;
    };

    function render(s: PanelState) {
      state = s;
      // 推理档
      setPill(tierRow.pill, s.tier === 'cuda' ? t.tierCuda : t.tierCpu, 'on');
      tierRow.detail.textContent = s.tierSetting === 'auto' ? t.tierAuto(s.cudaFound) : '';
      // 运行时与权重
      const managed = s.backend === 'managed';
      runtimeRow.acts.hidden = !managed;
      if (s.backend === 'remote') { setPill(runtimeRow.pill, t.remote, 'on'); runtimeRow.detail.textContent = s.runtime.dir; }
      else if (s.backend === 'own') { setPill(runtimeRow.pill, s.runtime.own ? t.ownRuntime : t.error, s.runtime.own ? 'on' : 'bad'); runtimeRow.detail.textContent = s.runtime.dir; }
      else jobRow(runtimeRow, s.runtime, s.runtime.published ? null : t.unpublished);
      weightsRow.pill.parentElement!.hidden = !managed;
      if (managed) jobRow(weightsRow, s.weights, null);
      const toDownload = (s.runtime.phase === 'ready' ? 0 : s.runtime.bytes) + (s.weights.phase === 'ready' ? 0 : s.weights.bytes);
      installBtn.textContent = toDownload ? t.installSize(MB(toDownload)) : t.install;
      const busy = s.runtime.phase === 'working' || s.weights.phase === 'working';
      installBtn.disabled = busy || !s.runtime.published || (s.runtime.phase === 'ready' && s.weights.phase === 'ready' && s.server.phase !== 'stopped' && s.server.phase !== 'error');
      cancelBtn.hidden = !busy;
      // 推理服务
      serverRow.pill.parentElement!.hidden = s.backend === 'remote';
      const sv = s.server;
      if (sv.phase === 'ready' && sv.warmed) setPill(serverRow.pill, t.running, 'on');
      else if (sv.phase === 'starting' || sv.warming) setPill(serverRow.pill, sv.warming ? t.warming : t.starting, 'warn');
      else if (sv.phase === 'error') setPill(serverRow.pill, t.error, 'bad');
      else setPill(serverRow.pill, t.stopped, 'off');
      serverRow.detail.textContent = sv.phase === 'ready' && sv.startMs ? t.startMs(Math.round(sv.startMs / 1000)) : sv.detail ?? '';
      startBtn.hidden = sv.phase !== 'stopped' && sv.phase !== 'error';
      restartBtn.hidden = stopBtn.hidden = sv.phase === 'stopped';
      output.textContent = sv.phase === 'error' || sv.phase === 'starting' ? s.output.join('\n') : '';
      output.hidden = !output.textContent;
      // 音色与队列
      current.textContent = s.voice ? `${s.voice.isDefault ? `${t.defaultVoice}:` : ''}${s.voice.audio}${s.voice.text ? ` · ${s.voice.text}` : ''}` : t.noVoice;
      if (document.activeElement !== text && s.voice && !text.value) text.value = s.voice.isDefault ? '' : s.voice.text;
      queue.textContent = [s.queue ? t.queue(s.queue) : '', s.lastError ? `${t.lastError}:${s.lastError}` : ''].filter(Boolean).join(' · ');
    }

    function jobRow(r: ReturnType<typeof row>, job: PanelState['runtime'] | PanelState['weights'], note: string | null) {
      if (job.phase === 'ready') setPill(r.pill, t.ready, 'on');
      else if (job.phase === 'working') setPill(r.pill, `${t.working} ${pct(job.done, job.total)}`, 'warn');
      else if (job.phase === 'error') setPill(r.pill, t.error, 'bad');
      else setPill(r.pill, t.absent, 'off');
      r.detail.textContent = job.phase === 'error' ? job.detail ?? '' : job.phase === 'working' ? job.detail ?? '' : note ?? job.dir;
    }

    const refresh = async () => {
      try { render(await ctx.invoke<PanelState>('state')); } catch (err) { if (!state) msg.textContent = errText(err); }
    };
    void refresh();
    ctx.interval(() => void refresh(), 1000);
  },
};

const bundle: WebUiClientBundle = { panels: { voice: voicePanel } };
export default bundle;
