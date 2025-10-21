const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'electron');
const dest = path.join(__dirname, '..', 'build', 'electron');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest);
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  copyRecursiveSync(src, dest);
  console.log('Electron folder copied to build/electron');
} catch (err) {
  console.error('Failed to copy electron folder:', err);
  process.exit(1);
}
