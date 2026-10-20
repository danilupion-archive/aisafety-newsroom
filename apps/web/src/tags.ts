import type { Lang } from './i18n';

/**
 * Each language's names for the watchlist's tags (aisafety-media news/watchlist.md), which are English slugs. A tag
 * without a name here shows as it is. Interface wording, for Dani to review.
 */
const TAG_LABELS: Record<Lang, Record<string, string>> = {
  es: {
    'loss-of-control': 'pérdida de control',
    misuse: 'uso malicioso',
    'open-weights': 'pesos abiertos',
    'power-concentration': 'concentración de poder',
    disempowerment: 'desempoderamiento gradual',
    jobs: 'empleo',
    race: 'carrera de la IA',
    capabilities: 'capacidades',
    'self-improvement': 'automejora recursiva',
    evals: 'evaluaciones',
    incidents: 'incidentes',
    labs: 'empresas de IA',
    'eu-regulation': 'regulación europea',
    spain: 'España',
    latam: 'Latinoamérica',
    us: 'Estados Unidos',
    international: 'internacional',
    'public-opinion': 'opinión pública',
    pauseai: 'PauseAI',
  },
  en: {
    'loss-of-control': 'loss of control',
    misuse: 'misuse',
    'open-weights': 'open weights',
    'power-concentration': 'concentration of power',
    disempowerment: 'gradual disempowerment',
    jobs: 'jobs',
    race: 'the AI race',
    capabilities: 'capabilities',
    'self-improvement': 'recursive self-improvement',
    evals: 'evaluations',
    incidents: 'incidents',
    labs: 'AI companies',
    'eu-regulation': 'EU regulation',
    spain: 'Spain',
    latam: 'Latin America',
    us: 'United States',
    international: 'international',
    'public-opinion': 'public opinion',
    pauseai: 'PauseAI',
  },
};

export const tagLabel = (lang: Lang, tag: string): string => TAG_LABELS[lang][tag] ?? tag;

/** Every tag with a name in both languages: the test keeps the two lists equal. */
export const namedTags = (lang: Lang): string[] => Object.keys(TAG_LABELS[lang]);

/** A tag's or a slug's shape: the same the API takes. */
export const TAG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A post's slug as the API takes it: that shape, at most 120 characters. Anything else is no post. */
export const isSlug = (value: string): boolean => TAG.test(value) && value.length <= 120;
