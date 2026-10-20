import { css } from '@styled-system/css';
import Link from 'next/link';

import type { EntityRef } from '@/api';
import type { Lang } from '@/i18n';

import { paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { entityPill, pillRow, sectionTitle } from '@/styles';

const box = css({ marginTop: '8' });

/** Who and what a post is about (R-WEB-20), each a link to its page, in the post's language. */
export const Entities = ({ lang, entities }: { lang: Lang; entities: readonly EntityRef[] }) =>
  entities.length === 0 ? null : (
    <section aria-labelledby="in-this-story" className={box}>
      <h2 id="in-this-story" className={sectionTitle}>
        {STRINGS[lang].inThisStory}
      </h2>
      <ul className={pillRow}>
        {entities.map((entity) => (
          <li key={entity.id}>
            <Link href={paths.entity(lang, entity.id)} className={entityPill}>
              {entity.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
