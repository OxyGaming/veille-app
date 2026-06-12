// Génère les icônes PWA (PNG) à partir du SVG source `public/icons/icon.svg`.
// Inclut une version maskable avec safe-area (sprite réduit centré).
// Usage : npm run pwa:icons
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, "..", "public", "icons");
mkdirSync(ICONS_DIR, { recursive: true });

const svg = readFileSync(join(ICONS_DIR, "icon.svg"), "utf-8");

/**
 * Version maskable : le système OS rogne l'icône en cercle / squircle.
 * On enveloppe le SVG d'origine d'une couche fond pleine (carrée) et on
 * scale l'icône à 70 % pour rester dans la safe area de 80 % de diamètre.
 * Coins arrondis retirés (l'OS applique sa propre forme).
 */
function buildMaskable(srcSvg) {
  // Retire les coins arrondis (rx="96") du <rect> de fond pour que le
  // fond couvre la totalité du canvas — le masque OS s'occupe du clip.
  const flat = srcSvg.replace(/rx="\d+"/, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#1e0b4a"/>
  <g transform="translate(76.8 76.8) scale(0.7)">
    ${flat.replace(/^<\?xml[^?]+\?>\s*/, "").replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")}
  </g>
</svg>`;
}

const TARGETS = [
  { name: "icon-192.png", size: 192, source: svg },
  { name: "icon-512.png", size: 512, source: svg },
  { name: "icon-maskable-512.png", size: 512, source: buildMaskable(svg) },
  { name: "icon-180.png", size: 180, source: svg }, // apple-touch
  { name: "icon-32.png", size: 32, source: svg }, // favicon
];

for (const t of TARGETS) {
  await sharp(Buffer.from(t.source))
    .resize(t.size, t.size)
    .png()
    .toFile(join(ICONS_DIR, t.name));
  console.log("✔", t.name);
}
