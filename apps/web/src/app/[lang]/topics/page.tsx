import type { Metadata } from 'next';

import { TopicsView } from '@/views/topics';
import { topicsMetadata, type TopicsProps } from '@/views/topics-route';

export const generateMetadata = (props: TopicsProps): Promise<Metadata> =>
  topicsMetadata('topics', props);

const TopicsPage = (props: TopicsProps) => <TopicsView word="topics" {...props} />;

export default TopicsPage;
