const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const destDir = path.join(__dirname, '..', 'dist');

const isWatch = process.argv.includes('--watch');

function copyStaticOnce() {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    if (/\.(html|css|png|jpg|jpeg|gif|svg|ico)$/i.test(entry.name)) {
      fs.copyFileSync(path.join(srcDir, entry.name), path.join(destDir, entry.name));
    }
  }
}

copyStaticOnce();

if (isWatch) {
  fs.watch(srcDir, { recursive: false }, () => copyStaticOnce());
}



