/**
 * GitHub data access for the build pipeline (runs in GitHub Actions or locally — never in the browser).
 *
 * Primary: the GraphQL API with the workflow's built-in GITHUB_TOKEN (no extra secret needed).
 * Fallback: GitHub's public contribution calendar page + the public REST API, used when no token
 * is available (e.g. a local run). Both return exactly what GitHub reports; nothing is estimated.
 */
import { levelFromGraphql, sortDays, toDateString, type Calendar, type Day, type Level, type Repo, type Snapshot } from '../../src/lib/archive';

const UA = 'project-aether-sync (+https://github.com/Muhammad-Adil-Abir)';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** fetch with timeout and bounded retries on network errors, 5xx and 429. */
export async function request(url: string, init: RequestInit = {}, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) throw new HttpError(res.status, `${res.status} ${res.statusText} for ${url}`);
      lastError = new HttpError(res.status, `${res.status} ${res.statusText} for ${url}`);
    } catch (e) {
      if (e instanceof HttpError && e.status !== 429 && e.status < 500) throw e;
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 800 * 2 ** i));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// ---------------------------------------------------------------- GraphQL

interface GqlDay {
  date: string;
  contributionCount: number;
  contributionLevel: string;
}

interface GqlRepo {
  name: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  stargazerCount: number;
  forkCount: number;
  isFork: boolean;
  isArchived: boolean;
  isPrivate: boolean;
  pushedAt: string | null;
  primaryLanguage: { name: string; color: string | null } | null;
  repositoryTopics: { nodes: { topic: { name: string } }[] };
}

async function gql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await request('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join('; ')}`);
  if (!json.data) throw new Error('GraphQL: empty response');
  return json.data;
}

const CALENDAR_FIELDS = `
  contributionCalendar {
    totalContributions
    weeks { contributionDays { date contributionCount contributionLevel } }
  }`;

const REPO_FIELDS = `
  name description url homepageUrl stargazerCount forkCount isFork isArchived isPrivate pushedAt
  primaryLanguage { name color }
  repositoryTopics(first: 6) { nodes { topic { name } } }`;

function gqlDays(weeks: { contributionDays: GqlDay[] }[]): Day[] {
  return sortDays(
    weeks.flatMap((w) =>
      w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: levelFromGraphql(d.contributionLevel) })),
    ),
  );
}

function toRepo(r: GqlRepo, pinned: boolean): Repo {
  return {
    name: r.name,
    description: r.description,
    url: r.url,
    homepage: r.homepageUrl || null,
    language: r.primaryLanguage?.name ?? null,
    languageColor: r.primaryLanguage?.color ?? null,
    stars: r.stargazerCount,
    forks: r.forkCount,
    topics: r.repositoryTopics.nodes.map((n) => n.topic.name),
    pushedAt: r.pushedAt,
    pinned,
  };
}

export async function fetchViaGraphql(login: string, token: string, years: number): Promise<Snapshot> {
  type Base = {
    user: {
      login: string;
      name: string | null;
      url: string;
      contributionsCollection: { contributionYears: number[] } & { contributionCalendar: { weeks: { contributionDays: GqlDay[] }[] } };
      pinnedItems: { nodes: (GqlRepo | Record<string, never>)[] };
      repositories: { nodes: GqlRepo[] };
    } | null;
  };
  const base = await gql<Base>(
    token,
    `query($login: String!) {
      user(login: $login) {
        login name url
        contributionsCollection { contributionYears ${CALENDAR_FIELDS} }
        pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { ${REPO_FIELDS} } } }
        repositories(first: 40, privacy: PUBLIC, ownerAffiliations: OWNER, orderBy: { field: PUSHED_AT, direction: DESC }) {
          nodes { ${REPO_FIELDS} }
        }
      }
    }`,
    { login },
  );
  if (!base.user) throw new Error(`GitHub user "${login}" not found`);
  const u = base.user;

  const rolling = gqlDays(u.contributionsCollection.contributionCalendar.weeks);
  const calendars: Calendar[] = [calendarOf('last-year', 'Last 12 months', rolling)];

  const yearList = [...u.contributionsCollection.contributionYears].sort((a, b) => b - a).slice(0, years);
  for (const year of yearList) {
    const data = await gql<{ user: { contributionsCollection: { contributionCalendar: { weeks: { contributionDays: GqlDay[] }[] } } } }>(
      token,
      `query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) { contributionsCollection(from: $from, to: $to) { ${CALENDAR_FIELDS} } }
      }`,
      { login, from: `${year}-01-01T00:00:00Z`, to: `${year}-12-31T23:59:59Z` },
    );
    const days = gqlDays(data.user.contributionsCollection.contributionCalendar.weeks).filter((d) => d.date.startsWith(`${year}-`));
    if (days.length) calendars.push(calendarOf(String(year), String(year), days));
  }

  const pinned = u.pinnedItems.nodes.filter((n): n is GqlRepo => 'name' in n && !n.isPrivate);
  const pinnedNames = new Set(pinned.map((p) => p.name));
  const repositories = [
    ...pinned.map((r) => toRepo(r, true)),
    ...u.repositories.nodes.filter((r) => !r.isFork && !r.isArchived && !r.isPrivate && !pinnedNames.has(r.name)).map((r) => toRepo(r, false)),
  ];

  return {
    schema: 1,
    username: u.login,
    profileUrl: u.url,
    displayName: u.name,
    generatedAt: new Date().toISOString(),
    source: 'graphql',
    calendars,
    repositories,
  };
}

