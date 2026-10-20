import { jsonLd } from '@/structured-data';

/** Structured data for search engines (R-WEB-21): data, never run, which the site's policy lets through. */
export const JsonLd = ({ data }: { data: object }) => (
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
);
