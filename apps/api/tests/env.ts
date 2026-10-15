import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const envFile = `${root}.env`;
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env and run \`pnpm db:up\`.`);
  }
  return value;
};

/** newsroom_app on newsroom_test: the API's own role, as in production. */
export const appUrl = (): string => required('TEST_APP_DATABASE_URL');

/** newsroom_public on newsroom_test: the site's reads, as in production. */
export const publicUrl = (): string => required('TEST_PUBLIC_DATABASE_URL');

/** Superuser on newsroom_test: only to empty the tables between tests and to set up rows the API can't write. */
export const superuserUrl = (): string => required('TEST_SUPERUSER_DATABASE_URL');
