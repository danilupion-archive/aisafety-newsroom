import { wikidataUrl } from '@aisafety-newsroom/domain/entities';
import { css } from '@styled-system/css';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { getEntity, latestPosts } from '@/api';
import { ContinuousTimeline } from '@/components/ContinuousTimeline';
import { FeedBox } from '@/components/FeedBox';
import { JsonLd } from '@/components/JsonLd';
import { OrderSwitch } from '@/components/OrderSwitch';
import { readShown } from '@/continuous';
import { paths } from '@/i18n';
import { nextPage, readCursor, readOrder } from '@/paging';
import { site } from '@/site';
import { STRINGS } from '@/strings';
import { entityStructuredData } from '@/structured-data';
import { container, pageTitle, typePill } from '@/styles';

import { type EntityProps, readEntity } from './entity-route';

const PAGE = 20;

const description = css({
  maxWidth: '47.5rem',
  color: 'body',
  fontSize: { base: '1.1875rem', md: '1.375rem' },
  lineHeight: '1.5',
});
const facts = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: '4',
  rowGap: '2',
  marginTop: '4',
  marginBottom: '8',
  color: 'muted',
  '& a': {
    color: 'text',
    textDecoration: 'underline',
    textDecorationColor: 'accent',
    textDecorationThickness: '2px',
    textUnderlineOffset: '0.2em',
  },
});

/**
 * An entity's page (R-WEB-20): who or what it is, in the page's language, a link to its Wikidata item, and the posts
 * that name it as a timeline, page by page and in both orders, like a tag's.
 */
export const EntityView = async ({
  word,
  params,
  searchParams,
}: EntityProps & { word: string }) => {
  await connection();
  const { lang, id } = await readEntity(word, params);
  const entity = await getEntity(lang, id);
  if (!entity) {
    notFound();
  }
  const t = STRINGS[lang];
  const query = await searchParams;
  const order = readOrder(lang, query);
  const after = readCursor(lang, query, order);
  // Back to a continuous timeline (R-WEB-19): as many posts as the reader had, bounded; a page's worth otherwise.
  const limit = after ? PAGE : (readShown(lang, query) ?? PAGE);
  const posts = await latestPosts(lang, { entity: id, after, limit, order });
  const last = posts.at(-1);
  const path = paths.entity(lang, id);
  return (
    <div className={container}>
      <h1 className={pageTitle}>{entity.name}</h1>
      <p className={description}>{entity.description}</p>
      <p className={facts}>
        <span className={typePill}>{t.entityTypes[entity.type]}</span>
        <span>{t.postCount(entity.posts)}</span>
        {entity.wikidata === null ? null : (
          <a href={wikidataUrl(entity.wikidata)} rel="external">
            {t.wikidata}
          </a>
        )}
      </p>
      <OrderSwitch lang={lang} path={path} order={order} />
      {posts.length === 0 ? (
        <p>{t.noOlder}</p>
      ) : (
        <ContinuousTimeline
          // A new order or entity is a new list: the posts already loaded must not carry over.
          key={`${id}:${order}`}
          lang={lang}
          path={path}
          order={order}
          entity={id}
          initial={posts}
          more={posts.length === limit}
          featureFirst={false}
        />
      )}
      <FeedBox
        lang={lang}
        older={posts.length === limit && last ? nextPage(lang, path, last, order) : undefined}
      />
      <JsonLd data={entityStructuredData(lang, entity, `${site().url}${path}`)} />
    </div>
  );
};
