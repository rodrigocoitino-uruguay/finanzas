// Genera los íconos y las pantallas de carga de iOS a partir de un SVG.
// Uso (una sola vez, no forma parte del build):
//   npm i --no-save sharp && node scripts/generate-icons.mjs
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const BG = '#0A0A0A';
const INCOME = '#34D399';
const EXPENSE = '#4F8CFF';

/** Anillo con dos arcos (ingresos y gastos), centrado en un lienzo de `size`. */
function ring(size, radius, stroke) {
  const c = size / 2;
  const pt = (a) => [c + radius * Math.sin(a), c - radius * Math.cos(a)];
  const arc = (a0, a1, color) => {
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `<path d="M${x0.toFixed(2)} ${y0.toFixed(2)} A${radius} ${radius} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="butt"/>`;
  };
  const gap = 0.16;
  const split = Math.PI * 2 * 0.62;
  return arc(-Math.PI * 0.18 + gap / 2, -Math.PI * 0.18 + split - gap / 2, INCOME) + arc(-Math.PI * 0.18 + split + gap / 2, -Math.PI * 0.18 + Math.PI * 2 - gap / 2, EXPENSE);
}

function iconSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${BG}"/>${ring(size, size * 0.29, size * 0.085)}</svg>`;
}

function splashSvg(w, h, dpr) {
  const r = 46 * dpr;
  const ringSvg = ring(r * 2 + 40 * dpr, r, 15 * dpr);
  const box = r * 2 + 40 * dpr;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${BG}"/><g transform="translate(${(w - box) / 2} ${(h - box) / 2})">${ringSvg}</g></svg>`;
}

const out = new URL('../public/', import.meta.url);
const png = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL(file, out)));

await writeFile(new URL('icons/icon.svg', out), iconSvg(512));
await png(iconSvg(512), 'icons/icon-512.png');
await png(iconSvg(192), 'icons/icon-192.png');
await png(iconSvg(512), 'icons/icon-maskable-512.png');
await png(iconSvg(180), 'icons/apple-touch-icon.png');
await png(iconSvg(64), 'icons/favicon-64.png');

// Pantallas de carga (vertical) de los iPhone: [ancho CSS, alto CSS, densidad]
export const SPLASH = [
  [440, 956, 3],
  [402, 874, 3],
  [420, 912, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [375, 667, 2],
  [320, 568, 2],
];
for (const [w, h, dpr] of SPLASH) {
  await png(splashSvg(w * dpr, h * dpr, dpr), `splash/splash-${w * dpr}x${h * dpr}.png`);
}
console.log('Íconos y pantallas de carga generados.');
