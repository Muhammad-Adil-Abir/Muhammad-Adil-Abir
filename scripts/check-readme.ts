/**
 * README validation (runs in CI):
 *  - every local image/link target exists
 *  - generated-block markers are present exactly once
 *  - no scripts, iframes or styles GitHub would strip
 *  - HTML tags used in the README are balanced
 *  - every SVG asset is well-formed XML
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { XMLValidator } from 'fast-xml-parser';
import { START, END } from './lib/readme';

export async function checkReadme(root = process.cwd()): Promise<string[]> {
  const problems: string[] = [];
  const md = await readFile(resolve(root, 'README.md'), 'utf8');

  for (const marker of [START, END]) {
    const count = md.split(marker).length - 1;
    if (count !== 1) problems.push(`marker ${marker} appears ${count} times (expected 1)`);
  }
  if (/<script|<iframe|<style|javascript:/i.test(md)) problems.push('README contains markup GitHub strips (script/iframe/style/javascript:)');

  const refs = [
    ...[...md.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]!),
    ...[...md.matchAll(/\b(?:src|srcset|href)="([^"]+)"/g)].map((m) => m[1]!),
  ];
  for (const ref of refs) {
    if (/^(https?:|mailto:|#)/.test(ref)) continue;
    const path = ref.split('#')[0]!.split('?')[0]!;
    try {
      await stat(resolve(root, path));
    } catch {
      problems.push(`missing local file referenced by README: ${ref}`);
    }
  }

  for (const tag of ['picture', 'p', 'div', 'a', 'details', 'summary', 'table', 'sub', 'b']) {
    const open = (md.match(new RegExp(`<${tag}(\\s[^>]*)?>`, 'g')) ?? []).length;
    const close = (md.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;
    if (open !== close) problems.push(`unbalanced <${tag}>: ${open} opening vs ${close} closing`);
  }

  const dir = resolve(root, 'assets/readme');
  for (const f of await readdir(dir).catch(() => [] as string[])) {
    if (!f.endsWith('.svg')) continue;
    const xml = await readFile(join(dir, f), 'utf8');
    const v = XMLValidator.validate(xml);
    if (v !== true) problems.push(`${f} is not well-formed XML: ${v.err.msg} (line ${v.err.line})`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkReadme().then((p) => {
    if (p.length) {
      console.error(`README check failed:\n - ${p.join('\n - ')}`);
      process.exit(1);
    }
    console.log('README check passed.');
  });
}
