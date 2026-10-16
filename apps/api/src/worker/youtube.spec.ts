import { describe, expect, it } from 'vitest';

import { type Fetched, FetchRefused } from './fetch-url.js';
import { extractVideo, jsonObjectAt, oembedUrl, playerData, readOembed } from './youtube.js';

/** Fictional throughout: no real video, channel or page. */
const ID = 'AbCdEfGhI-_';

const PLAYER = {
  playabilityStatus: { status: 'OK' },
  videoDetails: {
    videoId: ID,
    title: 'Una charla de ejemplo',
    author: 'Canal de ejemplo',
    lengthSeconds: '754',
    shortDescription:
      'Una descripción ficticia, con una llave } y "comillas" dentro.\n\nY un segundo párrafo.',
  },
  microformat: {
    playerMicroformatRenderer: {
      publishDate: '2026-10-10T08:00:00-07:00',
      uploadDate: '2026-10-09T23:00:00-07:00',
      ownerChannelName: 'Canal de ejemplo',
    },
  },
};

const watchPage = (player: unknown = PLAYER, extra = ''): string =>
  `<!doctype html><html><head><meta charset="utf-8">
  <meta property="og:title" content="Título en metadatos"><meta property="og:site_name" content="YouTube">
  <meta itemprop="datePublished" content="2026-10-08T00:00:00-07:00"></head><body>
  <script nonce="n">${extra}var ytInitialPlayerResponse = ${JSON.stringify(player)};var meta = document.createElement('meta');</script>
  </body></html>`;

const bytes = (text: string): Buffer => Buffer.from(text, 'utf8');

const OEMBED = {
  title: 'Una charla de ejemplo',
  author_name: 'Canal de ejemplo',
  provider_name: 'YouTube',
  type: 'video',
};

const json = (value: unknown, contentType = 'application/json'): Fetched => ({
  contentType,
  finalUrl: oembedUrl(ID),
  status: 200,
  bytes: bytes(JSON.stringify(value)),
});

describe('jsonObjectAt', () => {
  it('reads one object, past braces and quotes inside its strings', () => {
    const text = 'x = {"a":"} \\" {","b":{"c":1}}; y = {"d":2}';
    const start = text.indexOf('{');
    expect(jsonObjectAt(text, start)).toBe('{"a":"} \\" {","b":{"c":1}}');
  });

  it('gives null when the object never closes, or not within the limit', () => {
    expect(jsonObjectAt('{"a":{"b":1}', 0)).toBeNull();
    expect(jsonObjectAt(`{"a":"${'x'.repeat(100)}"}`, 0, 50)).toBeNull();
    expect(jsonObjectAt('no object', 0)).toBeNull();
  });
});

