/**
 * Renders posters and preview animations from the REAL WebGL scenes.
 *
 *   npm run build && npx vite preview --port 4173 &      (or: npm run dev)
 *   npm run capture -- --all
 *
 * Flags:  --posters  still frames for reduced-motion / no-WebGL fallbacks + social image
 *         --arrival  README/site animation of the opening   --finale  of the ending
 *         --all      everything
 * Env:    AETHER_URL (default http://localhost:4173/), CHROME_PATH (default: Playwright's Chrome channel)
 *
 * Each frame is produced by seeking the sequence's own timeline (?capture=1), so output is
 * deterministic and independent of how fast the machine renders. Requires ffmpeg on PATH.
 */
import { chromium, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {} from '../src/lib/capture';

const URL_BASE = process.env.AETHER_URL ?? 'http://localhost:4173/';
const args = new Set(process.argv.slice(2));
const all = args.has('--all');
const WORK = resolve('.capture/frames');

async function open(width: number, height: number, query: string) {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`${URL_BASE}?capture=1&quality=high&${query}`, { waitUntil: 'networkidle' });
  return { browser, page };
}

async function ready(page: Page, target: 'arrival' | 'finale') {
  if (target === 'finale') await page.evaluate(() => document.getElementById('protocol')?.scrollIntoView());
  await page.waitForFunction((t) => !!window.__aether?.[t], target, { timeout: 90_000 });
  // Warm-up: compile every shader before the first frame that is kept.
  for (const t of [0, 4500, 9000, 0]) {
    await page.evaluate(([n, ms]) => window.__aether![n as string]!.seek(ms as number), [target, t]);
    await page.waitForTimeout(250);
  }
}

async function frame(page: Page, target: 'arrival' | 'finale', ms: number, path: string, type: 'png' | 'jpeg' = 'png') {
  await page.evaluate(([n, t]) => window.__aether![n as string]!.seek(t as number), [target, ms]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const el = page.locator(target === 'arrival' ? '#arrival' : '#protocol');
  await el.screenshot({ path, type, ...(type === 'jpeg' ? { quality: 88 } : {}) });
}

function ffmpeg(...a: string[]) {
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...a], { stdio: 'inherit' });
}

async function size(path: string) {
  return `${((await stat(path)).size / 1024).toFixed(0)} KB`;
}

async function posters() {
  await mkdir('public/media', { recursive: true });
  for (const [target, at, file] of [
    ['arrival', 9000, 'arrival-poster'],
    ['finale', 11400, 'finale-poster'],
  ] as const) {
    const { browser, page } = await open(1920, 1080, 'chrome=0&text=0');
    await ready(page, target);
    const png = resolve(WORK, `${file}.png`);
    await frame(page, target, at, png);
    await browser.close();
    ffmpeg('-i', png, '-c:v', 'libwebp', '-quality', '82', resolve('public/media', `${file}.webp`));
    console.log(`poster ${file}.webp ${await size(resolve('public/media', `${file}.webp`))}`);
  }
  // Social preview with the title, 1200×630.
  const { browser, page } = await open(1200, 630, 'chrome=0');
  await ready(page, 'arrival');
  await frame(page, 'arrival', 9000, resolve('public/media/og.jpg'), 'jpeg');
  await browser.close();
  console.log(`og.jpg ${await size('public/media/og.jpg')}`);
}

async function sequence(target: 'arrival' | 'finale', from: number, to: number, fps: number, name: string) {
  const dir = resolve(WORK, name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const { browser, page } = await open(960, 540, 'chrome=0');
  await ready(page, target);
  const count = Math.round(((to - from) / 1000) * fps);
  for (let i = 0; i <= count; i++) {
    await frame(page, target, from + (i * 1000) / fps, resolve(dir, `f${String(i).padStart(4, '0')}.png`));
    if (i % 20 === 0) console.log(`${name}: frame ${i}/${count}`);
  }
  await browser.close();
  const input = resolve(dir, 'f%04d.png');
  await mkdir('assets/readme', { recursive: true });
  await mkdir('public/media', { recursive: true });
  // MP4 for the website/social, animated WebP for the README (GitHub renders README images via <img>).
  ffmpeg('-framerate', String(fps), '-i', input, '-vf', 'crop=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve('public/media', `${name}.mp4`));
  ffmpeg('-framerate', String(fps), '-i', input, '-vf', 'scale=720:-1:flags=lanczos', '-c:v', 'libwebp_anim', '-quality', '62', '-loop', '0', resolve('assets/readme', `${name}.webp`));
  console.log(`${name}.mp4 ${await size(resolve('public/media', `${name}.mp4`))}, ${name}.webp ${await size(resolve('assets/readme', `${name}.webp`))}`);
}

async function main() {
  await mkdir(WORK, { recursive: true });
  if (all || args.has('--posters')) await posters();
  if (all || args.has('--arrival')) await sequence('arrival', 0, 9000, 18, 'arrival');
  if (all || args.has('--finale')) await sequence('finale', 300, 11400, 15, 'finale');
  if (args.size === 0) console.log('Nothing to do. Use --posters, --arrival, --finale or --all.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
