import type { FastifyReply } from 'fastify';
import type { z } from 'zod';

import { describe } from './inbox/schemas.js';

/** The value as the schema reads it; or, if it doesn't fit, a 400 with the first problem (§9), and undefined. */
export const parse = <S extends z.ZodType>(
  schema: S,
  value: unknown,
  reply: FastifyReply,
): z.output<S> | undefined => {
  const result = schema.safeParse(value);
  if (!result.success) {
    void reply.code(400).send({ error: describe(result.error) });
    return undefined;
  }
  return result.data;
};
