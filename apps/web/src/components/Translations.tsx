import Link from 'next/link';

import type { Translation } from '@/api';

import { paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { button } from '@/styles';

/** A post's or a page's versions in the other language (R-WEB-10), each a button labelled in its own language. */
export const Translations = ({ translations }: { translations: readonly Translation[] }) => (
  <>
    {translations.map((translation) => (
      <Link
        key={translation.lang}
        href={paths.post(translation.lang, translation.slug)}
        hrefLang={translation.lang}
        lang={translation.lang}
        className={button}
      >
        {STRINGS[translation.lang].readIn} <span aria-hidden="true">&nbsp;→</span>
      </Link>
    ))}
  </>
);
