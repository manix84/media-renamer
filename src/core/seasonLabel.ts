export function formatSeasonLabel(name: string | undefined, number: number): string {
  const fallback = number === 0 ? 'Specials' : `Season ${number}`;
  const trimmed = name?.trim();
  if (!trimmed) return fallback;

  const genericName = number === 0
    ? /^specials?$/i.test(trimmed)
    : new RegExp(`^season\\s*0*${number}$`, 'i').test(trimmed);
  return genericName ? fallback : `${trimmed} (S${String(number).padStart(2, '0')})`;
}
