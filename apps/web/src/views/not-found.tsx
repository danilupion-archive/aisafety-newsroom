import { css } from '@styled-system/css';
import Link from 'next/link';

import type { Lang } from '@/i18n';

import { paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { button, column, pageTitle } from '@/styles';

/** A missing page's text in its language, inside that language's layout, with the way back home. */
export const NotFoundView = ({ lang }: { lang: Lang }) => (
  <div className={column}>
    <h1 className={pageTitle}>{STRINGS[lang].notFound}</h1>
    <p className={css({ marginTop: '6' })}>
      <Link href={paths.home(lang)} className={button} data-primary="">
        {STRINGS[lang].backHome}
      </Link>
    </p>
  </div>
);
