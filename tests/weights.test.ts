import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { infererYaml, yamlScalar } from '../src/server.ts';
import { readSovitsHeader, resolveTrained, sovitsVersion, SOVITS_HEADERS } from '../src/weights.ts';

const dir = mkdtempSync(join(tmpdir(), 'sovits-weights-'));

/** 造一个 `.pth`：前两字节是版本标记，后面随便填。 */
function pth(name: string, head: string): string {
  const file = join(dir, name);
  writeFileSync(file, Buffer.concat([Buffer.from(head, 'ascii'), Buffer.alloc(32, 7)]));
  return file;
}

function ckpt(name: string): string {
  const file = join(dir, name);
  writeFileSync(file, Buffer.alloc(16, 1));
  return file;
}

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('SoVITS 权重版本头', () => {
  it('读出两字节版本标记', () => {
    expect(readSovitsHeader(pth('a.pth', '08'))).toBe('08');
    expect(readSovitsHeader(pth('b.pth', '06'))).toBe('06');
  });

  it('zip 头等非数字开头返回 null，不当成 GPT-SoVITS 权重', () => {
    expect(readSovitsHeader(pth('c.pth', 'PK'))).toBeNull();
  });

  it('文件不存在时返回 null 而不是抛出', () => {
    expect(readSovitsHeader(join(dir, 'nope.pth'))).toBeNull();
  });

  it('只有 08 与 06 对应本扩展带的两套底座', () => {
    expect(sovitsVersion(pth('d.pth', '08'))).toMatchObject({ code: '08', version: 'v5turbo' });
    expect(sovitsVersion(pth('e.pth', '06'))).toMatchObject({ code: '06', version: 'v2ProPlus' });
    expect(sovitsVersion(pth('f.pth', '05'))).toMatchObject({ code: '05', lang: 'v2Pro', version: null });
    expect(sovitsVersion(pth('g.pth', '99'))).toMatchObject({ code: '99', version: null });
    expect(Object.keys(SOVITS_HEADERS)).toContain('07');
  });
});

describe('自备权重校验', () => {
  const gpt = ckpt('m-e12.ckpt');
  const v5 = pth('m_e8_l32.pth', '08');

  it('两个都空表示用内置权重，不算问题', () => {
    expect(resolveTrained({ gpt: '', sovits: '' }, 'v5turbo')).toEqual({ weights: null, problem: null });
    expect(resolveTrained(undefined, 'v5turbo')).toEqual({ weights: null, problem: null });
  });

  it('只填一半要报出来，不能悄悄只换一个', () => {
    expect(resolveTrained({ gpt, sovits: '' }, 'v5turbo').problem).toContain('只填了 GPT');
    expect(resolveTrained({ gpt: '', sovits: v5 }, 'v5turbo').problem).toContain('只填了 SoVITS');
  });

  it('扩展名不对要拦下', () => {
    expect(resolveTrained({ gpt: v5, sovits: v5 }, 'v5turbo').problem).toContain('.ckpt');
    expect(resolveTrained({ gpt, sovits: gpt }, 'v5turbo').problem).toContain('.pth');
  });

  it('路径不存在要给出来', () => {
    expect(resolveTrained({ gpt: join(dir, 'x.ckpt'), sovits: v5 }, 'v5turbo').problem).toContain('找不到');
  });

  it('版本和推理档不一致要拦下，而不是等底座缺失再崩', () => {
    const p = resolveTrained({ gpt, sovits: v5 }, 'v2ProPlus');
    expect(p.weights).toBeNull();
    expect(p.problem).toContain('v5turbo');
    expect(p.problem).toContain('v2ProPlus');
  });

  it('都对上就返回两条绝对路径', () => {
    expect(resolveTrained({ gpt, sovits: v5 }, 'v5turbo')).toEqual({ weights: { gpt, sovits: v5 }, problem: null });
  });
});

describe('api_v2 配置里的路径', () => {
  it('内置权重保持相对路径，不加引号', () => {
    const y = infererYaml('cuda', 'v5turbo');
    expect(y).toContain('t2s_weights_path: GPT_SoVITS/pretrained_models/s1v3.ckpt');
    expect(y).toContain('vits_weights_path: GPT_SoVITS/pretrained_models/gsv-v5-pretrained/s2Gv5turbo.pth');
  });

  it('自备权重写成带引号的绝对路径，反斜杠原样保留', () => {
    const y = infererYaml('cuda', 'v5turbo', { gpt: 'D:\\w\\大肥鱼-e12.ckpt', sovits: 'D:\\w\\大肥鱼_e8_l32.pth' });
    expect(y).toContain("t2s_weights_path: 'D:\\w\\大肥鱼-e12.ckpt'");
    expect(y).toContain("vits_weights_path: 'D:\\w\\大肥鱼_e8_l32.pth'");
    expect(y).toContain('version: v5turbo');
  });

  it('含空格或引号的标量才加引号', () => {
    expect(yamlScalar('plain/path.pth')).toBe('plain/path.pth');
    expect(yamlScalar('C:\\a b\\x.pth')).toBe("'C:\\a b\\x.pth'");
    expect(yamlScalar("it's.pth")).toBe("'it''s.pth'");
  });
});
