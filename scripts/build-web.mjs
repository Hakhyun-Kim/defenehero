import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Ensure analytics config file exists before bundle
if (!fs.existsSync('src/analytics.config.js') && fs.existsSync('src/analytics.config.example.js')) {
  fs.copyFileSync('src/analytics.config.example.js', 'src/analytics.config.js');
}

console.log('Building game.js...');
execSync('npx esbuild src/main.js --bundle --outfile=dist/game.js --format=iife --minify-whitespace', { stdio: 'inherit' });

const wwwDir = path.resolve('www');
if (fs.existsSync(wwwDir)) {
  fs.rmSync(wwwDir, { recursive: true, force: true });
}
fs.mkdirSync(wwwDir, { recursive: true });

// Copy index.html
const html = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync(path.join(wwwDir, 'index.html'), html);

// Copy css folder
if (fs.existsSync('css')) {
  fs.cpSync('css', path.join(wwwDir, 'css'), { recursive: true });
}

// Copy dist folder
if (fs.existsSync('dist')) {
  fs.cpSync('dist', path.join(wwwDir, 'dist'), { recursive: true });
}

console.log('Successfully prepared www/ folder for Capacitor!');
