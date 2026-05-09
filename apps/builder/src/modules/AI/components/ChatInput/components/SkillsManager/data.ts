import type { AiSkill } from '@pmodules/AI/types';

const DEFAULT_SKILLS: AiSkill[] = [
  {
    id: 'design-review',
    name: 'Design Review',
    slash: 'review',
    source: 'builtin',
    cat: 'design',
    desc: 'Audits the current page against UX heuristics — contrast, hierarchy, hit targets, spacing consistency.',
    enabled: true,
    runs: 248,
    avg: '8s',
    lastUsed: '2h'
  },
  {
    id: 'a11y',
    name: 'Accessibility Check',
    slash: 'a11y',
    source: 'builtin',
    cat: 'design',
    desc: 'Scans the component tree and reports WCAG AA/AAA violations with a suggested fix per node.',
    enabled: true,
    runs: 142,
    avg: '4s',
    lastUsed: '1d'
  },
  {
    id: 'copy-rewrite',
    name: 'Copy Rewriter',
    slash: 'rewrite',
    source: 'builtin',
    cat: 'content',
    desc: 'Rewrites copy in 3 tones (concise, punchy, premium) with A/B variants ready to test.',
    enabled: true,
    runs: 89,
    avg: '3s',
    lastUsed: '15m'
  },
  {
    id: 'seo-meta',
    name: 'SEO Meta Generator',
    slash: 'seo',
    source: 'builtin',
    cat: 'content',
    desc: 'Generates title, description, OG tags and schema.org JSON-LD optimized for your page.',
    enabled: false,
    runs: 67,
    avg: '5s',
    lastUsed: '3d'
  },
  {
    id: 'component-audit',
    name: 'Component Audit',
    slash: 'audit',
    source: 'builtin',
    cat: 'performance',
    desc: 'Analyzes the component tree for unused props, redundant wrappers and re-render hotspots.',
    enabled: false,
    runs: 31,
    avg: '6s',
    lastUsed: '5d'
  },
  {
    id: 'data-bind',
    name: 'Data Binding',
    slash: 'bind',
    source: 'builtin',
    cat: 'data',
    desc: 'Connects components to your data sources with filters, sorting and live refresh.',
    enabled: false,
    runs: 56,
    avg: '11s',
    lastUsed: '2d'
  },
  {
    id: 'figma-import',
    name: 'Figma Import',
    slash: 'figma',
    source: 'team',
    cat: 'integrations',
    desc: 'Paste a Figma link and translate frames to components with correct design tokens.',
    enabled: true,
    runs: 412,
    avg: '14s',
    lastUsed: '4h'
  },
  {
    id: 'lighthouse',
    name: 'Lighthouse Audit',
    slash: 'lh',
    source: 'builtin',
    cat: 'performance',
    desc: 'Runs Lighthouse against the current URL and summarizes actionable items across Performance, A11y, SEO.',
    enabled: false,
    runs: 31,
    avg: '18s',
    lastUsed: '5d'
  }
];

export default DEFAULT_SKILLS;
