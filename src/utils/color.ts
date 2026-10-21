// Dark or light text/icon color that stays readable on top of a #rrggbb background
export function readableOn(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return '#111111';
  const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16));
  // Perceived brightness (Rec. 601), 0..255
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 140 ? '#111111' : '#ffffff';
}
