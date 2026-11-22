import { describe, expect, it } from 'vitest';
import { XMLValidator } from 'fast-xml-parser';
import { parseContributionsHtml, calendarOf } from '../scripts/lib/github';
import { renderArchiveSvg } from '../scripts/lib/archive-svg';
import { projectsBlock, replaceBlock, START, END } from '../scripts/lib/readme';
import { syntheticSnapshot } from './fixtures/synthetic';

// Mirrors the structure of GitHub's public calendar markup (td + tool-tip pairs).
const CALENDAR_HTML = `
<table class="ContributionCalendar-grid"><tbody>
<tr>
  <td tabindex="0" data-ix="0" aria-selected="false" style="width: 10px" data-date="2026-11-15" id="contribution-day-component-0-0" data-level="0" role="gridcell" class="ContributionCalendar-day"></td>
  <tool-tip id="tooltip-a" for="contribution-day-component-0-0" popover="manual" data-direction="n" data-type="label" class="sr-only position-absolute">No contributions on November 15th.</tool-tip>
  <td tabindex="-1" data-ix="1" data-date="2026-11-22" id="contribution-day-component-0-1" data-level="4" role="gridcell" class="ContributionCalendar-day"></td>
  <tool-tip id="tooltip-b" for="contribution-day-component-0-1" popover="manual" class="sr-only position-absolute">1,204 contributions on November 22nd.</tool-tip>
</tr>
<tr>
  <td data-date="2026-11-16" id="contribution-day-component-1-0" data-level="1" class="ContributionCalendar-day"></td>
  <tool-tip for="contribution-day-component-1-0">1 contribution on November 16th.</tool-tip>
</tr>
</tbody></table>`;

describe('public calendar parser', () => {
  it('reads date, exact count and level for every day', () => {
    expect(parseContributionsHtml(CALENDAR_HTML)).toEqual([
      { date: '2026-11-15', count: 0, level: 0 },
      { date: '2026-11-16', count: 1, level: 1 },
      { date: '2026-11-22', count: 1204, level: 4 },
    ]);
  });

  it('supports the older data-count markup', () => {
    const html = '<rect><td data-date="2020-01-01" data-count="7" data-level="3"></td></rect>';
    expect(parseContributionsHtml(html)).toEqual([{ date: '2020-01-01', count: 7, level: 3 }]);
  });

  it('fails loudly instead of guessing when a count is missing', () => {
    expect(() => parseContributionsHtml('<td data-date="2026-01-01" id="x" data-level="2"></td>')).toThrow(/2026-01-01/);
    expect(() => parseContributionsHtml('<html>rate limited</html>')).toThrow(/No contribution days/);
  });

  it('never keeps days beyond the latest possible "today"', () => {
    const c = calendarOf('x', 'X', [
      { date: '2026-01-01', count: 1, level: 1 },
      { date: '2999-01-01', count: 0, level: 0 },
    ]);
    expect(c.days).toHaveLength(1);
    expect(c.total).toBe(1);
  });
});

describe('README archive SVG', () => {
  it('is well-formed and reports the real totals', () => {
    const snap = syntheticSnapshot();
    const total = snap.calendars[0]!.total;
    for (const theme of ['dark', 'light'] as const) {
      const svg = renderArchiveSvg(snap, theme);
      expect(XMLValidator.validate(svg)).toBe(true);
      expect(svg).toContain(`${total.toLocaleString('en-US')} GitHub contributions`);
      expect(svg).toContain('prefers-reduced-motion');
      expect(svg).not.toMatch(/<script|onload=|href="javascript/i);
    }
  });

  it('draws one glyph per day', () => {
    const snap = syntheticSnapshot();
    const svg = renderArchiveSvg(snap, 'dark');
    const days = snap.calendars[0]!.days;
    const active = days.filter((x) => x.count > 0).length;
    expect((svg.match(/class="v"/g) ?? []).length).toBe(active);
  });

  it('renders an honest offline panel without data', () => {
    const svg = renderArchiveSvg(null, 'dark');
    expect(XMLValidator.validate(svg)).toBe(true);
    expect(svg).toContain('awaiting the first GitHub sync');
    expect(svg).not.toContain('class="v"');
  });

  it('escapes untrusted text', () => {
    const snap = syntheticSnapshot();
    snap.username = '<evil>&"';
    const svg = renderArchiveSvg(snap, 'dark');
    expect(XMLValidator.validate(svg)).toBe(true);
    expect(svg).toContain('&lt;evil&gt;&amp;&quot;');
  });
});

describe('README projects block', () => {
  const readme = `intro\n${START}\nold\n${END}\noutro`;

  it('lists real repositories with pinned first', () => {
    const block = projectsBlock(syntheticSnapshot());
    expect(block.indexOf('fixture-orbital-dashboard')).toBeLessThan(block.indexOf('fixture-agent-runner'));
    expect(block).toContain('<a href="https://example.com">live</a>');
    const next = replaceBlock(readme, block);
    expect(next.startsWith('intro\n')).toBe(true);
    expect(next.endsWith('\noutro')).toBe(true);
    expect(next.split(START)).toHaveLength(2);
  });

  it('is idempotent', () => {
    const block = projectsBlock(syntheticSnapshot());
    const once = replaceBlock(readme, block);
    expect(replaceBlock(once, block)).toBe(once);
  });

  it('says so plainly when there is no data', () => {
    expect(projectsBlock(null)).toContain('after the first workflow run');
  });

  it('refuses to write into a README without markers', () => {
    expect(() => replaceBlock('no markers', 'x')).toThrow(/markers/);
  });
});
