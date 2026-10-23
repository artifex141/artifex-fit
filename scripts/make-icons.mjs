// Renders the app icon (yellow dumbbell on dark background) to PNG sizes used by the PWA manifest and iOS.
import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0B0D10"/>
  <g fill="#FFD60A">
    <rect x="96" y="176" width="44" height="160" rx="14"/>
    <rect x="372" y="176" width="44" height="160" rx="14"/>
    <rect x="56" y="206" width="36" height="100" rx="12"/>
    <rect x="420" y="206" width="36" height="100" rx="12"/>
    <rect x="140" y="238" width="232" height="36" rx="10"/>
  </g>
</svg>`;

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/${name}`);
  console.log('ok', name);
}
