# Website verification

Release checked on 24–25 November 2026. The 39 existing browser cases passed across Chromium, Firefox and WebKit. All 21 added feature cases passed after fixing writing-section navigation and isolating mocked API requests from WebKit’s service-worker routing. Model, offline queue, conflict, plugin and progress unit checks also passed; see the test sources for current counts. This records website and packaging verification; it does not claim exhaustive linguistic review.

- Asset validation: 15 courses, 15,000 question IDs, 15,000 word IDs, all six question types, matched grammar-rule counts, referenced recordings, 15 PDFs and 15 ZIPs containing each language’s note, PDF and all 1,116 recorded files, including separate letter recordings.
- Hosting: all 15 languages and PDF links under `/language-study/`, matching a GitHub Pages project URL. The GitHub Actions Pages workflow publishes the built site. The base site is live; release deployment status is verified separately.
- Repository limits: deployed content about 361 MB, largest file about 24 MB, below GitHub’s 100 MB file limit and Pages’ 1 GB site limit.
- Progress: legacy and versioned backups, identifier validation, merge behavior, malformed imports, oversized imports, blocked browser storage, preservation of existing words and transfer into a separate browser context.
- Interaction: inline practice, every question type, review-only filtering and removal after marking a form mastered, word saving/search, reload persistence, delayed language switches, keyboard skip and failed-download retry.
- Layout: 320×740, 390×844, 768×1024, 844×390 and 1440×960; all five study sections. No horizontal document overflow. Additional 200% CSS magnification and keyboard-control checks. CSS magnification is a layout stress test, not physical-device browser zoom.
- Offline: save a French language pack, reconnect-free page navigation, grammar, PDF retrieval, recorded MP3 playback, valid byte ranges, suffix ranges, 416 responses and recovery for a language that has not been saved.
- Browser engines: Chromium 151, Firefox 153 and WebKit 26.5 through Playwright 1.62.1. All three cut the actual HTTP server connections; Chromium/Firefox also enable Playwright’s offline mode. WebKit’s offline emulator returns an internal error before SW cache access, and Firefox can allow SW-owned network requests despite that mode. Actual connection failure verifies the fallback and audio in every engine. This is a test-harness distinction, not a bypass of the fallback checks.
- Rendered visual review: desktop inline French practice, Arabic phone alphabet/reference and phone Study tools. Screenshots are in this folder. Body contrast is approximately 11.35:1, muted copy 5.62:1, utility-panel copy 5.23:1 and primary-button text 6.67:1. Mobile form text is 16 px.

These are desktop browser-engine checks at representative device sizes. Physical iPhone/Android installation and every browser/OS combination were not independently tested. Browser cache eviction and device voices remain controlled by the user’s browser and OS.

Run `npm run build`, `npm run validate`, `npm run test:unit` and `npm test` to repeat the checks. Optional screenshots can be reproduced with `npm start` and `node scripts/capture.mjs`; set `SITE_URL` to preview under a custom local base path.


## Private study and dictionary checks

- Individual letter playback and English UK selection in all three browser engines; Mandarin recordings explicitly labelled as syllable/tone examples.
- Full-dictionary lookup parses the complete source before selecting the language section, preserving Wiktionary template context. It removes the source contents list, other languages, scripts/images/unsafe links, handles absent entries and retains source attribution. Mocked API cases run with service workers blocked; the separate offline suite continues using real service workers and actual server connection failures.
- Two mocked browser devices sign in, restore drafts after navigation, share notes, add questions, save grammar reasoning, receive incoming notebook/answer updates and hide private data after sign-out. Layout checks cover 320, 390, 768 and 1440 px.
- The same ledger is tested for account isolation, offline reload, edits during an in-flight save, early Realtime acknowledgements, simultaneous edits, stale Syncthing copies, tombstones, damaged local backups and feedback-loop prevention.
- The plugin bundle exports a mobile-compatible class. Tests preserve public course text, round-trip Markdown answers, protect notes belonging to another account, handle remote updates and start a built-in or grammar writing question in Obsidian before it has any website answer.
- The database migration passed isolated Postgres tests for ownership, cross-account isolation, anonymous denial, direct-write denial, revision comparison, idempotence and soft deletion.
- The migration was applied to the selected Supabase project. Live SQL inspection returned RLS enabled, owner policy present, Realtime enabled, and anonymous/direct-write privileges disabled. Actual anonymous REST reads and RPC writes returned permission denial.

Creating the owner’s password and signing in on each device are user setup steps. Mocked account tests and database privilege checks do not constitute a signed-in end-to-end run with the owner’s credentials. The plugin writes ordinary private Markdown into the Syncthing vault; local vault files and device caches are not encrypted by this application.
