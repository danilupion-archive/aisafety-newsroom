/**
 * Spanish names for the watchlist's tags (aisafety-media news/watchlist.md), which are English slugs: the interface is in
 * Spanish (R-WEB-4). A tag without a name here shows as it is. Interface wording, for Dani to review.
 */
const TAG_LABELS: Record<string, string> = {
  'loss-of-control': 'pérdida de control',
  misuse: 'uso malicioso',
  'open-weights': 'pesos abiertos',
  'power-concentration': 'concentración de poder',
  disempowerment: 'pérdida de influencia humana',
  jobs: 'empleo',
  race: 'carrera de la IA',
  capabilities: 'capacidades',
  evals: 'evaluaciones',
  incidents: 'incidentes',
  labs: 'laboratorios',
  'eu-regulation': 'regulación europea',
  spain: 'España',
  latam: 'Latinoamérica',
  us: 'Estados Unidos',
  international: 'internacional',
  'public-opinion': 'opinión pública',
  pauseai: 'PauseAI',
};

export const tagLabel = (tag: string): string => TAG_LABELS[tag] ?? tag;

/** A tag's address: the same shape the API takes. */
export const TAG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
