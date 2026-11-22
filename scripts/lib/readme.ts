import type { Repo, Snapshot } from '../../src/lib/archive';
import { esc } from './archive-svg';

export const START = '<!-- AETHER:PROJECTS:START -->';
export const END = '<!-- AETHER:PROJECTS:END -->';

function pick(repos: Repo[], featured: readonly string[]): Repo[] {
  const byName = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
  const out: Repo[] = [];
  const add = (r?: Repo) => r && !out.includes(r) && out.push(r);
  featured.forEach((f) => add(byName.get(f.toLowerCase())));
  if (!featured.length) {
    repos.filter((r) => r.pinned).forEach(add);
    [...repos].sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? '')).forEach(add);
  }
  return out.slice(0, 6);
}

/** Markdown for the generated "Selected launches" block. Uses only real repository data. */
export function projectsBlock(snapshot: Snapshot | null, featured: readonly string[] = []): string {
  // The profile repository (<user>/<user>) is this README itself, so it is not listed.
  const repos = snapshot ? pick(snapshot.repositories.filter((r) => r.name.toLowerCase() !== snapshot.username.toLowerCase()), featured) : [];
  if (!repos.length) {
    return `${START}\n_Projects sync here automatically from public repositories after the first workflow run._\n${END}`;
  }
  const rows = repos.map((r, i) => {
    const desc = esc(r.description ?? '').replace(/\|/g, '\\|') || '—';
    const live = r.homepage && /^https?:\/\//.test(r.homepage) ? ` · <a href="${esc(r.homepage)}">live</a>` : '';
    const lang = r.language ? esc(r.language) : '—';
    return `| \`W-${String(i + 1).padStart(2, '0')}\` | <a href="${esc(r.url)}"><b>${esc(r.name)}</b></a>${live} | ${desc} | ${lang} |`;
  });
  return [START, '| | Launch | Mission | Stack |', '|:--|:--|:--|:--|', ...rows, END].join('\n');
}

export function replaceBlock(readme: string, block: string): string {
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a === -1 || b === -1 || b < a) throw new Error('README is missing the AETHER:PROJECTS markers');
  return readme.slice(0, a) + block + readme.slice(b + END.length);
}
