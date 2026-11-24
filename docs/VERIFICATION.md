# Website verification

Release checked on 24 November 2026. All 39 browser cases and three progress unit checks passed; the offline cases were rerun after correcting browser-emulation differences in the test harness. This records website and packaging verification; it does not claim exhaustive linguistic review.

- Asset validation: 15 courses, 15,000 question IDs, 15,000 word IDs, all six question types, matched grammar-rule counts, referenced recordings, 15 PDFs and 15 ZIPs containing each language’s note, PDF and all recorded audio.
- Hosting: all 15 languages and PDF links under `/language-study/`, matching a GitHub Pages project URL. Workflow and local build scripts are included; no remote deployment has been performed.
- Repository limits: deployed content about 382 MB, largest file about 24 MB, below GitHub’s 100 MB file limit and Pages’ 1 GB site limit.
- Progress: legacy and versioned backups, identifier validation, merge behavior, malformed imports, oversized imports, blocked browser storage, preservation of existing words and transfer into a separate browser context.
- Interaction: inline practice, every question type, review-only filtering and removal after marking a form mastered, word saving/search, reload persistence, delayed language switches, keyboard skip and failed-download retry.
- Layout: 320×740, 390×844, 768×1024, 844×390 and 1440×960; all five study sections. No horizontal document overflow. Additional 200% CSS magnification and keyboard-control checks. CSS magnification is a layout stress test, not physical-device browser zoom.
- Offline: save a French language pack, reconnect-free page navigation, grammar, PDF retrieval, recorded MP3 playback, valid byte ranges, suffix ranges, 416 responses and recovery for a language that has not been saved.
- Browser engines: Chromium 151, Firefox 153 and WebKit 26.5 through Playwright 1.62.1. All three cut the actual HTTP server connections; Chromium/Firefox also enable Playwright’s offline mode. WebKit’s offline emulator returns an internal error before SW cache access, and Firefox can allow SW-owned network requests despite that mode. Actual connection failure verifies the fallback and audio in every engine. This is a test-harness distinction, not a bypass of the fallback checks.
- Rendered visual review: desktop inline French practice, Arabic phone alphabet/reference and phone Study tools. Screenshots are in this folder. Body contrast is approximately 11.35:1, muted copy 5.62:1, utility-panel copy 5.23:1 and primary-button text 6.67:1. Mobile form text is 16 px.

These are desktop browser-engine checks at representative device sizes. Physical iPhone/Android installation and every browser/OS combination were not independently tested. Browser cache eviction and device voices remain controlled by the user’s browser and OS.

Run `npm run build`, `npm run validate`, `npm run test:unit` and `npm test` to repeat the checks. Optional screenshots can be reproduced with `npm start` and `node scripts/capture.mjs`; set `SITE_URL` to preview under a custom local base path.
