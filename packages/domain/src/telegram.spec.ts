import { describe, expect, it } from 'vitest';

import { extractCapture, parseCommand, type TelegramMessage } from './telegram.js';

const message = (fields: Partial<TelegramMessage>): TelegramMessage => ({
  message_id: 1,
  chat: { id: 10, type: 'private' },
  from: { id: 20 },
  ...fields,
});

/** A `url` entity over the first occurrence of `url` in `text`. */
const urlEntity = (text: string, url: string) => ({
  type: 'url' as const,
  offset: text.indexOf(url),
  length: url.length,
});

describe('extractCapture (R-CAP-3)', () => {
  it('takes the URL from a url entity and keeps the rest as the note', () => {
    const text = 'Look at this https://example.com/a?utm_source=x it matters';
    const capture = extractCapture(
      message({ text, entities: [urlEntity(text, 'https://example.com/a?utm_source=x')] }),
    );
    expect(capture.links).toEqual([
      { url: 'https://example.com/a?utm_source=x', normalized: 'https://example.com/a' },
    ]);
    expect(capture.note).toBe('Look at this it matters');
    expect(capture.rawText).toBe(text);
  });

  it('takes the URL of a text_link and keeps its visible text in the note', () => {
    const text = 'Read the report now';
    const capture = extractCapture(
      message({
        text,
        entities: [{ type: 'text_link', offset: 9, length: 6, url: 'https://example.org/report' }],
      }),
    );
    expect(capture.links).toEqual([
      { url: 'https://example.org/report', normalized: 'https://example.org/report' },
    ]);
    expect(capture.note).toBe('Read the report now');
  });

  it('reads the caption and its entities when there is no text (a forwarded photo, a PDF)', () => {
    const caption = 'https://example.com/doc.pdf the new paper';
    const capture = extractCapture(
      message({
        caption,
        caption_entities: [urlEntity(caption, 'https://example.com/doc.pdf')],
        forward_origin: { type: 'channel' },
      }),
    );
    expect(capture.links.map((link) => link.normalized)).toEqual(['https://example.com/doc.pdf']);
    expect(capture.note).toBe('the new paper');
  });

  it('returns one link per URL, in order, without repeating the same link', () => {
    const text = 'a https://one.example/x b https://two.example/y c https://one.example/x/';
    const entities = [
      { type: 'url' as const, offset: 2, length: 21 },
      { type: 'url' as const, offset: 26, length: 21 },
      { type: 'url' as const, offset: 50, length: 22 },
    ];
    const capture = extractCapture(message({ text, entities }));
    expect(capture.links.map((link) => link.normalized)).toEqual([
      'https://one.example/x',
      'https://two.example/y',
    ]);
    expect(capture.note).toBe('a b c');
  });

  it('counts offsets in UTF-16 code units, as Telegram does', () => {
    const text = '🔥 https://example.com/a ¡ojo!';
    const capture = extractCapture(
      message({ text, entities: [urlEntity(text, 'https://example.com/a')] }),
    );
    expect(capture.links.map((link) => link.normalized)).toEqual(['https://example.com/a']);
    expect(capture.note).toBe('🔥 ¡ojo!');
  });

  it('keeps line breaks in the note, but not the blank lines left behind', () => {
    const text = 'First line\nhttps://example.com/a\n\n\nSecond line';
    const capture = extractCapture(
      message({ text, entities: [urlEntity(text, 'https://example.com/a')] }),
    );
    expect(capture.note).toBe('First line\n\nSecond line');
  });

  it('leaves a link it cannot use (not http or https) in the note', () => {
    const text = 'see tg://resolve?domain=x';
    const capture = extractCapture(
      message({ text, entities: [urlEntity(text, 'tg://resolve?domain=x')] }),
    );
    expect(capture.links).toEqual([]);
    expect(capture.note).toBe('see tg://resolve?domain=x');
  });

  it('returns no links for a note-only message (R-CAP-4)', () => {
    const capture = extractCapture(message({ text: 'Remember to check the AESIA report' }));
    expect(capture.links).toEqual([]);
    expect(capture.note).toBe('Remember to check the AESIA report');
  });

  it('handles a message with neither text nor caption', () => {
    expect(extractCapture(message({}))).toEqual({ links: [], note: '', rawText: '' });
  });
});

describe('parseCommand (R-CAP-8)', () => {
  const command = (text: string) =>
    parseCommand(
      message({
        text,
        entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0]?.length ?? 0 }],
      }),
    );

  it('reads the command and its arguments', () => {
    expect(command('/discard 42 duplicate of #40')).toEqual({
      name: 'discard',
      args: '42 duplicate of #40',
    });
    expect(command('/pending')).toEqual({ name: 'pending', args: '' });
  });

  it("drops the bot's name after @ and lowercases the command", () => {
    expect(command('/Note@NewsroomBot 42 more context')).toEqual({
      name: 'note',
      args: '42 more context',
    });
  });

  it('is null when the message does not start with a bot command', () => {
    expect(parseCommand(message({ text: 'not /a command' }))).toBeNull();
    expect(parseCommand(message({ text: '/looks like one but has no entity' }))).toBeNull();
  });
});
