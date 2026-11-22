# PROJECT AETHER — Setup, deployment & maintenance

This repository is two things at once:

1. **Your GitHub profile README** (`README.md` at the root). GitHub shows it on `github.com/Muhammad-Adil-Abir` because the repository has the same name as your account.
2. **Your interactive portfolio** (`src/`), built with Vite and deployed to GitHub Pages at
   `https://muhammad-adil-abir.github.io/Muhammad-Adil-Abir/`.

A scheduled GitHub Action keeps both fed with **real** GitHub data. No paid services, no extra secrets.

---

## 1. What you need

| Tool | Why | Check |
|---|---|---|
| Node.js 20 or newer (22 recommended) | build and run the site | `node -v` |
| Git | push to GitHub | `git --version` |
| Google Chrome *(optional)* | end-to-end tests and re-rendering the preview videos | — |
| ffmpeg *(optional)* | encoding the preview videos | `ffmpeg -version` |

## 2. Project structure

```
.
├─ README.md                     ← your GitHub profile (hand-written + generated blocks)
├─ index.html                    ← site entry
├─ src/
│  ├─ content/site.ts            ← ALL personal text, links and settings — edit this
│  ├─ components/                ← React chapters: Arrival, Sections, LaunchArchive, FinalProtocol, Chrome (nav)
│  ├─ scenes/
│  │  ├─ core/                   ← renderer, post-processing, adaptive quality, studio lighting, GLSL noise
│  │  ├─ arrival/                ← the armored figure, smoke, dust, backlight, launch ignition, timeline cues
│  │  └─ finale/                 ← the mechanical hand, energy cores, pulse, timeline cues
│  ├─ lib/                       ← archive maths, timeline, settings, audio synth, storage, motion curves
│  └─ styles/                    ← design tokens + per-chapter CSS
├─ public/
│  ├─ data/github.json           ← GENERATED: real contribution calendar + public repositories
│  └─ media/                     ← GENERATED: posters, social image, preview MP4s
├─ assets/readme/                ← README images (Singularity banner + archive SVGs generated daily; preview WebPs rendered)
├─ scripts/                      ← sync-github, render-readme-assets, update-readme, check-readme, capture-previews
├─ tests/                        ← unit tests (Vitest)
├─ e2e/                          ← browser tests (Playwright)
├─ docs/                         ← this guide + the design language
└─ .github/workflows/            ← aether.yml (sync → build → deploy), ci.yml (checks for PRs)
```

## 3. Run it locally

```bash
npm install          # first time only (or `npm ci` for an exact install)
npm run dev          # http://localhost:5173
```

Useful URL flags while developing:

| Flag | Effect |
|---|---|
| `?motion=reduced` | the still, reduced-motion edition |
| `?quality=low` / `medium` / `high` | force a 3D quality tier |
| `?capture=1` | freezes the sequences for frame-by-frame capture (used by the capture script) |

To see the intro again, open a new tab or clear session storage (the site remembers it for the browsing session). The **Replay arrival** button also plays it on demand.

## 4. Build, test, verify

```bash
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ at http://localhost:4173
npm test             # unit tests
npm run verify       # typecheck + lint + unit tests + build + README check (what CI runs)

# browser tests (needs Google Chrome installed)
npm run build && npx playwright test
# if Chrome lives somewhere unusual:  CHROME_PATH=/path/to/chrome npx playwright test
```

## 5. Put it on GitHub

Your repository `Muhammad-Adil-Abir/Muhammad-Adil-Abir` **already exists**. Its current README will be replaced, so keep a copy first.

```bash
git clone https://github.com/Muhammad-Adil-Abir/Muhammad-Adil-Abir.git
cd Muhammad-Adil-Abir
git mv README.md README.previous.md          # keep your old README (delete later if you like)
git commit -m "Keep previous profile README"

# copy everything from this project folder into the clone (including .github/ and .gitignore),
# but NOT node_modules/, dist/ or .capture/
git add -A
git commit -m "PROJECT AETHER — cinematic profile and portfolio"
git push origin main
```

> If your default branch is called `master`, either rename it to `main` (Settings → Branches) or change `branches: [main]` in `.github/workflows/aether.yml`.

## 6. Turn on GitHub Pages (one time)

1. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Actions → General → Workflow permissions**: the workflow asks for exactly what it needs per job (`contents: write` for the data commit, `pages: write` + `id-token: write` for deploy). If the "Commit changes" step ever fails with *403*, choose **Read and write permissions** here.
3. Go to **Actions → "Aether — sync, build & deploy" → Run workflow** (or just push).

When it finishes, the deploy job shows your site URL. The profile README updates immediately; GitHub may cache README images for a few minutes.

**Secrets:** none required. The workflow uses the built-in, short-lived `GITHUB_TOKEN` to read your public contribution calendar through the GraphQL API. Nothing is ever exposed to the browser: the site only reads the static `data/github.json` file.

**Private contributions:** the archive matches what your public profile graph shows. To include private-repository activity as anonymous counts, enable *Settings (your account) → Public profile → Contributions & activity → Include private contributions on my profile*.

## 7. Update your profile

| To change… | Edit |
|---|---|
| Name, tagline, manifesto, principles, disciplines, final message | `src/content/site.ts` |
| Contact links (email, LinkedIn, …) | `contact` in `src/content/site.ts` |
| Which repositories are featured, and their order | `featuredRepos` in `src/content/site.ts` (default: pinned, then most recent) |
| A project's description, website link or topics | the repository's *About* panel on GitHub — it syncs automatically |
| Hand-written README text | `README.md` (anything outside the `AETHER:PROJECTS` markers) |
| Colours, type, motion | `src/styles/tokens.css` (see `docs/DESIGN-LANGUAGE.md`) |
| Singularity banner colours (`'ember'` warm disk or `'cobalt'`) | `singularity.palette` in `src/content/site.ts` |

Push to `main` and the site redeploys. Data refreshes every day at 03:17 UTC; run the workflow manually for an immediate refresh.

**Re-rendering the preview videos and posters** after changing a scene:

```bash
npm run build && npx vite preview --port 4173 &
npm run capture -- --all          # needs Chrome + ffmpeg; takes ~10 minutes on a CPU
```

## 8. Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| Site shows 404 | Pages source is not set to **GitHub Actions** (step 6), or the deploy job hasn't run yet. |
| Site loads but is blank / unstyled | Wrong base path. The workflow sets it from the repository name automatically; for a local build of the project page use `AETHER_BASE=/Muhammad-Adil-Abir/ npm run build`. |
| "Telemetry offline" on the archive | The sync job hasn't run successfully. Open the Actions log for *Fetch contribution calendar*. The previous data is always kept if GitHub is briefly unreachable. |
| "Commit changes" step fails with 403 | Set Workflow permissions to *Read and write* (step 6). |
| The workflow never runs on schedule | GitHub pauses scheduled workflows in repositories with no activity for 60 days — push any commit or run it manually. |
| 3D looks low-resolution | The site lowered quality because frames were slow; this is deliberate. Try `?quality=high` to compare. |
| No 3D at all | WebGL is unavailable or "Reduce motion" is on; the still edition is shown instead, by design. |
| README images don't update | GitHub caches images; wait a few minutes or hard-refresh. |

## 9. How the data stays honest

- `scripts/sync-github.ts` reads GitHub's own calendar (GraphQL in Actions; the public calendar page when run locally without a token).
- Counts are never estimated. If a day's count can't be read, the sync fails rather than guessing.
- Corrupt or missing data puts the site in an explicit offline state; nothing is invented.
- The sync only writes when the data actually changed, so re-running it is safe.
