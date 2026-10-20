import type { Metadata } from 'next';

import { EntitiesView } from '@/views/entities';
import { entitiesMetadata, type EntitiesProps } from '@/views/entities-route';

export const generateMetadata = (props: EntitiesProps): Promise<Metadata> =>
  entitiesMetadata('quien', props);

const EntitiesPage = (props: EntitiesProps) => <EntitiesView word="quien" {...props} />;

export default EntitiesPage;
