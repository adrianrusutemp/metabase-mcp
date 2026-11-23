import { describe, expect, it } from 'vitest';
import { AuthMethod } from '../../src/config.js';
import { buildMetabaseHeaders } from '../../src/utils/requestUtils.js';

describe('requestUtils', () => {
  describe('buildMetabaseHeaders', () => {
    it('should include API key auth and proxy auth when provided', () => {
      const headers = buildMetabaseHeaders({
        baseHeaders: {
          'Content-Type': 'application/json',
        },
        authMethod: AuthMethod.API_KEY,
        apiKey: 'metabase-api-key',
        proxyAuthorization: 'Bearer iap-token',
      });

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Proxy-Authorization': 'Bearer iap-token',
        'X-API-KEY': 'metabase-api-key',
      });
    });

    it('should include session auth without proxy auth when proxy auth is not configured', () => {
      const headers = buildMetabaseHeaders({
        baseHeaders: {
          'Content-Type': 'application/json',
        },
        authMethod: AuthMethod.SESSION,
        sessionToken: 'session-token',
      });

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'X-Metabase-Session': 'session-token',
      });
    });

    it('should include the Cloudflare Access service token when configured', () => {
      const headers = buildMetabaseHeaders({
        authMethod: AuthMethod.API_KEY,
        apiKey: 'metabase-api-key',
        cfAccess: { clientId: 'id.access', clientSecret: 'cf-secret' },
      });

      expect(headers).toEqual({
        'X-API-KEY': 'metabase-api-key',
        'CF-Access-Client-Id': 'id.access',
        'CF-Access-Client-Secret': 'cf-secret',
      });
    });
  });
});
