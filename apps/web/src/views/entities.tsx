import { css } from '@styled-system/css';
import Link from 'next/link';
import { connection } from 'next/server';

import { entityList } from '@/api';
import { groupEntities } from '@/entities';
import { paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { container, pageTitle, sectionTitle } from '@/styles';

import { type EntitiesProps, readEntities } from './entities-route';

const intro = css({ color: 'body', fontSize: '1.125rem', maxWidth: '47.5rem' });
const group = css({ marginTop: '9' });
// Two columns on a wide screen, one on a phone.
const list = css({
  listStyle: 'none',
  display: 'grid',
  gridTemplateColumns: { base: '1fr', md: '1fr 1fr' },
  columnGap: '8',
  rowGap: '5',
});
const name = css({
  color: 'text',
  fontWeight: '700',
  fontSize: '1.125rem',
  textDecoration: 'underline',
  textDecorationColor: 'accent',
  textDecorationThickness: '2px',
  textUnderlineOffset: '0.2em',
  _hover: { color: 'accent' },
});
const count = css({ color: 'muted', fontSize: '0.875rem', marginLeft: '2' });
const line = css({ color: 'body', fontSize: '0.9375rem', lineHeight: '1.5', marginTop: '1' });

/** Who's who (R-WEB-20): every entity a published story names, as people, organisations and laws. */
export const EntitiesView = async ({ word, params }: EntitiesProps & { word: string }) => {
  await connection();
  const lang = await readEntities(word, params);
  const t = STRINGS[lang];
  const groups = groupEntities(lang, await entityList(lang));
  return (
    <div className={container}>
      <h1 className={pageTitle}>{t.who}</h1>
      <p className={intro}>{t.whoIntro}</p>
      {groups.length === 0 ? (
        <p className={group}>{t.noEntities}</p>
      ) : (
        groups.map(({ type, entities }) => (
          <section key={type} aria-labelledby={`${type}-group`} className={group}>
            <h2 id={`${type}-group`} className={sectionTitle}>
              {t.entityGroups[type]}
            </h2>
            <ul className={list}>
              {entities.map((entity) => (
                <li key={entity.id}>
                  <Link href={paths.entity(lang, entity.id)} className={name}>
                    {entity.name}
                  </Link>
                  <span className={count}>{t.postCount(entity.posts)}</span>
                  <p className={line}>{entity.description}</p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
};
