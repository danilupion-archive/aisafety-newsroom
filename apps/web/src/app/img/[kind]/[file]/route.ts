import { IMAGE_CACHE, readImagePath } from '@/images';
import { site } from '@/site';

type Context = { params: Promise<{ kind: string; file: string }> };

/** Longer than an in-cluster read of an image ever takes. */
const TIMEOUT_MS = 5000;

const answer = (status: number, text: string) =>
  new Response(text, { status, headers: { 'cache-control': 'no-store' } });

/**
 * An image from the site's own host (R-WEB-15, R-WEB-16): read from the API inside the cluster, which serves it only
 * while a published post shows it and the switches allow it (R-CAP-10, R-CAP-11). Nothing about it is decided here.
 */
export const GET = async (_request: Request, { params }: Context): Promise<Response> => {
  const { kind, file } = await params;
  const image = readImagePath(kind, file);
  if (!image) {
    return answer(404, 'Not found');
  }
  let response: Response;
  try {
    response = await fetch(
      `${site().apiUrl}/public/images/${image.kind}/${image.sha256}?size=${image.size}`,
      { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
  } catch {
    return answer(502, 'Unavailable');
  }
  if (response.status === 404) {
    return answer(404, 'Not found');
  }
  if (!response.ok || response.body === null) {
    return answer(502, 'Unavailable');
  }
  return new Response(response.body, {
    headers: {
      'content-type': 'image/webp',
      'cache-control': IMAGE_CACHE,
      'x-content-type-options': 'nosniff',
    },
  });
};
