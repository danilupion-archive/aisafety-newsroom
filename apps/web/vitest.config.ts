import base from '@slango.configs/vitest/default';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';

// Next's tsconfig leaves JSX as it is for Next to compile, and maps `@/` to src/: the tests do both themselves, so they
// can render a component's markup.
export default mergeConfig(
  base,
  defineConfig({
    oxc: { jsx: { runtime: 'automatic' } },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  }),
);
