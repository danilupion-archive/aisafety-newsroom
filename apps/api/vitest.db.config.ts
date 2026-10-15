import base from '@slango.configs/vitest/default';
import { defineConfig, mergeConfig } from 'vitest/config';

// The API's routes and data functions against newsroom_test, which @aisafety-newsroom/db's database tests rebuild
// first (turbo runs them before these). Each test empties the tables it uses, so files run one at a time.
export default mergeConfig(
  base,
  defineConfig({ test: { include: ['tests/**/*.spec.ts'], fileParallelism: false } }),
);
