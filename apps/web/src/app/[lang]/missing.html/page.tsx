import { connection } from 'next/server';

import { pageLang } from '@/params';
import { NotFoundView } from '@/views/not-found';

type Props = { params: Promise<{ lang: string }> };

/**
 * A missing address's page (404): the proxy serves it to an address that is no page or no published post, rewritten
 * here with that status, so its text is in the page itself and not only drawn by script. With that status Next takes
 * its metadata from not-found.tsx. Never an address of its own: no slug has a dot.
 */
const Missing = async ({ params }: Props) => {
  await connection();
  return <NotFoundView lang={await pageLang(params)} />;
};

export default Missing;
