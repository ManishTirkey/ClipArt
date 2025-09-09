// Generate PNG and ICO from src/icon.svg
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

async function main() {
  const svgPath = path.join(__dirname, '..', 'src', 'icon.svg');
  const outPng = path.join(__dirname, '..', 'src', 'icon.png');
  const outIco = path.join(__dirname, '..', 'src', 'icon.ico');
  if (!fs.existsSync(svgPath)) {
    console.error('[icons] Missing src/icon.svg');
    process.exit(1);
  }
  const svgBuf = fs.readFileSync(svgPath);
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];
  for (const size of sizes) {
    const buf = await sharp(svgBuf, { density: 384 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    pngBuffers.push(buf);
    if (size === 256) {
      fs.writeFileSync(outPng, buf);
    }
  }
  const icoBuf = await toIco(pngBuffers);
  fs.writeFileSync(outIco, icoBuf);
  console.log(`[icons] Wrote ${outPng} and ${outIco}`);
}

main().catch(err => {
  console.error('[icons] Failed:', err);
  process.exit(1);
});