describe('playerData (R-FET-7)', () => {
  it('reads the title, channel, full description, length and date from the page’s player data', () => {
    expect(playerData(watchPage(), ID)).toEqual({
      title: 'Una charla de ejemplo',
      author: 'Canal de ejemplo',
      description:
        'Una descripción ficticia, con una llave } y "comillas" dentro.\n\nY un segundo párrafo.',
      durationSeconds: 754,
      publishedAt: '2026-10-10T08:00:00-07:00',
    });
  });

  it('skips an earlier assignment that holds no object', () => {
    expect(
      playerData(watchPage(PLAYER, 'window["ytInitialPlayerResponse"] = null;'), ID)?.title,
    ).toBe('Una charla de ejemplo');
  });

  it('takes the channel and date from the microformat when the details lack them', () => {
    const player = {
      ...PLAYER,
      videoDetails: { videoId: ID, title: 'Solo el título' },
    };
    expect(playerData(watchPage(player), ID)).toMatchObject({
      author: 'Canal de ejemplo',
      description: null,
      durationSeconds: null,
    });
  });

  it('ignores player data about another video', () => {
    const other = { ...PLAYER, videoDetails: { ...PLAYER.videoDetails, videoId: 'ZyXwVuTsRqP' } };
    expect(playerData(watchPage(other), ID)).toBeNull();
  });

  it('gives null for a page without the video’s details, as a "confirm you’re not a bot" page', () => {
    const blocked = { playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in' } };
    expect(playerData(watchPage(blocked), ID)).toBeNull();
    expect(playerData('<html><body>Consent</body></html>', ID)).toBeNull();
    expect(playerData('var ytInitialPlayerResponse = {"videoDetails": nope};', ID)).toBeNull();
  });

  it('has no length for a stream still on the air, or one it can’t read', () => {
    for (const lengthSeconds of ['0', '', '12.5', '-3', 'many', '99999999999']) {
      const player = { ...PLAYER, videoDetails: { ...PLAYER.videoDetails, lengthSeconds } };
      expect(playerData(watchPage(player), ID)?.durationSeconds, lengthSeconds).toBeNull();
    }
  });

  it('keeps fields of the wrong type out instead of failing', () => {
    const player = { ...PLAYER, videoDetails: { ...PLAYER.videoDetails, author: 42 } };
    expect(playerData(watchPage(player), ID)?.author).toBe('Canal de ejemplo');
  });
});

describe('readOembed (R-FET-7)', () => {
  it('reads the title, channel and provider', () => {
    expect(readOembed(json(OEMBED))).toEqual({
      title: 'Una charla de ejemplo',
      author: 'Canal de ejemplo',
      provider: 'YouTube',
    });
  });

  it('gives null for anything but a small JSON object', () => {
    expect(readOembed(json(OEMBED, 'text/html'))).toBeNull();
    expect(readOembed({ ...json(OEMBED), bytes: bytes('{"title": ') })).toBeNull();
    expect(readOembed({ ...json(OEMBED), bytes: bytes('[1, 2]') })).toBeNull();
    expect(
      readOembed({ ...json(OEMBED), bytes: bytes(JSON.stringify({ title: 'x'.repeat(70_000) })) }),
    ).toBeNull();
  });
});

describe('extractVideo (R-FET-7)', () => {
  const page = (html: string): Fetched => ({
    contentType: 'text/html',
    charset: 'utf-8',
    finalUrl: `https://www.youtube.com/watch?v=${ID}`,
    status: 200,
    bytes: bytes(html),
  });

  it('records a video from its page, without asking oEmbed', async () => {
    const asked: string[] = [];
    const extracted = await extractVideo(page(watchPage()), ID, async (url) => {
      asked.push(url);
      return json(OEMBED);
    });
    expect(asked).toEqual([]);
    expect(extracted).toEqual({
      title: 'Una charla de ejemplo',
      siteName: 'YouTube',
      publishedAt: '2026-10-10T08:00:00-07:00',
      text: 'Una descripción ficticia, con una llave } y "comillas" dentro.\n\nY un segundo párrafo.',
      video: { author: 'Canal de ejemplo', durationSeconds: 754 },
    });
  });

  it('asks oEmbed for the title and channel when the page has no player data', async () => {
    const asked: string[] = [];
    const blocked = watchPage({ playabilityStatus: { status: 'LOGIN_REQUIRED' } });
    const extracted = await extractVideo(page(blocked), ID, async (url) => {
      asked.push(url);
      return json(OEMBED);
    });
    expect(asked).toEqual([
      'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DAbCdEfGhI-_',
    ]);
    expect(extracted).toEqual({
      title: 'Una charla de ejemplo',
      siteName: 'YouTube',
      publishedAt: '2026-10-08T00:00:00-07:00',
      text: null,
      video: { author: 'Canal de ejemplo', durationSeconds: null },
    });
  });

  it('keeps what the page’s metadata says when oEmbed fails too', async () => {
    const extracted = await extractVideo(
      page('<html><head><meta property="og:title" content="Solo metadatos"></head></html>'),
      ID,
      async () => {
        throw new FetchRefused('status', 429);
      },
    );
    expect(extracted).toEqual({
      title: 'Solo metadatos',
      siteName: null,
      publishedAt: null,
      text: null,
      video: { author: null, durationSeconds: null },
    });
  });
});
