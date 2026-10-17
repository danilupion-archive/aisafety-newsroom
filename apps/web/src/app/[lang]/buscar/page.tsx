import type { Metadata } from 'next';

import { SearchView } from '@/views/search';
import { searchMetadata, type SearchProps } from '@/views/search-route';

export const generateMetadata = (props: SearchProps): Promise<Metadata> =>
  searchMetadata('buscar', props);

const SearchPage = (props: SearchProps) => <SearchView word="buscar" {...props} />;

export default SearchPage;
