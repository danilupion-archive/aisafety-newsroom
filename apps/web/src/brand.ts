/**
 * The site's name as its wordmark shows it, next to the logo: a name that ends in IA (PandorIA) has that ending in the
 * aquamarine-to-pink gradient. Any other name, from whatever deployment configures it, stays whole.
 */
export const splitWordmark = (name: string): { lead: string; ia: string } =>
  name.length > 2 && name.endsWith('IA')
    ? { lead: name.slice(0, -2), ia: 'IA' }
    : { lead: name, ia: '' };
