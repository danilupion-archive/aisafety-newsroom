import { css } from '@styled-system/css';
import Link from 'next/link';

import type { PostSummary } from '@/api';
import type { Lang } from '@/i18n';

import { longDate } from '@/format';
import { paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { muted } from '@/styles';

import { Tags } from './Tags';

const item = css({
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderTopColor: 'rule',
  paddingY: '5',
});
const title = css({ fontSize: 'xl', fontWeight: 'bold', lineHeight: '1.3', marginY: '1' });

export const PostList = ({ lang, posts }: { lang: Lang; posts: readonly PostSummary[] }) => (
  <ol className={css({ listStyle: 'none', padding: '0' })}>
    {posts.map((post) => (
      <li key={post.slug} className={item}>
        <article>
          <p className={muted}>
            {STRINGS[lang].type[post.type]} ·{' '}
            <time dateTime={post.published_at}>{longDate(lang, post.published_at)}</time>
          </p>
          <h2 className={title}>
            <Link href={paths.post(lang, post.slug)}>{post.title}</Link>
          </h2>
          {post.summary === '' ? null : <p>{post.summary}</p>}
          <Tags lang={lang} tags={post.tags} />
        </article>
      </li>
    ))}
  </ol>
);
