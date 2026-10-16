import type { Metadata } from 'next';

import { TagView } from '@/views/tag';
import { tagMetadata, type TagProps } from '@/views/tag-route';

export const generateMetadata = (props: TagProps): Promise<Metadata> => tagMetadata('tag', props);

const TagPage = (props: TagProps) => <TagView word="tag" {...props} />;

export default TagPage;
