import Link from 'next/link';
import { lang as rootLang } from 'next/root-params';

import { DEFAULT_LANG, isLang, paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { pageTitle } from '@/styles';

/** A missing page in one language, inside that language's layout. Not-found pages get no props: the root param says. */
const NotFound = async () => {
  const value = await rootLang();
  const lang = isLang(value) ? value : DEFAULT_LANG;
  return (
    <>
      <h1 className={pageTitle}>{STRINGS[lang].notFound}</h1>
      <p>
        <Link href={paths.home(lang)}>{STRINGS[lang].backHome}</Link>
      </p>
    </>
  );
};

export default NotFound;
