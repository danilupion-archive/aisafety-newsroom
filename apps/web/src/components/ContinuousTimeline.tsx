'use client';

import { css } from '@styled-system/css';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { PostSummary } from '@/api';
import type { Lang } from '@/i18n';

import { morePosts } from '@/actions';
import { autoLoads, readShown, shownHref } from '@/continuous';
import { cursorAfter, type Order } from '@/paging';
import { STRINGS } from '@/strings';
import { button, srOnly } from '@/styles';

import { Timeline } from './Timeline';

/** A batch: the server's page size. */
const PAGE = 20;

const end = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '3',
  marginLeft: { base: '0', md: '8.5rem' },
  marginBottom: '6',
  color: 'muted',
});

/** Where the page remembers how far down a reader was, per address (this tab only). */
const scrollKey = () => `pandoria:scroll:${window.location.pathname}${window.location.search}`;

const query = (): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(window.location.search));

/**
 * A timeline that goes on as the reader reads (R-WEB-19): the next 20 come on their own near the end, until 100 have
 * come that way; then a "Cargar más" waits for the reader, and after it they come on their own for 100 more. The
 * address keeps how many posts the reader has, so a reload renders them all and the browser puts the reader back; back
 * from a post, the posts the page lacks are fetched again and the reader is put back where they were. A screen reader
 * hears each batch arrive. Without JavaScript the page's "older entries" link does the same job.
 */
export const ContinuousTimeline = ({
  lang,
  path,
  order,
  tag,
  entity,
  initial,
  more: initialMore,
  featureFirst,
}: {
  lang: Lang;
  path: string;
  order: Order;
  tag?: string;
  /** An entity's timeline (R-WEB-20), as a tag's. */
  entity?: string;
  initial: readonly PostSummary[];
  more: boolean;
  featureFirst: boolean;
}) => {
  const t = STRINGS[lang];
  const [posts, setPosts] = useState<readonly PostSummary[]>(initial);
  const [more, setMore] = useState(initialMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const busy = useRef(false);

  const load = useCallback(
    async (auto: boolean, count = PAGE): Promise<void> => {
      const last = postsRef.current.at(-1);
      if (!last || busy.current) {
        return;
      }
      busy.current = true;
      setLoading(true);
      setFailed(false);
      try {
        // One more than wanted, to know whether any are left: a "Cargar más" at the very end would bring nothing.
        const asked = await morePosts({
          lang,
          order,
          tag,
          entity,
          after: cursorAfter(last, order),
          limit: count + 1,
        });
        const page = asked.slice(0, count);
        const have = new Set(postsRef.current.map((post) => post.slug));
        const fresh = page.filter((post) => !have.has(post.slug));
        const next = [...postsRef.current, ...fresh];
        postsRef.current = next;
        setPosts(next);
        setMore(asked.length > count);
        if (auto) {
          setAutoLoaded((loaded) => loaded + fresh.length);
        }
        setAnnouncement(t.loadedMore(fresh.length));
        window.history.replaceState(
          window.history.state,
          '',
          shownHref(lang, path, order, next.length),
        );
      } catch {
        setFailed(true);
      } finally {
        busy.current = false;
        setLoading(false);
      }
    },
    [lang, order, tag, entity, path, t],
  );

  // Back to an address that says the reader had more posts than the page brought: fetch the rest, then put them back
  // where they were.
  useEffect(() => {
    const shown = readShown(lang, query());
    const saved = Number(window.sessionStorage.getItem(scrollKey()) ?? 'NaN');
    const restore = () => {
      if (Number.isFinite(saved)) {
        window.requestAnimationFrame(() => window.scrollTo(0, saved));
      }
    };
    if (shown !== undefined && shown > postsRef.current.length && initialMore) {
      void load(false, shown - postsRef.current.length).then(restore);
    } else if (shown !== undefined) {
      restore();
    }
    // Once, on arrival.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // How far down the reader is, for the way back.
  useEffect(() => {
    let frame = 0;
    const remember = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        try {
          window.sessionStorage.setItem(scrollKey(), String(Math.round(window.scrollY)));
        } catch {
          // Storage refused (private mode, full): the way back simply starts at the top.
        }
      });
    };
    window.addEventListener('scroll', remember, { passive: true });
    window.addEventListener('pagehide', remember);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', remember);
      window.removeEventListener('pagehide', remember);
    };
  }, []);

  // Near the end, the next batch, while the pause allows.
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !autoLoads({ autoLoaded, more, loading, failed })) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void load(true);
        }
      },
      { rootMargin: '0px 0px 1200px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [autoLoaded, more, loading, failed, load]);

  const paused = more && !loading && (failed || !autoLoads({ autoLoaded, more, loading, failed }));
  return (
    <>
      <Timeline lang={lang} posts={posts} order={order} featureFirst={featureFirst} />
      <div ref={sentinel} aria-hidden="true" />
      <p className={srOnly} aria-live="polite">
        {announcement}
      </p>
      {loading || paused ? (
        <div className={end}>
          {loading ? <p>{t.loading}</p> : null}
          {failed ? <p>{t.loadFailed}</p> : null}
          {paused ? (
            <button
              type="button"
              className={button}
              data-primary=""
              onClick={() => {
                setAutoLoaded(0);
                void load(false);
              }}
            >
              {t.loadMore}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
};
