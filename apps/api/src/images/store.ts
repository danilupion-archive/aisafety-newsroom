import { randomUUID } from 'node:crypto';
import { access, constants, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** An image's name: the SHA-256 of the bytes uploaded, in lowercase hex. */
export const SHA256 = /^[0-9a-f]{64}$/;

export type ImageSize = 'full' | 'thumb';

/**
 * Where the images' WebP files live (D22): a folder on the API's volume, one file per size, named by the image's
 * SHA-256 (`<sha>.webp`, `<sha>.thumb.webp`). The database keeps what each image is and whether it may be shown; the
 * store only keeps bytes, which never change for a name, so writing one twice is harmless and two API replicas can
 * write the same file at once.
 */
export interface ImageStore {
  readonly dir: string;
  /** The file's bytes, or undefined if the store doesn't hold it. */
  read: (sha256: string, size: ImageSize) => Promise<Buffer | undefined>;
  /** Writes the file through a temporary one renamed into place, so a reader never sees half of it. */
  write: (sha256: string, size: ImageSize, bytes: Uint8Array) => Promise<void>;
  has: (sha256: string, size: ImageSize) => Promise<boolean>;
  /** Fails, naming the folder, unless the API can create and write files in it: checked once at start. */
  check: () => Promise<void>;
}

const fileName = (sha256: string, size: ImageSize): string => {
  // Before any path is built: a name is 64 lowercase hex characters, never a path someone wrote.
  if (!SHA256.test(sha256)) {
    throw new Error('An image file is named by a SHA-256 in lowercase hex');
  }
  return size === 'thumb' ? `${sha256}.thumb.webp` : `${sha256}.webp`;
};

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

export const createImageStore = (dir: string): ImageStore => {
  const path = (sha256: string, size: ImageSize) => join(dir, fileName(sha256, size));
  const has = async (sha256: string, size: ImageSize) => {
    try {
      await access(path(sha256, size));
      return true;
    } catch (error) {
      if (isMissing(error)) {
        return false;
      }
      throw error;
    }
  };
  return {
    dir,
    read: async (sha256, size) => {
      try {
        return await readFile(path(sha256, size));
      } catch (error) {
        if (isMissing(error)) {
          return undefined;
        }
        throw error;
      }
    },
    write: async (sha256, size, bytes) => {
      const target = path(sha256, size);
      if (await has(sha256, size)) {
        return;
      }
      const temporary = join(dir, `.${fileName(sha256, size)}.${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, bytes, { mode: 0o644 });
        await rename(temporary, target);
      } finally {
        await rm(temporary, { force: true });
      }
    },
    has,
    check: async () => {
      try {
        await mkdir(dir, { recursive: true });
        await access(dir, constants.W_OK);
      } catch {
        throw new Error(`IMAGES_DIR (${dir}) can't be written to: the API stores its images there`);
      }
    },
  };
};
