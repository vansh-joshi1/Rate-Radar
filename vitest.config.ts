import { defineConfig, configDefaults } from 'vitest/config';

/**
 * Without this, vitest globs the whole tree — including the test directories
 * under `.claude/worktrees`, a stale checkout of this same suite. That ran 39
 * files where 17 exist and reported 326 tests where 173 do, so every count was
 * inflated and a green run said nothing about which copy was green.
 *
 * `.next` is excluded for the same reason at a different scale: it holds a
 * compiled copy of everything.
 */
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/.next/**'],
  },
});
