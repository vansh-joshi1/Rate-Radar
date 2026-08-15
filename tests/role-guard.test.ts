import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { roleAtLeast, type Role } from '../lib/auth/guard';

describe('roleAtLeast', () => {
  it('lets a role satisfy its own level', () => {
    expect(roleAtLeast('viewer', 'viewer')).toBe(true);
    expect(roleAtLeast('manager', 'manager')).toBe(true);
    expect(roleAtLeast('owner', 'owner')).toBe(true);
  });

  it('lets a higher role satisfy a lower requirement', () => {
    expect(roleAtLeast('owner', 'manager')).toBe(true);
    expect(roleAtLeast('owner', 'viewer')).toBe(true);
    expect(roleAtLeast('manager', 'viewer')).toBe(true);
  });

  it('refuses a lower role for a higher requirement', () => {
    expect(roleAtLeast('viewer', 'manager')).toBe(false);
    expect(roleAtLeast('viewer', 'owner')).toBe(false);
    expect(roleAtLeast('manager', 'owner')).toBe(false);
  });

  it('treats a missing or unrecognized role as viewer — the least privilege', () => {
    expect(roleAtLeast(undefined, 'manager')).toBe(false);
    expect(roleAtLeast(null, 'manager')).toBe(false);
    expect(roleAtLeast('superuser', 'manager')).toBe(false);
    expect(roleAtLeast(undefined, 'viewer')).toBe(true);
  });
});

/**
 * Structural guard: a mutating route that forgets its role check is exactly the
 * bug this work fixes, so the suite fails when a new one ships unguarded rather
 * than waiting for someone to notice in production.
 */
describe('every mutating API route is role-guarded', () => {
  const API_DIR = join(__dirname, '..', 'app', 'api');

  /** Routes authenticated by something other than a user session — each with the reason. */
  const NON_SESSION_ROUTES: Record<string, string> = {
    'ingest/route.ts': 'INGEST_SECRET bearer token (collector)',
    'auth/[...nextauth]/route.ts': "NextAuth's own handler",
    'cron/heartbeat/route.ts': 'Vercel cron secret',
  };

  function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return routeFiles(full);
      return entry.name === 'route.ts' ? [full] : [];
    });
  }

  const MUTATING = /export async function (POST|PUT|PATCH|DELETE)\b/;

  it('finds the route files to check', () => {
    expect(routeFiles(API_DIR).length).toBeGreaterThan(5);
  });

  for (const file of routeFiles(API_DIR)) {
    const rel = relative(API_DIR, file).split(sep).join('/');
    const source = readFileSync(file, 'utf8');
    if (!MUTATING.test(source)) continue;
    if (rel.startsWith('v1/') || rel in NON_SESSION_ROUTES) continue;

    it(`${rel} calls requireRole`, () => {
      expect(source).toMatch(/requireRole\(/);
    });
  }
});

describe('write levels', () => {
  it('names every role in ascending order of privilege', () => {
    const ascending: Role[] = ['viewer', 'manager', 'owner'];
    for (let i = 1; i < ascending.length; i++) {
      expect(roleAtLeast(ascending[i], ascending[i - 1])).toBe(true);
      expect(roleAtLeast(ascending[i - 1], ascending[i])).toBe(false);
    }
  });
});
