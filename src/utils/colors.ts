export const SUBJECT_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Sky', value: '#0ea5e9' },
] as const;

export function getRandomColor(exclude: string[] = []): string {
  const available = SUBJECT_COLORS.filter(c => !exclude.includes(c.value));
  if (available.length === 0) return SUBJECT_COLORS[0].value;
  return available[Math.floor(Math.random() * available.length)].value;
}

export function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#18181b' : '#fafafa';
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}