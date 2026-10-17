/**
 * StudyFlow design tokens.
 *
 * Centralises the visual language decisions already in use across the app
 * (brand colour, neutral surface palette, subject colours, radii, shadows,
 * motion, and typography) so they can be referenced consistently instead of
 * being re-invented per component. Tailwind remains the single styling system
 * — these tokens document and mirror the existing `tailwind.config.js`
 * values rather than introducing a competing design system.
 */

export const brand = {
  50: '#f0f7ff',
  100: '#e0efff',
  200: '#b9dcfc',
  300: '#7cc0f8',
  400: '#36a3f0',
  500: '#0c8ce9',
  600: '#006fc7',
  700: '#0057a1',
  800: '#054a83',
  900: '#0a3f6e',
  950: '#062847',
} as const;

export const neutral = {
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
  950: '#09090b',
} as const;

/** Semantic colour roles built on top of brand/neutral. */
export const semantic = {
  success: { bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-200 dark:border-green-900', text: 'text-green-800 dark:text-green-200' },
  error: { bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200 dark:border-red-900', text: 'text-red-800 dark:text-red-200' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-200 dark:border-amber-900', text: 'text-amber-800 dark:text-amber-200' },
  info: { bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-200 dark:border-blue-900', text: 'text-blue-800 dark:text-blue-200' },
} as const;

/** Surface colours. */
export const surface = {
  // App background
  body: { light: neutral[50], dark: neutral[950] },
  // Card / panel backgrounds
  card: { light: '#ffffff', dark: neutral[900] },
  // Elevated surfaces (modals, popovers)
  elevated: { light: '#ffffff', dark: neutral[900] },
  // Subtle secondary surfaces (headers, toolbars)
  secondary: { light: neutral[100], dark: neutral[800] },
  // Muted backgrounds (empty states, inactive chips)
  muted: { light: neutral[50], dark: neutral[800] },
} as const;

/** Border radii. */
export const radius = {
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
} as const;

/** Shadows. */
export const shadow = {
  subtle: '0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px 1px rgb(0 0 0 / 0.05)',
  card: '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
  elevated: '0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07)',
  modal: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
} as const;

/** Motion. Prefer reduced-motion: wrap any animation in
 *  `@media (prefers-reduced-motion: reduce) { animation: none; }`. */
export const motion = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  easeOut: 'ease-out',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

/** Typography scale (mirrors tailwind config). */
export const type = {
  '2xs': ['0.625rem', '0.875rem'],
  xs: ['0.75rem', '1rem'],
  sm: ['0.875rem', '1.25rem'],
  base: ['1rem', '1.5rem'],
  lg: ['1.125rem', '1.75rem'],
  xl: ['1.25rem', '1.75rem'],
  '2xl': ['1.5rem', '2rem'],
} as const;

/** Layout constants used by the timetable grid. */
export const grid = {
  /** Default pixels per hour on the time axis. */
  pixelsPerHour: 60,
  /** Default header (day-name strip) height. */
  headerHeight: 40,
  /** Default time-axis width. */
  timeAxisWidth: 60,
  /** Minimum session block height (30 minutes at 60px/hr). */
  minBlockHeight: 32,
  /** All-day strip height per day cell. */
  allDayStripHeight: 40,
} as const;

export const fontFamily = {
  sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
  mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
} as const;
