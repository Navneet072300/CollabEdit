const PALETTE = [
  "#22d3ee", // cyan
  "#a78bfa", // violet
  "#34d399", // emerald
  "#f472b6", // pink
  "#fb923c", // orange
  "#facc15", // yellow
  "#60a5fa", // blue
  "#f87171", // red
];

/** Deterministic color from user ID — same user always gets same color. */
export function userColor(userId: string): string {
  const h = [...userId].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTE[h % PALETTE.length];
}

/** Convert a hex color to rgba with given alpha. */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
