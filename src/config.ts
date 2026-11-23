/**
 * Configuration management with environment variable validation
 */

import 'dotenv/config';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Helper function to expand system variables
function expandSystemVariables(path: string | undefined): string {
  // If no path is provided, use default
  if (!path) {
    return join(homedir(), 'Downloads', 'Metabase');
  }

  const homeDir = homedir();
  const desktopDir = join(homeDir, 'Desktop');
  const documentsDir = join(homeDir, 'Documents');
  const downloadsDir = join(homeDir, 'Downloads');

  return path
    .replace(/\$\{HOME\}/g, homeDir)
    .replace(/\$\{DESKTOP\}/g, desktopDir)
    .replace(/\$\{DOCUMENTS\}/g, documentsDir)
    .replace(/\$\{DOWNLOADS\}/g, downloadsDir)
    .replace(/\$HOME/g, homeDir)
    .replace(/^~/, homeDir);
}

// Environment variable schema
const envSchema = z
  .object({
    METABASE_URL: z.string().url('METABASE_URL must be a valid URL'),
    METABASE_API_KEY: z.string().optional(),
    METABASE_PROXY_AUTHORIZATION: z.string().optional(),
    CF_ACCESS_CLIENT_ID: z.string().optional(),
    CF_ACCESS_CLIENT_SECRET: z.string().optional(),
    CF_ACCESS_TOKEN_FILE: z.string().optional(),
    METABASE_USER_EMAIL: z.string().email().optional(),
    METABASE_PASSWORD: z.string().min(1).optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    CACHE_TTL_MS: z
      .string()
      .default('600000')
      .transform(val => parseInt(val, 10))
      .pipe(z.number().positive()), // 10 minutes
    REQUEST_TIMEOUT_MS: z
      .string()
      .default('600000')
      .transform(val => parseInt(val, 10))
      .pipe(z.number().positive()), // 10 minutes
    EXPORT_DIRECTORY: z.string().default('${DOWNLOADS}/Metabase').transform(expandSystemVariables),
    METABASE_READ_ONLY_MODE: z
      .string()
      .default('true')
      .transform(val => val.toLowerCase() === 'true'),
  })
  .refine(data => data.METABASE_API_KEY || (data.METABASE_USER_EMAIL && data.METABASE_PASSWORD), {
    message:
      'Either METABASE_API_KEY or both METABASE_USER_EMAIL and METABASE_PASSWORD must be provided',
    path: ['METABASE_API_KEY'],
  });

// Parse and validate environment variables
function validateEnvironment() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
    }
    throw error;
  }
}

// Create default test config for test environment
function createTestConfig() {
  return {
    METABASE_URL: 'http://localhost:3000',
    METABASE_API_KEY: 'test-api-key',
    METABASE_PROXY_AUTHORIZATION: undefined,
    CF_ACCESS_CLIENT_ID: undefined,
    CF_ACCESS_CLIENT_SECRET: undefined,
    CF_ACCESS_TOKEN_FILE: undefined,
    METABASE_USER_EMAIL: undefined,
    METABASE_PASSWORD: undefined,
    NODE_ENV: 'test' as const,
    LOG_LEVEL: 'info' as const,
    CACHE_TTL_MS: 600000,
    REQUEST_TIMEOUT_MS: 600000,
    EXPORT_DIRECTORY: join(homedir(), 'Downloads', 'Metabase'),
    METABASE_READ_ONLY_MODE: true,
  };
}

// Export validated configuration or test config
export const config =
  process.env.NODE_ENV === 'test' || process.env.VITEST
    ? createTestConfig()
    : validateEnvironment();

// Authentication method enum
export enum AuthMethod {
  SESSION = 'session',
  API_KEY = 'api_key',
}

// Logger level enum
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

// Determine authentication method
export const authMethod: AuthMethod = config.METABASE_API_KEY
  ? AuthMethod.API_KEY
  : AuthMethod.SESSION;

/**
 * Cloudflare Access service token (Metabase behind Cloudflare Zero Trust), or null when not configured.
 * CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET win over the same keys read from CF_ACCESS_TOKEN_FILE,
 * a KEY=VALUE file that keeps the secret out of the MCP client's configuration.
 */
export function resolveCfAccess(env: {
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
  CF_ACCESS_TOKEN_FILE?: string;
}): { clientId: string; clientSecret: string } | null {
  const fromFile: Record<string, string> = {};
  if (env.CF_ACCESS_TOKEN_FILE) {
    const path = expandSystemVariables(env.CF_ACCESS_TOKEN_FILE);
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch (error) {
      throw new Error(
        `CF_ACCESS_TOKEN_FILE could not be read: ${path} (${(error as Error).message})`
      );
    }
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*(CF_ACCESS_CLIENT_ID|CF_ACCESS_CLIENT_SECRET)\s*=\s*(.*?)\s*$/);
      if (match) {
        fromFile[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
      }
    }
  }
  const clientId = env.CF_ACCESS_CLIENT_ID || fromFile.CF_ACCESS_CLIENT_ID;
  const clientSecret = env.CF_ACCESS_CLIENT_SECRET || fromFile.CF_ACCESS_CLIENT_SECRET;
  if (!clientId && !clientSecret) {
    return null;
  }
  if (!clientId || !clientSecret) {
    throw new Error(
      'Cloudflare Access needs both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET (directly or in CF_ACCESS_TOKEN_FILE)'
    );
  }
  return { clientId, clientSecret };
}

export const cfAccess = resolveCfAccess(config);

export default config;
