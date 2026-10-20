import type { Metadata } from 'next';

import { EntitiesView } from '@/views/entities';
import { entitiesMetadata, type EntitiesProps } from '@/views/entities-route';

export const generateMetadata = (props: EntitiesProps): Promise<Metadata> =>
  entitiesMetadata('who', props);

const EntitiesPage = (props: EntitiesProps) => <EntitiesView word="who" {...props} />;

export default EntitiesPage;
