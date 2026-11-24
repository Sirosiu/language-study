---
name: Sirosiu Language Study
description: An aligned bilingual primer with lesson-linked practice.
colors:
  accent: "#356649"
  accent-hover: "#244c36"
  ochre: "#856125"
  error: "#963f35"
  paper: "#f8f6ef"
  page: "#fffef9"
  ink: "#183b32"
  muted: "#52675d"
  line: "#d7dfd3"
  wash: "#eaf0e5"
  wash-hover: "#d7e4d0"
  highlight: "#dce9d4"
  field-line: "#a7b8a6"
  white: "white"
typography:
  display:
    fontFamily: "StudySerif, StudyArabic, StudyGeorgian, StudyCJK, StudyDevanagari, serif"
    fontSize: "clamp(32px, 3.1vw, 48px)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "StudySerif, StudyArabic, StudyGeorgian, StudyCJK, StudyDevanagari, serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "StudySans, StudyArabic, StudyGeorgian, StudyCJK, StudyDevanagari, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "StudySans, StudyArabic, StudyGeorgian, StudyCJK, StudyDevanagari, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
  intro:
    fontFamily: "StudySans, StudyArabic, StudyGeorgian, StudyCJK, StudyDevanagari, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "StudySans, StudyArabic, StudyGeorgian, StudyCJK, StudyDevanagari, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  native:
    fontFamily: "StudySans, StudyArabic, StudyGeorgian, StudyCJK, StudyDevanagari, sans-serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.8
  pronunciation:
    fontFamily: "StudySans, StudyArabic, StudyGeorgian, StudyCJK, StudyDevanagari, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  letter:
    fontFamily: "StudySans, StudyArabic, StudyGeorgian, StudyCJK, StudyDevanagari, sans-serif"
    fontSize: "29px"
    fontWeight: 400
    lineHeight: 1.4
  section-summary:
    fontFamily: "StudySerif, StudyArabic, StudyGeorgian, StudyCJK, StudyDevanagari, serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  square: "0px"
  field: "4px"
  option: "5px"
  control: "6px"
spacing:
  compact: "6px"
  small: "8px"
  control-gap: "10px"
  tight: "12px"
  medium: "16px"
  panel: "20px"
  unit: "24px"
  inset: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 17px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 17px"
  button-secondary-hover:
    backgroundColor: "{colors.wash-hover}"
  button-text:
    textColor: "{colors.accent}"
    padding: "0px"
  search-field:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "9px 11px"
    width: "100%"
  language-item:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.field}"
    padding: "6px 12px"
  language-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
  study-tab:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "15px 0px"
  study-tab-active:
    textColor: "{colors.ink}"
  phrase-chunk:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "7px 12px"
  inline-practice:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    padding: "{spacing.unit}"
  script-letter:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    padding: "13px 8px 12px"
  word-entry:
    textColor: "{colors.ink}"
    padding: "16px 0px"
  feedback:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    padding: "20px 24px"
---

# Design System: Sirosiu Language Study

## Overview

**Creative North Star: "The Aligned Bilingual Primer"**

The system feels like a working language primer: warm paper, dark green ink, quiet rules, and clear relationships between native writing and its explanation. Serif headings mark the structure; a script-capable sans-serif carries examples, pronunciation, and controls. The reading surface stays open and flat, with pale panels reserved for audio, practice, and answer feedback.

The character is precise and restrained. Content earns the space: letter charts, translated examples, expandable lessons, and word rows use alignment and typographic hierarchy to make a large collection approachable. Controls sit close to the material they act on. Self-hosted fonts and local course data support the portable study context recorded in PRODUCT.md.

**Key Characteristics:**

- Warm paper with green ink and a quiet green wash.
- Serif structure and readable, script-capable sans-serif text.
- Ruled charts and aligned bilingual rows.
- Compact controls beside generous reading space.
- Flat reference material with selective practice and audio panels.

## Colors

The frontmatter preserves the implemented CSS values. Green supplies the reading and action vocabulary; ochre and brick carry specific states.

### Primary

- **Study Green (`accent`)** colors primary actions, links, listening controls, selected radio accents, and the active study-tab underline. Its deeper hover tone belongs to primary buttons.
- **Green Ink (`ink`)** carries body text and headings; a solid ink fill identifies the selected language against pale page text.

### Secondary

- **Ochre (`ochre`)** identifies keyboard focus and saved-word labels.
- **Brick (`error`)** identifies a model comparison that needs another try. It is a feedback state, with explanatory text alongside it.

### Neutral

- **Warm Paper (`paper`)** is the document background.
- **Page (`page`)** is the slightly brighter backing for letter cells, form fields, and inline practice.
- **Quiet Green (`muted`)** carries introductions, translations, pronunciation, labels, and inactive navigation.
- **Rule (`line`)** separates rows, charts, navigation, and foldouts.
- **Green Wash (`wash`)** backs audio, feedback, selected options, and secondary controls. Its hover tone belongs to secondary buttons.
- **Form Highlight (`highlight`)** marks a grammar form or a gap inside a native example.
- **Field Rule (`field-line`)** supplies the stronger outline around editable fields.
- **White (`white`)** is the foreground of solid action and status surfaces.

