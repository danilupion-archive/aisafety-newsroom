import type { Metadata } from 'next';

import { renderMarkdown } from '@aisafety-newsroom/domain/markdown';
import { connection } from 'next/server';

import { getPost } from '@/api';
import { pageTitle, prose } from '@/styles';

export const metadata: Metadata = {
  title: 'Sobre este sitio',
  alternates: { canonical: '/sobre' },
};

/**
 * Who writes the site and why (R-WEB-3): the page `sobre`, pushed from aisafety-media like every text on the site, so
 * none of it is written here.
 */
const About = async () => {
  await connection();
  const page = await getPost('sobre');
  if (page === undefined || page === 'gone') {
    return (
      <>
        <h1 className={pageTitle}>Sobre este sitio</h1>
        <p>Esta página está en preparación.</p>
      </>
    );
  }
  return (
    <article>
      <h1 className={pageTitle}>{page.title}</h1>
      <div className={prose} dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body_md) }} />
    </article>
  );
};

export default About;
