import type { Metadata } from 'next';

import { SearchView } from '@/views/search';
import { searchMetadata, type SearchProps } from '@/views/search-route';

export const generateMetadata = (props: SearchProps): Promise<Metadata> =>
  searchMetadata('search', props);

const SearchPage = (props: SearchProps) => <SearchView word="search" {...props} />;

export default SearchPage;
