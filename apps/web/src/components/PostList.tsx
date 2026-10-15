import { css } from '@styled-system/css';
import Link from 'next/link';

import type { PostSummary } from '@/api';

import { longDate, TYPE_LABEL } from '@/format';
import { muted } from '@/styles';

import { Tags } from './Tags';

const item = css({
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderTopColor: 'rule',
  paddingY: '5',
});
const title = css({ fontSize: 'xl', fontWeight: 'bold', lineHeight: '1.3', marginY: '1' });

export const PostList = ({ posts }: { posts: readonly PostSummary[] }) => (
  <ol className={css({ listStyle: 'none', padding: '0' })}>
    {posts.map((post) => (
      <li key={post.slug} className={item}>
        <article>
          <p className={muted}>
            {TYPE_LABEL[post.type]} ·{' '}
            <time dateTime={post.published_at}>{longDate(post.published_at)}</time>
          </p>
          <h2 className={title}>
            <Link href={`/${post.slug}`}>{post.title}</Link>
          </h2>
          {post.summary === '' ? null : <p>{post.summary}</p>}
          <Tags tags={post.tags} />
        </article>
      </li>
    ))}
  </ol>
);
