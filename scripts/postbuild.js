// Copies static admin assets from src/admin to dist/admin after TypeScript build.
// Uses Node's fs.cp for cross-platform copying.
const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src', 'admin');
const outDir = path.join(process.cwd(), 'dist', 'admin');

function copyDir(src, dest) {
  try {
    if (!fs.existsSync(src)) {
      console.log('[postbuild] No src/admin directory to copy. Skipping.');
      return;
    }

    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true, force: true });
    console.log(`[postbuild] Copied admin assets -> ${dest}`);
  } catch (err) {
    console.error('[postbuild] Failed to copy admin assets:', err.message);
    process.exitCode = 0; // don't fail the build if copy fails
  }
}

copyDir(srcDir, outDir);
