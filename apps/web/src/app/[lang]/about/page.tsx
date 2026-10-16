import type { Metadata } from 'next';

import { AboutView } from '@/views/about';
import { aboutMetadata, type AboutProps } from '@/views/about-route';

export const generateMetadata = (props: AboutProps): Promise<Metadata> =>
  aboutMetadata('about', props);

const AboutPage = (props: AboutProps) => <AboutView word="about" {...props} />;

export default AboutPage;