**The State Color Rule.** Keep ochre attached to focus or saved state and brick attached to corrective feedback; communicate each state in words as the implemented controls do.

## Typography

**Display Font:** Self-hosted StudySerif, followed by StudyArabic, StudyGeorgian, StudyCJK, StudyDevanagari, and a generic serif fallback.

**Body Font:** Self-hosted StudySans, followed by the same script fallbacks and a generic sans-serif fallback.

The pairing gives headings a primer-like voice while keeping native examples and explanations direct. All six local faces use `font-display: swap`. The source exposes the two full stacks as `--serif` and `--sans`; it does not identify a separate monospace role.

### Hierarchy

- **Display** uses the frontmatter's fluid size for the main lesson heading, balanced wrapping, and a maximum width of (750px).
- **Headline** marks sections with more space above than below (38px and 12px).
- **Title** marks explanatory subtopics in bold sans-serif text; question titles use (20px) and weight (650).
- **Body** uses a maximum paragraph measure of (72ch). Introductions are quieter, slightly larger, and constrained to (64ch).
- **Label** serves navigation and ordinary controls. Small explanatory copy uses (14px); translation copy uses (15px) with a line height of (1.6).
- **Native** makes the studied text visibly larger than its meaning. Right-to-left native blocks use (25px); Japanese and Korean blocks use (23px). Base native text becomes (20px) at the mobile breakpoint; the more specific script selectors retain their larger sizes. The Mandarin tag variation is recorded in the documenter report rather than established as a type rule.
- **Pronunciation** stays below the native word and wraps long forms. Script symbols use the separate letter role; names underneath use (12px).
- **Section summary** is a serif foldout heading. Nested grammar-rule summaries use (16px) sans-serif text at weight (650).

**The Bilingual Alignment Rule.** Keep native writing, pronunciation, and meaning visually connected; use the native text's language and direction attributes rather than changing the whole interface direction.

## Layout

The desktop shell has a sticky language rail (220px) and a flexible workspace. The rail stays one viewport tall and scrolls independently. The topbar and tabs use horizontal insets of (42px); the reading region has a maximum width of (1040px) and padding of (46px 54px 64px). The paragraph measure, rather than a card grid, limits reading width.

At a viewport width of (1000px) or less, the rail becomes (188px), the workspace insets become (32px), and main padding becomes (38px 32px 54px). At (700px) or less, the shell becomes a document column. A two-column header places the smaller brand beside a language selector; the language list and rail-end links are hidden. The mobile footer exposes Obsidian notes and Save my progress in a wrapping utility row, preserving those actions at this size. Main padding becomes (30px 20px 40px), topbar insets become (20px), and the five study tabs retain horizontal scrolling. Filters stack at full width. Main headings use (34px), section headings (26px), and serif foldout summaries (22px).

Letter charts use an auto-fitting grid with cells at least (100px) wide, or (130px) for Arabic connection forms. Mobile minimums are (75px) and (108px). Word summaries align a native-word column and a wider meaning column, with a gap of (20px) on desktop and (15px) on mobile. Word-bank pagination displays ten entries at a time. Question choices, button rows, chunks, and filters wrap within the available space.

**The Reading Rhythm Rule.** Use rules and repeated rows to group reference material; reserve filled panels for the implemented audio, practice, and feedback roles.

The print stylesheet removes navigation and controls, opens disclosure content visually, uses a plain white page, and avoids splitting letter charts. The Open PDF action opens the consolidated book separately.

## Elevation & Depth

Reference content is flat. Background tones and thin rules establish groups; letter cells and inline practice have borders without shadows. The only shadow belongs to the transient status notice (`0 7px 20px #16392f28`). It distinguishes a fixed message from the document beneath it. There are no hover lifts or ambient card shadows.

**The Flat Reference Rule.** Keep lesson, word, and script surfaces flat; the status notice is the implemented elevation exception.

## Shapes

Charts, audio panels, feedback, and practice containers have square corners. Small controls alone soften: fields, phrase chunks, and language items use the field radius; radio-option rows use the option radius; primary and secondary buttons and the status notice use the control radius. Borders are thin (1px). Study tabs are flat text controls with a selected underline (2px).

## Components

### Buttons

Compact and legible, with labels that say what happens next. Primary and secondary buttons share padding and a minimum height of (42px), with a line height of (1.4). Primary hover deepens its green; secondary hover deepens its wash. Text actions are underlined, unfilled, and use (14px) type. Disabled buttons use opacity (0.45) and the default cursor. Buttons do not animate or move on hover. Keyboard focus uses an ochre outline (3px) with an offset of (3px).

Listening controls use an authored inline SVG speaker with a consistent stroke (1.75), rendered at (16px). They say Listen offline when the source maps the sentence to a local rule or passage track. Other sentences use an available device voice; individual dictionary recordings may require internet. Only one audio source plays at a time. Audio panels retain native browser controls, lazy loading, and a maximum player width of (540px). Playback speed offers Slow (0.8) and Normal (1); the selected rate applies to local recordings, online dictionary recordings, native HTML players, and device speech. Changing the setting updates active recordings, and newly started players inherit it.

