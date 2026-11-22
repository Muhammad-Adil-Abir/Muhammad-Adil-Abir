import { useMemo } from 'react';
import { site } from '../content/site';
import { useGithub } from '../lib/useGithub';
import type { Repo } from '../lib/archive';
import { ChapterHead } from './ChapterHead';
import { Reveal } from './Reveal';

/** CHAPTER 02 — Manifesto and principles. */
export function Manifesto() {
  return (
    <section id="manifesto" className="chapter manifesto" aria-labelledby="manifesto-title" tabIndex={-1}>
      <div className="wrap">
        <ChapterHead index="CH.02" name="Manifesto" id="manifesto-title">
          Curiosity, <em>engineered.</em>
        </ChapterHead>
        <div className="manifesto__grid">
          <Reveal as="p" className="manifesto__lead">
            {site.manifesto.lead}
          </Reveal>
          <div className="manifesto__body">
            {site.manifesto.body.map((p, i) => (
              <Reveal as="p" key={i} index={i + 1}>
                {p}
              </Reveal>
            ))}
          </div>
        </div>
        <ol className="principles" aria-label="Engineering principles">
          {site.principles.map((p, i) => (
            <Reveal as="li" key={p.title} index={i} className="principle">
              <span className="label">P-0{i + 1}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** CHAPTER 03 — Disciplines and selected work. */
export function Work() {
  const { status, snapshot } = useGithub();
  const repos = useMemo(() => pickRepos(snapshot?.repositories ?? [], snapshot?.username ?? site.githubUsername), [snapshot]);
  return (
    <section id="work" className="chapter work" aria-labelledby="work-title">
      <div className="wrap">
        <ChapterHead index="CH.03" name="Exploration" id="work-title">
          Disciplines <em>&amp;</em> launches.
        </ChapterHead>
        <ul className="disciplines">
          {site.disciplines.map((d, i) => (
            <Reveal as="li" key={d.code} index={i} className="discipline">
              <span className="label label--cobalt">{d.code}</span>
              <h3>{d.title}</h3>
              <p>{d.text}</p>
            </Reveal>
          ))}
        </ul>

        <div className="work__head">
          <h3 className="label">Selected work · synced from GitHub</h3>
          <a className="btn btn--ghost" href={`https://github.com/${site.githubUsername}?tab=repositories`}>
            All repositories ↗
          </a>
        </div>
        {status === 'loading' && <div className="work__loading" aria-busy="true" aria-label="Loading projects" />}
        {status !== 'loading' && repos.length === 0 && (
          <div className="work__empty" role="status">
            <p className="label label--cobalt">Manifest syncing</p>
            <p>
              Projects appear here automatically from public repositories after the first GitHub sync — pinned repositories first.
            </p>
          </div>
        )}
        {repos.length > 0 && (
          <ol className="projects">
            {repos.map((r, i) => (
              <Reveal as="li" key={r.name} index={i} className="project">
                <span className="project__index label">W-{String(i + 1).padStart(2, '0')}</span>
                <div className="project__main">
                  <h4 className="project__name">
                    <a href={r.url}>{r.name.replace(/[-_]/g, ' ')}</a>
                  </h4>
                  <p className="project__desc">{r.description ?? 'No description yet.'}</p>
                  {r.topics.length > 0 && (
                    <ul className="project__topics" aria-label="Topics">
                      {r.topics.slice(0, 5).map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <dl className="project__meta">
                  {r.language && (
                    <div>
                      <dt className="visually-hidden">Language</dt>
                      <dd>
                        <span className="project__dot" style={{ background: r.languageColor ?? 'var(--cobalt)' }} aria-hidden="true" />
                        {r.language}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="visually-hidden">Stars</dt>
                    <dd>★ {r.stars}</dd>
                  </div>
                  {r.pushedAt && (
                    <div>
                      <dt className="visually-hidden">Last push</dt>
                      <dd>{new Date(r.pushedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</dd>
                    </div>
                  )}
                </dl>
                <div className="project__links">
                  <a className="btn" href={r.url} aria-label={`${r.name} repository on GitHub`}>
                    Repository ↗
                  </a>
                  {r.homepage && (
                    <a className="btn btn--primary" href={r.homepage} aria-label={`${r.name} live site`}>
                      Live ↗
                    </a>
                  )}
                </div>
              </Reveal>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/** Featured (if configured) → pinned → most recently pushed. Six at most. */
export function pickRepos(input: Repo[], owner: string): Repo[] {
  // The <owner>/<owner> repository hosts this portfolio itself, so it is not listed as a project.
  const all = input.filter((r) => r.name.toLowerCase() !== owner.toLowerCase());
  const byName = new Map(all.map((r) => [r.name.toLowerCase(), r]));
  const chosen: Repo[] = [];
  const add = (r: Repo | undefined) => {
    if (r && !chosen.includes(r)) chosen.push(r);
  };
  site.featuredRepos.forEach((n) => add(byName.get(n.toLowerCase())));
  if (site.featuredRepos.length === 0) {
    all.filter((r) => r.pinned).forEach(add);
    [...all].sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? '')).forEach(add);
  }
  return chosen.slice(0, 6);
}

/** CHAPTER 05 — Transmission (contact). */
export function Transmission() {
  return (
    <section id="contact" className="chapter transmission" aria-labelledby="contact-title">
      <div className="wrap">
        <ChapterHead index="CH.05" name="Transmission" id="contact-title">
          Open a <em>channel.</em>
        </ChapterHead>
        <div className="transmission__grid">
          <Reveal as="p" className="transmission__text">
            Collaboration, questions, or an idea worth launching — the channel is open.
          </Reveal>
          <ul className="channels">
            {site.contact.map((c, i) => (
              <Reveal as="li" key={c.href} index={i}>
                <a className="channel" href={c.href}>
                  <span className="label">{c.label}</span>
                  <span className="channel__handle">{c.handle}</span>
                  <span className="channel__arrow" aria-hidden="true">
                    ↗
                  </span>
                </a>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
