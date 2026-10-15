import Link from 'next/link';

import { pageTitle } from '@/styles';

const NotFound = () => (
  <>
    <h1 className={pageTitle}>No encontramos esta página</h1>
    <p>
      <Link href="/">Volver al inicio</Link>
    </p>
  </>
);

export default NotFound;
