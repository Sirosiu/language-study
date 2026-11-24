# Sirosiu Language Study

A responsive language course ready for GitHub Pages. Use it on a phone, tablet or computer, or install it from a supported browser for a home-screen shortcut.

The course contains Arabic, Danish, Dutch, English, Finnish, French, German, Georgian, Italian, Japanese, Korean, Mandarin Chinese, Russian, Spanish and Turkish. Each language keeps its alphabet or script, pronunciation, word formation, grammar, translated practice, vocabulary and reading together.

Included: **15,000 practice questions, 15,000 vocabulary entries, 1,116 recorded MP3 files (including 482 individual letter recordings), 15 PDF books and 15 complete Obsidian downloads**. Arabic includes MSA, Egyptian, Levantine and Gulf sections. Question types include gap filling, multiple choice, editing, sentence ordering, translation and explanation.

## Publish on GitHub Pages

Live course: [sirosiu.github.io/language-study](https://sirosiu.github.io/language-study/).

The `.github/workflows/pages.yml` workflow builds `dist/` and publishes its website files. Keep this hidden `.github` folder when copying the repository, and select **GitHub Actions** as the Pages source.

1. On GitHub, create an **empty repository**, for example `language-study`. Do not add a README, license or `.gitignore`; those are already here. A public repository supports free GitHub Pages. Private Pages availability depends on your GitHub plan.
2. Open a terminal in this repository folder. Replace `YOUR-USERNAME` and `YOUR-REPOSITORY` below with your actual GitHub names:

   ```sh
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

3. In the GitHub repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Open **Actions → Deploy language website**. The workflow runs after a push to `main`. If its first run happened before you enabled Pages, choose **Run workflow**.
5. When deployment succeeds, your address is:

   ```text
   https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
   ```

   GitHub also shows the real address in Settings → Pages and the workflow’s deployment result.

Use that URL on each device. Relative paths already support a repository URL; there is no hostname to edit in the app. A custom domain is optional and can be configured through GitHub Pages later.

This folder is an initialized Git repository with an initial commit on `main`. The companion ZIP contains the same source files without Git history, generated build output or installed dependencies. If using the ZIP, first run:

```sh
git init -b main
git add .
git commit -m "Add portable language study website"
```

Then follow the publishing steps. The repository is roughly 385 MB because it includes real offline recordings and complete downloadable vaults. Every file is below GitHub’s 100 MB limit; Git LFS is unnecessary.

## Preview locally

Install Node.js 22 or later, then:

```sh
npm ci
npm run build
npm run validate
npm start
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). Serve the built website; opening `index.html` directly as a file cannot fetch course JSON or enable offline saving.

To test the same nested path used by GitHub Pages on macOS/Linux:

```sh
BASE_PATH=language-study PORT=4173 npm start
```

