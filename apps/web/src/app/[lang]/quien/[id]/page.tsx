import type { Metadata } from 'next';

import { EntityView } from '@/views/entity';
import { entityMetadata, type EntityProps } from '@/views/entity-route';

export const generateMetadata = (props: EntityProps): Promise<Metadata> =>
  entityMetadata('quien', props);

const EntityPage = (props: EntityProps) => <EntityView word="quien" {...props} />;

export default EntityPage;
