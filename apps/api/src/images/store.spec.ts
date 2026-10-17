import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createImageStore, type ImageStore } from './store.js';

const SHA = 'a'.repeat(64);

describe('the image store (D22)', () => {
  let dir: string;
  let store: ImageStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'newsroom-images-'));
    store = createImageStore(dir);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('keeps an image’s two sizes under its SHA-256, and reads back what it wrote', async () => {
    await store.write(SHA, 'full', Buffer.from('full bytes'));
    await store.write(SHA, 'thumb', Buffer.from('thumb bytes'));
    expect((await store.read(SHA, 'full'))?.toString()).toBe('full bytes');
    expect((await store.read(SHA, 'thumb'))?.toString()).toBe('thumb bytes');
    expect((await readdir(dir)).sort()).toEqual([`${SHA}.thumb.webp`, `${SHA}.webp`]);
  });

  it('answers undefined for an image it doesn’t hold', async () => {
    expect(await store.read(SHA, 'full')).toBeUndefined();
    expect(await store.has(SHA, 'thumb')).toBe(false);
  });

  it('writes through a temporary file renamed into place, leaving nothing else behind, and the same write twice is one file', async () => {
    await store.write(SHA, 'full', Buffer.from('once'));
    await store.write(SHA, 'full', Buffer.from('once'));
    await Promise.all([
      store.write(SHA, 'thumb', Buffer.from('racing')),
      store.write(SHA, 'thumb', Buffer.from('racing')),
    ]);
    expect((await readdir(dir)).sort()).toEqual([`${SHA}.thumb.webp`, `${SHA}.webp`]);
    expect(await store.has(SHA, 'full')).toBe(true);
  });

  it('touches the filesystem only for a real SHA-256: never a path someone wrote', async () => {
    for (const name of ['../etc/passwd', `${SHA}/../x`, 'A'.repeat(64), 'a'.repeat(63), '']) {
      await expect(store.write(name, 'full', Buffer.from('x'))).rejects.toThrow(/SHA-256/);
      await expect(store.read(name, 'full')).rejects.toThrow(/SHA-256/);
    }
    expect(await readdir(dir)).toEqual([]);
  });
});
