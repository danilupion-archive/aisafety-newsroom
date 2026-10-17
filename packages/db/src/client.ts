import { Kysely, PostgresDialect } from 'kysely';

import type { DB } from './generated/db.js';

import { createPool } from './pool.js';

export type Database = Kysely<DB>;
export type { DB } from './generated/db.js';

export interface DatabaseOptions {
  /** Connection string for one runtime role: newsroom_app or newsroom_public. Never the owner. */
  connectionString: string;
  maxConnections?: number;
  applicationName?: string;
  /** The longest any statement may run before Postgres cancels it. */
  statementTimeoutMs?: number;
}

/** How long a request waits for a free connection before it fails, rather than queueing without end. */
const CONNECTION_WAIT_MS = 5000;

/**
 * A Kysely instance over a pool for one runtime role. Its connections run without JIT: the planner prices the
 * published-posts view far above what it costs, so Postgres compiled it on every read, about 200 ms of the database's
 * CPU for a query that runs in under a millisecond, and a few readers at once saturated it. A statement that runs too
 * long is cancelled, and a request that can't get a connection in time fails, so a stuck database answers errors
 * instead of holding requests until the gateway gives up.
 */
export const createDatabase = ({
  connectionString,
  maxConnections = 10,
  applicationName,
  statementTimeoutMs = 15_000,
}: DatabaseOptions): Database =>
  new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: createPool({
        connectionString,
        max: maxConnections,
        application_name: applicationName,
        options: '-c jit=off',
        statement_timeout: statementTimeoutMs,
        connectionTimeoutMillis: CONNECTION_WAIT_MS,
      }),
    }),
  });
