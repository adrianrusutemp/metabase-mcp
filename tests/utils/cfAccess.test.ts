import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveCfAccess } from '../../src/config.js';

describe('resolveCfAccess', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cf-access-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when nothing is configured', () => {
    expect(resolveCfAccess({})).toBeNull();
  });

  it('uses the environment values', () => {
    expect(
      resolveCfAccess({ CF_ACCESS_CLIENT_ID: 'id.access', CF_ACCESS_CLIENT_SECRET: 'secret' })
    ).toEqual({ clientId: 'id.access', clientSecret: 'secret' });
  });

  it('reads a KEY=VALUE token file (comments, CRLF and quotes)', () => {
    const file = join(dir, 'token.env');
    writeFileSync(
      file,
      '# service token\r\nCF_ACCESS_CLIENT_ID=id.access\r\nCF_ACCESS_CLIENT_SECRET="from-file"\r\n'
    );

    expect(resolveCfAccess({ CF_ACCESS_TOKEN_FILE: file })).toEqual({
      clientId: 'id.access',
      clientSecret: 'from-file',
    });
  });

  it('lets the environment win over the token file', () => {
    const file = join(dir, 'token.env');
    writeFileSync(file, 'CF_ACCESS_CLIENT_ID=file-id\nCF_ACCESS_CLIENT_SECRET=file-secret\n');

    expect(
      resolveCfAccess({ CF_ACCESS_TOKEN_FILE: file, CF_ACCESS_CLIENT_SECRET: 'env-secret' })
    ).toEqual({ clientId: 'file-id', clientSecret: 'env-secret' });
  });

  it('rejects a half-configured token', () => {
    expect(() => resolveCfAccess({ CF_ACCESS_CLIENT_ID: 'id.access' })).toThrow(
      /needs both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET/
    );
  });

  it('reports an unreadable token file', () => {
    expect(() => resolveCfAccess({ CF_ACCESS_TOKEN_FILE: join(dir, 'missing.env') })).toThrow(
      /CF_ACCESS_TOKEN_FILE could not be read/
    );
  });
});
