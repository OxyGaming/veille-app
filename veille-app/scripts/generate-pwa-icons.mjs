// Génère des icônes PWA carrées à partir d'un SVG inline.
// Usage : npm run pwa:icons
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "public", "icons");
mkdirSync(out, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1B2330"/>
      <stop offset="100%" stop-color="#2E5496"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <g fill="none" stroke="white" stroke-width="22" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="220" cy="220" r="100"/>
    <line x1="296" y1="296" x2="380" y2="380"/>
    <path d="M170 220 L210 260 L280 190" stroke="#5BA85B" stroke-width="26"/>
  </g>
</svg>`;

const SIZES = [
  { name: "icon-192.png", size: 192, mode: "any" },
  { name: "icon-512.png", size: 512, mode: "any" },
  { name: "icon-maskable-512.png", size: 512, mode: "maskable" },
];

writeFileSync(join(out, "icon.svg"), svg);
for (const s of SIZES) {
  const padded =
    s.mode === "maskable"
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="${s.size}" height="${s.size}" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="#1B2330"/>
          <g transform="translate(15 15) scale(0.7)">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>
        </svg>`
      : svg;
  await sharp(Buffer.from(padded))
    .resize(s.size, s.size)
    .png()
    .toFile(join(out, s.name));
  console.log("✔", s.name);
}
