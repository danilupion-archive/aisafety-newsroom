import { css } from '@styled-system/css';
import Link from 'next/link';
import { lang as rootLang } from 'next/root-params';

import { DEFAULT_LANG, isLang, paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { button, column, pageTitle } from '@/styles';

/** A missing page in one language, inside that language's layout. Not-found pages get no props: the root param says. */
const NotFound = async () => {
  const value = await rootLang();
  const lang = isLang(value) ? value : DEFAULT_LANG;
  return (
    <div className={column}>
      <h1 className={pageTitle}>{STRINGS[lang].notFound}</h1>
      <p className={css({ marginTop: '6' })}>
        <Link href={paths.home(lang)} className={button} data-primary="">
          {STRINGS[lang].backHome}
        </Link>
      </p>
    </div>
  );
};

export default NotFound;