### Navigation

The language list is quiet text with a wash on hover and a solid selected row. Study navigation is a row of five text buttons; selected state combines ink, heavier weight (650), and the green underline. Both use `aria-current` to expose state. Hash routes preserve language and study section. On mobile, language selection uses a native select and study sections remain a scrolling row. Obsidian notes and progress export move to the footer; those utilities use (12px) type, wrap with gaps of (12px 20px), and sit (16px) below the footer text.

### Inputs / Fields

Editable controls use the page surface, field rule, ink, and compact padding. Search has a maximum width of (550px); short answers use (460px). Textareas fill their container, start at (110px) high, and can resize vertically. Labels remain visible. Radios sit within bordered option rows; a checked row uses the wash and an accent border. Phrase-chunk buttons append text to the answer field and return focus there. Empty search or practice results explain how to change the filters.

### Cards / Containers

Audio and feedback use tonal panels. Inline practice alone has a bright page surface, a thin rule, and internal padding from the unit token; its empty mount is hidden. On mobile, these panels use compact padding (17px). Practice stays inside its expanded rule, with a separate mixed bank available from the Practice tab.

### Lesson disclosures

Large ruled serif foldouts contain explanation, translated examples, nested rules, and practice. The first grammar section opens by default; nested rules open on demand. A Read this rule action returns to the matching lesson, opens its ancestors, and scrolls it into view. Open writing and reasoning tasks expose their model through a native disclosure. These folds reduce visible density while keeping related content together.

### Script chart

Square ruled cells hold a large native symbol above its name or reading. Arabic cells also hold initial, medial, and final forms; Japanese cells pair kana. Text carries language and direction metadata. The chart has no decorative elevation and adapts its number of columns to the reading width.

### Inline practice and feedback

Question metadata uses tabular numerals. The studied form or gap is highlighted inside an enlarged native example; its meaning follows directly below. Closed-form questions compare normalized model wording. Translation, ordering, and explanation questions ask the learner to compare a model. Feedback presents the form, complete example, meaning, explanation, listening action, source, and explicit self-marking controls. A model answer is available before marking progress. In the mixed Practice bank, the Study set dropdown switches between All questions and Marked for another practice, alongside the rule and question-type filters. Practise again later adds a question to the review set; marking I can use this removes it from that set and immediately updates the mixed question display. An empty review result explains how to add questions or widen the filters.

The only authored animation reveals feedback with a vertical clip path over (0.22s), using `cubic-bezier(.16, 1, .3, 1)`. It runs only when `prefers-reduced-motion: no-preference` applies. Other interface updates are immediate. Notices remain for (6500ms) and announce their text through a status live region.

### Word rows

Each native disclosure aligns the word and pronunciation with its English meaning. Opening it exposes word class, additional meanings, examples, listening, a saved-word action, the dictionary source, and the numbered offline track. Saved state uses an ochre text label. Search, word class, and saved-list filters update the ten-row page. When a language changes, an unavailable word-class filter resets to All word classes so the control and results remain consistent. Progress and saved words persist in browser storage by language; Save my progress exports the same JSON from the desktop rail and mobile footer.

## Do's and Don'ts

### Do:

- **Do** keep native text, pronunciation, and meaning aligned and close to their listening action.
- **Do** use the existing serif and script-capable sans-serif stacks, preserving language and direction metadata.
- **Do** group reference material with ruled rows and use the wash for audio and answer context.
- **Do** keep practice beside its rule and expose a direct return to the relevant explanation.
- **Do** preserve visible labels, keyboard focus, explicit selected states, and descriptive empty results.
- **Do** retain readable wrapping, mobile filters, and horizontally scrolling study navigation.

### Don't:

- **Don't** spread decorative shadows across the flat reading surface.
- **Don't** detach a native example from its meaning or enlarge pronunciation above the native word.
- **Don't** turn an open translation or explanation task into an unqualified right-or-wrong score.
- **Don't** remove the reduced-motion condition from the feedback reveal.
- **Don't** imply that synthetic or device speech is a native dictionary recording.

## Website hosting additions

The hosted course preserves the paper and green reading interface and its 1000/700 px breakpoints. A folded Study tools section keeps device utilities together: progress export/import, per-language offline saving, installation help, PDF and Obsidian downloads. Its secondary buttons use the page surface against the wash background.

Header and footer links follow the selected language. Download and attribution index pages use the existing type, spacing and divider patterns. The web manifest icon uses a simple open-book mark in ink and paper. Form text is at least 16 px on phones to avoid focus zoom. Mandarin native text uses the same larger CJK treatment for `zh-CN` as other East Asian scripts. Focus, placeholder text, empty/error/loading/success states and keyboard skip navigation are explicitly supported.

Progress is local to a browser and site path. Manual import/export is described plainly in Study tools. Offline status identifies the current device and language; recorded audio and PDFs save on demand, while streamed dictionary recordings need internet.