// ---------------------------------------------------------------- Public page fallback

/**
 * Parses GitHub's public contribution calendar HTML (https://github.com/users/<login>/contributions).
 * Each day is a <td data-date data-level id> whose count lives in a matching <tool-tip for="id">.
 * Older markup carried the count directly in data-count; both are supported.
 */
export function parseContributionsHtml(html: string): Day[] {
  const tips = new Map<string, string>();
  for (const m of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([\s\S]*?)<\/tool-tip>/g)) {
    tips.set(m[1]!, m[2]!.replace(/<[^>]+>/g, '').trim());
  }
  const days: Day[] = [];
  for (const m of html.matchAll(/<td\b([^>]*\bdata-date="\d{4}-\d{2}-\d{2}"[^>]*)>/g)) {
    const attrs = m[1]!;
    const attr = (name: string) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    const date = attr('data-date')!;
    const level = Number(attr('data-level') ?? '0');
    let count: number | null = null;
    const dataCount = attr('data-count');
    if (dataCount !== undefined) count = Number(dataCount);
    else {
      const id = attr('id');
      const tip = id ? tips.get(id) : undefined;
      if (tip !== undefined) {
        const t = tip.match(/^(No|[\d,]+)\s+contributions?\b/i);
        if (t) count = t[1]!.toLowerCase() === 'no' ? 0 : Number(t[1]!.replace(/,/g, ''));
      }
    }
    if (count === null || !Number.isFinite(count)) throw new Error(`Could not read the contribution count for ${date}`);
    days.push({ date, count, level: (Math.min(4, Math.max(0, level)) as Level) });
  }
  if (days.length === 0) throw new Error('No contribution days found in the calendar page');
  return sortDays(days);
}

interface RestUser {
  login: string;
  name: string | null;
  html_url: string;
  created_at: string;
}

interface RestRepo {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics?: string[];
  pushed_at: string | null;
  fork: boolean;
  archived: boolean;
  private: boolean;
}

export async function fetchViaPublic(login: string, years: number): Promise<Snapshot> {
  const page = async (q = '') => {
    const res = await request(`https://github.com/users/${encodeURIComponent(login)}/contributions${q}`, { headers: { Accept: 'text/html' } });
    return parseContributionsHtml(await res.text());
  };
  const rolling = await page();
  const calendars: Calendar[] = [calendarOf('last-year', 'Last 12 months', rolling)];

  let user: RestUser | null = null;
  let repositories: Repo[] = [];
  try {
    user = (await (await request(`https://api.github.com/users/${encodeURIComponent(login)}`, { headers: { Accept: 'application/vnd.github+json' } })).json()) as RestUser;
    const repos = (await (
      await request(`https://api.github.com/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed&per_page=100`, {
        headers: { Accept: 'application/vnd.github+json' },
      })
    ).json()) as RestRepo[];
    repositories = repos
      .filter((r) => !r.fork && !r.archived && !r.private)
      .slice(0, 40)
      .map((r) => ({
        name: r.name,
        description: r.description,
        url: r.html_url,
        homepage: r.homepage || null,
        language: r.language,
        languageColor: null,
        stars: r.stargazers_count,
        forks: r.forks_count,
        topics: r.topics ?? [],
        pushedAt: r.pushed_at,
        pinned: false,
      }));
  } catch (e) {
    console.warn(`[aether] public REST lookup failed, continuing with calendar only: ${(e as Error).message}`);
  }

  const firstYear = user ? new Date(user.created_at).getUTCFullYear() : new Date().getUTCFullYear();
  const thisYear = new Date().getUTCFullYear();
  for (let y = thisYear; y >= Math.max(firstYear, thisYear - years + 1); y--) {
    const days = (await page(`?from=${y}-01-01&to=${y}-12-31`)).filter((d) => d.date.startsWith(`${y}-`));
    if (days.length) calendars.push(calendarOf(String(y), String(y), days));
  }

  return {
    schema: 1,
    username: user?.login ?? login,
    profileUrl: user?.html_url ?? `https://github.com/${login}`,
    displayName: user?.name ?? null,
    generatedAt: new Date().toISOString(),
    source: 'public-page',
    calendars,
    repositories,
  };
}

export function calendarOf(id: string, label: string, days: Day[]): Calendar {
  const sorted = sortDays(days);
  // Never include days in the future (GitHub can pad the current week). The calendar follows the
  // profile's own time zone, which can be up to UTC+14, so "today" is measured from that edge.
  const latest = toDateString(Date.now() + 14 * 3_600_000);
  const real = sorted.filter((d) => d.date <= latest);
  return {
    id,
    label,
    from: real[0]?.date ?? '',
    to: real[real.length - 1]?.date ?? '',
    total: real.reduce((s, d) => s + d.count, 0),
    days: real,
  };
}
