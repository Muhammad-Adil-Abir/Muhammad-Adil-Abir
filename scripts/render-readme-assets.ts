/**
 * Writes the README's Launch Archive images from public/data/github.json:
 *   assets/readme/launch-archive-dark.svg
 *   assets/readme/launch-archive-light.svg
 * With no data yet, both show an honest "awaiting first sync" panel.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateSnapshot } from '../src/lib/archive';
import { renderArchiveSvg } from './lib/archive-svg';

async function main() {
  let snapshot = null;
  try {
    snapshot = validateSnapshot(JSON.parse(await readFile(resolve('public/data/github.json'), 'utf8')));
  } catch {
    console.warn('[aether] No snapshot found; rendering the offline archive panel.');
  }
  const dir = resolve('assets/readme');
  await mkdir(dir, { recursive: true });
  for (const theme of ['dark', 'light'] as const) {
    const file = resolve(dir, `launch-archive-${theme}.svg`);
    await writeFile(file, renderArchiveSvg(snapshot, theme), 'utf8');
    console.log(`[aether] wrote ${file}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
