/** Refreshes the generated "Selected launches" block in README.md from the synced snapshot. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { site } from '../src/content/site';
import { validateSnapshot } from '../src/lib/archive';
import { projectsBlock, replaceBlock } from './lib/readme';

async function main() {
  const path = resolve('README.md');
  const readme = await readFile(path, 'utf8');
  let snapshot = null;
  try {
    snapshot = validateSnapshot(JSON.parse(await readFile(resolve('public/data/github.json'), 'utf8')));
  } catch {
    /* no data yet */
  }
  const next = replaceBlock(readme, projectsBlock(snapshot, site.featuredRepos));
  if (next !== readme) {
    await writeFile(path, next, 'utf8');
    console.log('[aether] README projects block updated.');
  } else {
    console.log('[aether] README already up to date.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
