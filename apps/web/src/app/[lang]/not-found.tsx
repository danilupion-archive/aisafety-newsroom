import type { Metadata } from 'next';

import { lang as rootLang } from 'next/root-params';

import { DEFAULT_LANG, isLang } from '@/i18n';
import { STRINGS } from '@/strings';
import { NotFoundView } from '@/views/not-found';

/**
 * A page that finds no post itself, inside its language's layout. Not-found pages get no props: the root param says.
 * Next draws this one in the browser only (its server answer is a bare shell), so the proxy answers the missing
 * addresses it can tell with `missing.html` instead, whose text is in the page itself. Its title is that page's too:
 * Next renders a 404 with a not-found page's metadata.
 */
export const generateMetadata = async (): Promise<Metadata> => {
  const value = await rootLang();
  return { title: STRINGS[isLang(value) ? value : DEFAULT_LANG].notFound };
};

const NotFound = async () => {
  const value = await rootLang();
  return <NotFoundView lang={isLang(value) ? value : DEFAULT_LANG} />;
};

export default NotFound;