Open [http://127.0.0.1:4173/language-study/](http://127.0.0.1:4173/language-study/). On PowerShell, set `$env:BASE_PATH='language-study'` and `$env:PORT='4173'` before `npm start`.

`.npmrc` disables executable symlinks so this repository also installs on USB filesystems that do not support them. The scripts invoke their tools directly.

## Study on multiple devices

Sign in in **My notebook** to save written answers, private Markdown notes, added questions and dictionary words through Supabase. Use the same account in the website and the mobile-compatible Obsidian plugin. Each device keeps its own authentication session outside the Syncthing vault.

The public course stays available without signing in. Private data is protected by owner-only Supabase access rules and a revision-checked save function. Offline edits queue locally; simultaneous edits keep both versions for you to resolve.

See [docs/sync-setup.md](docs/sync-setup.md) for account, vault, privacy and conflict instructions. The configured project uses a **public publishable key**, not a service-role credential. Apply `supabase/migrations/202611240001_language_study.sql` once to prepare its private table and sync function.

Existing signed-out question marks and course word lists still use browser storage. Study tools supports manual export/import and can copy the current language’s local marks into your signed-in account. Existing account records take priority.

## Offline study and audio

Open **Study tools → Save this language offline** while online. It saves that language’s lessons, PDF and recorded MP3 tracks on the current device. It does not download all 15 languages automatically. Wait for the success message before disconnecting.

The website can be installed using a supported browser’s **Install** or **Add to Home Screen** action. On iPhone/iPad, open it in Safari and use **Share → Add to Home Screen**. Installation alone does not save every language; use the offline control too.

The MP3 tracks are synthetic speech. The Words page also searches full available Wiktionary entries online; coverage varies by language. They cover scripts, phrases, rule examples, reading and vocabulary groups. Individual human dictionary recordings are streamed from Wikimedia and require internet. Other sentence playback uses a suitable voice installed on the device, when available. Every script reference has an independently playable recording. The English model selects US or UK letter recordings and a device voice for other speech. Mandarin buttons demonstrate labelled pinyin syllables and tone contrasts.

Browsers can evict saved files when space is low. After a website update, old offline caches are cleared and languages may need to be saved again; progress stays in browser storage. Export a backup regularly. PDF and Obsidian downloads provide independent copies.

## PDF and Obsidian downloads

**Open PDF** follows the selected language. **Study tools** includes its Obsidian download and a link to all downloads.

Each Obsidian ZIP contains one main language note, a Start Here note, source attribution, the matching PDF and recorded audio with working relative paths. Extract the ZIP and open the extracted folder as a vault in Obsidian. Keep its `Resources` folder together with the note.

## Edit and redeploy

- `web/index.html`, `web/app.js`, `web/style.css`: interface.
- `web/progress.js`: validation and merge rules for legacy progress backups.
- `web/cloud.js`, `web/cloud-config.json`: account, private notebook and question UI with public Supabase connection settings.
- `web/dictionary.js`: live Wiktionary lookup and safe definition rendering.
- `shared/`: common record model, offline ledger, revision/conflict handling and Markdown round trip.
- `obsidian-plugin/`: mobile-compatible vault integration, per-device login and private study editor.
- `supabase/migrations/`: owner-only storage and compare-and-swap save RPC.
- `scripts/package-notes.mjs`: refreshes Obsidian ZIPs with individual letter audio.
- `web/data/<code>.json`: the 15 course datasets.
- `web/Audio/`, `web/Books/`, `web/downloads/`: recordings and downloads.
- `web/sw.js`, `web/manifest.webmanifest`: offline and installation support.
- `scripts/build.mjs`: prepares `dist/`, download/source pages and versioned offline packs.
- `scripts/validate.mjs`: checks counts, references, ZIP contents and GitHub size limits.
- `provenance/`: retained source manifests, license notices and dictionary records.
- `.github/workflows/pages.yml`: deployment after pushes to `main`.

Edit the source in `web/`, build, validate and commit. Push to `main` to redeploy. `dist/` is generated and intentionally excluded from Git. If you change language content, update the corresponding PDF/Obsidian download as well. Recordings listed in `audio-manifest.json` must have accurate byte sizes.

## Checks

```sh
npm run build
npm run validate
npm run test:unit
node node_modules/@playwright/test/cli.js install chromium firefox webkit
npm test
```

Linux CI/browser machines may need Playwright’s OS dependencies; use its documented `install --with-deps` command there. The browser suite checks Chromium, Firefox and WebKit using a repository subpath, including phone/tablet widths, question interactions, downloads, progress transfer, race handling, retry and offline audio ranges.

The deploy workflow runs build, asset validation and model, queue, conflict and Obsidian unit tests. The local browser suite also checks individual letter playback, dictionary sanitization, sign-in, draft restoration and private sync between two mocked devices. Browser regression checks are available locally. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the release checks performed.

## Sources and content limits

Sentence models come from Tatoeba through OPUS; dictionary material comes from Wiktionary through Kaikki/Wiktextract. Attribution links remain in individual questions and words. The website’s **Sources & licenses** page provides readable notices and retained records.

The practice bank reuses sentence models across question types. It is not 1,000 unrelated grammar topics per language. The vocabulary bank is a useful dictionary selection, not a certified frequency ranking. Community examples, automatic readings and synthetic pronunciation have not received exhaustive native-teacher review. Use the model explanations with the source references and real conversations.

The MIT license in this repository covers the website software only. Third-party text, recordings, fonts and compiled course materials retain their own terms. See [CONTENT-LICENSES.md](CONTENT-LICENSES.md) and [web/sources.md](web/sources.md).
