import type { Metadata } from 'next';

import { AboutView } from '@/views/about';
import { aboutMetadata, type AboutProps } from '@/views/about-route';

export const generateMetadata = (props: AboutProps): Promise<Metadata> =>
  aboutMetadata('sobre', props);

const AboutPage = (props: AboutProps) => <AboutView word="sobre" {...props} />;

export default AboutPage;
