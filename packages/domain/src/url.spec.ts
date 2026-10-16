import { describe, expect, it } from 'vitest';

import { hostOf, normalizeUrl, youtubeVideoId } from './url.js';

describe('normalizeUrl (R-CAP-5)', () => {
  it('lowercases the scheme and host, not the path', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Some/Path')).toBe('https://example.com/Some/Path');
  });

  it('drops the fragment', () => {
    expect(normalizeUrl('https://example.com/a#section-2')).toBe('https://example.com/a');
  });

  it('drops tracking parameters and keeps the rest in order', () => {
    expect(
      normalizeUrl(
        'https://example.com/a?b=2&utm_source=x&UTM_Medium=y&fbclid=1&gclid=2&igshid=3&ref=hn&a=1',
      ),
    ).toBe('https://example.com/a?b=2&a=1');
  });

  it('encodes the query the same way whether or not tracking parameters were dropped', () => {
    expect(normalizeUrl('https://example.com/s?q=a%20b&utm_source=x')).toBe(
      normalizeUrl('https://example.com/s?q=a%20b'),
    );
  });

  it('drops the query entirely when only tracking parameters were there', () => {
    expect(normalizeUrl('https://example.com/a?utm_source=x')).toBe('https://example.com/a');
  });

  it('drops s and t on x.com only', () => {
    expect(normalizeUrl('https://x.com/user/status/123?s=20&t=abc')).toBe(
      'https://x.com/user/status/123',
    );
    expect(normalizeUrl('https://example.com/a?s=search&t=10')).toBe(
      'https://example.com/a?s=search&t=10',
    );
  });

  it('treats twitter.com, and the www and mobile hosts of both, as x.com', () => {
    for (const host of [
      'twitter.com',
      'www.twitter.com',
      'mobile.twitter.com',
      'www.x.com',
      'mobile.x.com',
    ]) {
      expect(normalizeUrl(`https://${host}/user/status/123?s=20`)).toBe(
        'https://x.com/user/status/123',
      );
    }
  });

  it('drops the trailing slash, also on the root and before a query', () => {
    expect(normalizeUrl('https://example.com/a/')).toBe('https://example.com/a');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
    expect(normalizeUrl('https://example.com/a/?q=1')).toBe('https://example.com/a?q=1');
  });

  it('drops default ports and keeps others', () => {
    expect(normalizeUrl('https://example.com:443/a')).toBe('https://example.com/a');
    expect(normalizeUrl('http://example.com:8080/a')).toBe('http://example.com:8080/a');
  });

  it('gives the same result for the same link sent twice with different tracking (AC-2)', () => {
    expect(normalizeUrl('https://Example.com/news/?utm_source=telegram#top')).toBe(
      normalizeUrl('https://example.com/news'),
    );
  });

  it('adds https:// to a link written without a scheme', () => {
    expect(normalizeUrl('example.com/a')).toBe('https://example.com/a');
  });

  it('refuses anything that is not http or https', () => {
    expect(normalizeUrl('mailto:someone@example.com')).toBeNull();
    expect(normalizeUrl('tg://resolve?domain=x')).toBeNull();
    expect(normalizeUrl('ftp://example.com/file')).toBeNull();
    expect(normalizeUrl('not a url')).toBeNull();
  });
});

describe('YouTube videos (R-CAP-5)', () => {
  const WATCH = 'https://www.youtube.com/watch?v=AbCdEfGhI-_';

  it('finds the video in every form YouTube writes it', () => {
    for (const link of [
      'https://www.youtube.com/watch?v=AbCdEfGhI-_',
      'https://youtube.com/watch?v=AbCdEfGhI-_&list=PLexample&index=2',
      'http://m.youtube.com/watch?feature=share&v=AbCdEfGhI-_',
      'https://music.youtube.com/watch?v=AbCdEfGhI-_&si=abc',
      'https://youtu.be/AbCdEfGhI-_?si=xyz',
      'youtu.be/AbCdEfGhI-_',
      'https://www.youtube.com/shorts/AbCdEfGhI-_?feature=share',
      'https://www.youtube.com/live/AbCdEfGhI-_?si=abc',
      'https://www.youtube.com/embed/AbCdEfGhI-_',
      'https://www.youtube-nocookie.com/embed/AbCdEfGhI-_',
      'https://WWW.YouTube.com/watch?v=AbCdEfGhI-_#comments',
    ]) {
      expect(youtubeVideoId(link), link).toBe('AbCdEfGhI-_');
      expect(normalizeUrl(link), link).toBe(WATCH);
    }
  });

  it('drops the start time too: the same video is one source, and the item keeps the link as sent', () => {
    expect(normalizeUrl('https://youtu.be/AbCdEfGhI-_?t=95')).toBe(WATCH);
    expect(normalizeUrl('https://www.youtube.com/watch?v=AbCdEfGhI-_&t=1m35s')).toBe(WATCH);
  });

  it('is no video without an id of the right shape, or off YouTube', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(youtubeVideoId('https://www.youtube.com/watch?v=AbCdEfGhI-_x')).toBeNull();
    expect(youtubeVideoId('https://www.youtube.com/@somechannel')).toBeNull();
    expect(youtubeVideoId('https://www.youtube.com/playlist?list=PLexample')).toBeNull();
    expect(youtubeVideoId('https://example.com/watch?v=AbCdEfGhI-_')).toBeNull();
    expect(youtubeVideoId('https://youtu.be.example.com/AbCdEfGhI-_')).toBeNull();
    expect(youtubeVideoId('not a url')).toBeNull();
  });

  it('drops YouTube’s share parameters from its other links', () => {
    expect(
      normalizeUrl('https://www.youtube.com/playlist?list=PLexample&si=abc&feature=shared&pp=x'),
    ).toBe('https://www.youtube.com/playlist?list=PLexample');
    expect(normalizeUrl('https://example.com/a?si=1&feature=2&pp=3')).toBe(
      'https://example.com/a?si=1&feature=2&pp=3',
    );
  });
});

describe('hostOf', () => {
  it('returns the normalised host', () => {
    expect(hostOf('https://www.twitter.com/a')).toBe('x.com');
    expect(hostOf('https://News.Example.com/a')).toBe('news.example.com');
  });

  it('returns null for what normalizeUrl refuses', () => {
    expect(hostOf('mailto:a@b.c')).toBeNull();
  });
});
