import { createRequire } from "module";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");

function regularSvg(size) {
  const rx = Math.round(size * 0.2);
  const fontSize = Math.round(size * 0.6);
  const textY = Math.round(size * 0.72);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#16a34a"/>
  <text x="${size / 2}" y="${textY}" font-size="${fontSize}" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-weight="bold">RV</text>
</svg>`);
}

function maskableSvg(size) {
  const fontSize = Math.round(size * 0.42);
  const textY = Math.round(size * 0.62);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#16a34a"/>
  <text x="${size / 2}" y="${textY}" font-size="${fontSize}" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-weight="bold">RV</text>
</svg>`);
}

async function main() {
  for (const size of [192, 512]) {
    const out = join(iconsDir, `icon-${size}.png`);
    await sharp(regularSvg(size)).resize(size, size).png().toFile(out);
    console.log(`Created icon-${size}.png`);
  }

  const maskOut = join(iconsDir, "icon-512-maskable.png");
  await sharp(maskableSvg(512)).resize(512, 512).png().toFile(maskOut);
  console.log("Created icon-512-maskable.png");

  const appleOut = join(iconsDir, "apple-touch-icon.png");
  await sharp(regularSvg(180)).resize(180, 180).png().toFile(appleOut);
  console.log("Created apple-touch-icon.png");
}

main();
