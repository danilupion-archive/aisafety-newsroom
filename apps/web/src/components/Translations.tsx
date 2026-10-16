import Link from 'next/link';

import type { Translation } from '@/api';

import { paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { muted } from '@/styles';

/** A post's or a page's versions in the other language (R-WEB-10), each link labelled in its own language. */
export const Translations = ({ translations }: { translations: readonly Translation[] }) => (
  <>
    {translations.map((translation) => (
      <p key={translation.lang} lang={translation.lang} className={muted}>
        <Link href={paths.post(translation.lang, translation.slug)} hrefLang={translation.lang}>
          {STRINGS[translation.lang].readIn}
        </Link>
      </p>
    ))}
  </>
);
