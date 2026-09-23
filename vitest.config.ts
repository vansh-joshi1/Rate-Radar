import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `.claude/worktrees/` holds checkouts of in-flight branches. Vitest's
    // default glob walked into them and ran their copies of the suite too, so
    // a local run reported roughly twice the tests a clean clone has — passing
    // results from code that is not this working tree.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.claude/**'],
  },
});
