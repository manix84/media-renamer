export type LogoShadow = 'none' | 'dark' | 'light';

function linearChannel(value: number): number {
  const channel = Math.max(0, Math.min(255, value)) / 255;
  return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
}

function relativeLuminance(red: number, green: number, blue: number): number {
  return .2126 * linearChannel(red) + .7152 * linearChannel(green) + .0722 * linearChannel(blue);
}

function contrastRatio(left: number, right: number): number {
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + .05) / (darker + .05);
}

export function logoShadowForPixels(pixels: Uint8ClampedArray, backgroundLuminance: number): LogoShadow {
  let visibleWeight = 0;
  let poorContrastWeight = 0;

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    if (alpha < .125) continue;
    visibleWeight += alpha;
    if (contrastRatio(relativeLuminance(pixels[index], pixels[index + 1], pixels[index + 2]), backgroundLuminance) < 2.5) poorContrastWeight += alpha;
  }

  if (!visibleWeight || poorContrastWeight / visibleWeight < .55) return 'none';
  return backgroundLuminance > .5 ? 'dark' : 'light';
}
