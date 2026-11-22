/**
 * Syncs real GitHub data into public/data/github.json.
 *
 *   GITHUB_TOKEN=... npm run sync        # GraphQL (what the workflow does)
 *   npm run sync                         # no token: public calendar page + public REST API
 *
 * Options (env): AETHER_GITHUB_USER (defaults to src/content/site.ts), AETHER_YEARS (default 3),
 *                AETHER_STRICT=1 to fail the run instead of keeping the previous data.
 *
 * Safe by design: the token is only ever read from the environment, is never written to disk,
 * and the output contains public information only. If GitHub cannot be reached the previous
 * snapshot is kept untouched, so a flaky API never wipes the archive.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { site } from '../src/content/site';
import { validateSnapshot, type Snapshot } from '../src/lib/archive';
import { fetchViaGraphql, fetchViaPublic } from './lib/github';

const OUT = resolve(process.cwd(), 'public/data/github.json');

function comparable(s: Snapshot) {
  return JSON.stringify({ ...s, generatedAt: '' });
}

async function readExisting(): Promise<Snapshot | null> {
  try {
    return validateSnapshot(JSON.parse(await readFile(OUT, 'utf8')));
  } catch {
    return null;
  }
}

async function main() {
  const login = process.env.AETHER_GITHUB_USER || site.githubUsername;
  const years = Math.max(0, Math.min(10, Number(process.env.AETHER_YEARS ?? 3)));
  const strict = process.env.AETHER_STRICT === '1';
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

  let snapshot: Snapshot | null = null;
  const errors: string[] = [];
  if (token) {
    try {
      snapshot = await fetchViaGraphql(login, token, years);
    } catch (e) {
      errors.push(`GraphQL: ${(e as Error).message}`);
    }
  }
  if (!snapshot) {
    try {
      snapshot = await fetchViaPublic(login, years);
    } catch (e) {
      errors.push(`Public page: ${(e as Error).message}`);
    }
  }

  if (!snapshot) {
    console.error(`[aether] Could not reach GitHub for "${login}":\n  ${errors.join('\n  ')}`);
    const existing = await readExisting();
    console.error(existing ? '[aether] Keeping the previous snapshot unchanged.' : '[aether] No previous snapshot; the site shows its offline state.');
    process.exit(strict ? 1 : 0);
  }
  if (errors.length) console.warn(`[aether] Used fallback after: ${errors.join('; ')}`);

  const existing = await readExisting();
  if (existing && comparable(existing) === comparable(snapshot)) {
    console.log('[aether] GitHub data unchanged; nothing to write.');
    return;
  }
  await mkdir(dirname(OUT), { recursive: true });
  const tmp = `${OUT}.tmp`;
  await writeFile(tmp, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  await rename(tmp, OUT);
  const c = snapshot.calendars[0];
  console.log(
    `[aether] Synced @${snapshot.username} via ${snapshot.source}: ${snapshot.calendars.length} calendar(s)` +
      (c ? `, ${c.total} contributions from ${c.from} to ${c.to}` : '') +
      `, ${snapshot.repositories.length} public repositories.`,
  );
}

main().catch((e) => {
  console.error('[aether] Sync failed:', e);
  process.exit(1);
});
