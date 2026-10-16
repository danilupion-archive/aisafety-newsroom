import Link from 'next/link';

import type { Lang } from '@/i18n';

import { paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { pillRow, tagPill } from '@/styles';
import { tagLabel } from '@/tags';

/** A post's tags as pills, each a link to the tag's page in the post's language. */
export const Tags = ({ lang, tags }: { lang: Lang; tags: readonly string[] }) =>
  tags.length === 0 ? null : (
    <ul className={pillRow} aria-label={STRINGS[lang].topics}>
      {tags.map((tag) => (
        <li key={tag}>
          <Link href={paths.tag(lang, tag)} className={tagPill}>
            {tagLabel(lang, tag)}
          </Link>
        </li>
      ))}
    </ul>
  );
