import { createHash } from 'node:crypto';
import sharp from 'sharp';

/** The largest upload: a photo straight from a press kit fits. */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
/** Past this many pixels a file is refused before it's decoded: a small file can claim a huge image. */
const MAX_INPUT_PIXELS = 50_000_000;
/** The full image, for a post's page: wide enough for a sharp column on any screen. */
const FULL_MAX = 1600;
/** The thumbnail, for a timeline card and a source's preview, at twice their size on screen. */
const THUMB_MAX = 480;
/** What the database keeps of each (images_full_size, images_thumb_size). */
const FULL_MAX_BYTES = 2 * 1024 * 1024;
const THUMB_MAX_BYTES = 256 * 1024;
/** Raster formats only: never SVG (a document that can carry script), PDF or anything the site can't vouch for. */
const ACCEPTED = new Set(['jpeg', 'png', 'webp', 'gif']);

export interface ProcessedImage {
  width: number;
  height: number;
  full: Buffer;
  thumb: Buffer;
}

export type ImageRefusal = 'unsupported' | 'unreadable' | 'too-large';

/** The SHA-256 an image is named by: of the bytes aisafety-media sent, in lowercase hex. */
export const sha256Of = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

const encode = async (
  bytes: Buffer,
  max: number,
  quality: number,
): Promise<{ data: Buffer; width: number; height: number }> => {
  const { data, info } = await sharp(bytes, {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: 'error',
    // The first frame of an animation: the site shows stills.
    animated: false,
  })
    // Upright as the camera meant it, before the orientation tag goes with the rest of the metadata.
    .rotate()
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    // sharp keeps no metadata unless asked: no EXIF, no location, no colour profile (it converts to sRGB first).
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};

/**
 * The site's own copy of an uploaded image (R-WEB-15): a raster format checked from its header before anything is
 * decoded, then re-encoded as WebP in two sizes, without metadata. Undecodable, foreign or oversized input is refused,
 * never stored.
 */
export const processImage = async (bytes: Buffer): Promise<ProcessedImage | ImageRefusal> => {
  let format: string | undefined;
  let pixels: number;
  try {
    const metadata = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    format = metadata.format;
    pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
  } catch {
    return 'unreadable';
  }
  if (format === undefined || !ACCEPTED.has(format)) {
    return 'unsupported';
  }
  if (pixels === 0 || pixels > MAX_INPUT_PIXELS) {
    return 'too-large';
  }
  try {
    let full = await encode(bytes, FULL_MAX, 80);
    if (full.data.length > FULL_MAX_BYTES) {
      full = await encode(bytes, FULL_MAX, 55);
    }
    let thumb = await encode(bytes, THUMB_MAX, 75);
    if (thumb.data.length > THUMB_MAX_BYTES) {
      thumb = await encode(bytes, THUMB_MAX, 50);
    }
    if (full.data.length > FULL_MAX_BYTES || thumb.data.length > THUMB_MAX_BYTES) {
      return 'too-large';
    }
    return { width: full.width, height: full.height, full: full.data, thumb: thumb.data };
  } catch {
    return 'unreadable';
  }
};
