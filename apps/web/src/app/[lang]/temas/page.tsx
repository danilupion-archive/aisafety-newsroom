import type { Metadata } from 'next';

import { TopicsView } from '@/views/topics';
import { topicsMetadata, type TopicsProps } from '@/views/topics-route';

export const generateMetadata = (props: TopicsProps): Promise<Metadata> =>
  topicsMetadata('temas', props);

const TopicsPage = (props: TopicsProps) => <TopicsView word="temas" {...props} />;

export default TopicsPage;
