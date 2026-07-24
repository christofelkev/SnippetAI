# SnippetAI — Tier 1 Features Design

**Date:** 2026-07-24
**Status:** Approved (design phase)
**Scope:** Three cohesive "Tier 1" features for SnippetAI (Tauri v2 + React 19 + SQLite).

## Summary

Add the three highest-leverage features to SnippetAI:

1. **Quick-paste popup** — a global hotkey summons a small always-on-top window to search snippets and copy one to the clipboard; the app lives in the system tray so the hotkey works from anywhere.
2. **Syntax highlighting + per-snippet language** — code blocks render highlighted when not being edited; each snippet carries an optional language.
3. **Clean "copy code"** — copying a snippet strips inline image markdown so only the code lands on the clipboard.

Approved decisions:
- Quick-paste action = **copy to clipboard** (no keystroke injection / auto-paste).
- Quick-paste UI = **dedicated small window** (Spotlight/Alfred style).
- Highlighting = **highlight-on-view** (read-only highlighted block when not editing, plain textarea when editing) — preserves the existing block editor and inline images.
- Default global hotkey = **`Ctrl+Shift+Space`** (configurable in Settings).
- Highlight library = **highlight.js** (lightweight, synchronous, CSS-themed).
- **Hide-to-tray on close** so the app keeps running in the background for the hotkey.

## Current State (baseline)

- **Stack:** Tauri v2, React 19, Tailwind v4, SQLite via `rusqlite`.
- **Tauri plugins present:** `opener`, `clipboard-manager`, `http`. **Missing:** `global-shortcut`, tray.
- **Snippet schema:** `id, title, content, group_name, created_at, updated_at`. **No `language` column.**
- **Content model:** markdown string; inline images stored as `![alt](http://asset.localhost/...)`. `ContentEditor` parses content into text/image blocks; each text block is a `<textarea>`.
- **Copy today:** `DetailView.handleCopy` calls `writeText(content)` — copies raw content including image markdown.
- **No test framework** is configured.

## Feature 1 — Quick-paste popup (global hotkey + tray)

### Architecture

**Rust (`src-tauri`):**
- `Cargo.toml`: add `tauri-plugin-global-shortcut = "2"`; enable the `tray-icon` feature on the `tauri` crate (`features = ["protocol-asset", "tray-icon"]`).
- `lib.rs`:
  - Register `tauri_plugin_global_shortcut` plugin.
  - Build a **tray icon** in `setup` with a menu: `Open SnippetAI`, `Quick Paste`, `Quit`. Left-click toggles the main window; menu items show the respective window or exit.
  - **Hide-to-tray:** intercept the main window `CloseRequested` event → `prevent_close()` + `window.hide()`. The app only exits via the tray `Quit` item.
- `tauri.conf.json`: declare a second window:
  ```json
  {
    "label": "quickpaste",
    "title": "Quick Paste",
    "width": 640,
    "height": 420,
    "decorations": false,
    "alwaysOnTop": true,
    "skipTaskbar": true,
    "resizable": false,
    "visible": false,
    "center": true
  }
  ```
- `capabilities/default.json`: extend `windows` to `["main", "quickpaste"]`; add `global-shortcut:default` and window show/hide/focus permissions for the quickpaste window.

**Frontend:**
- `main.tsx` picks the React root by window label:
  ```ts
  import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
  const label = getCurrentWebviewWindow().label;
  root.render(label === 'quickpaste' ? <QuickPaste /> : <App />);
  ```
  No router, no extra HTML entry.
- **`QuickPaste.tsx`** (new):
  - On mount and whenever the window gains focus: fetch all snippets (`tauriApi.getSnippets()`), reset query, autofocus the search input.
  - Client-side filter over title + content (snappier than a round-trip for a popup).
  - Keyboard: `↑/↓` move the active row, `Enter` copies the active snippet's **stripped** content (see Feature 3) and hides the window, `Esc` hides.
  - `getCurrentWebviewWindow().onFocusChanged` → hide when focus is lost.
  - Hide = `getCurrentWebviewWindow().hide()`; copy = `writeText(...)`.

**Global shortcut (JS-side, so Settings can reconfigure it):**
- Use `@tauri-apps/plugin-global-shortcut`.
- On `App` mount: read `global_hotkey` from settings (default `Ctrl+Shift+Space`), register it. Handler shows + focuses the `quickpaste` window.
- The main window's webview stays alive while hidden to tray, so the JS-registered handler keeps working in the background.

### Settings changes
- Add a **Global hotkey** field to `SettingsModal`. On change: unregister the old accelerator, register the new one, persist to settings key `global_hotkey`.

### Error handling
- Shortcut registration can fail (accelerator already claimed by the OS/another app). Catch it, keep the previous binding, and toast: "Hotkey gagal didaftarkan — mungkin sudah dipakai aplikasi lain."

## Feature 2 — Syntax highlighting + per-snippet language

### Data model
- **Migration:** in `init_db`, after the `CREATE TABLE`, run `ALTER TABLE snippets ADD COLUMN language TEXT NOT NULL DEFAULT ''`, guarded so it is a no-op when the column already exists (check `PRAGMA table_info(snippets)` first, or ignore the duplicate-column error).
- Extend the Rust `Snippet` struct with `language: String`; update every `SELECT` (`get_snippets`, `search_snippets`, `update_snippet`'s re-select) and the column indices; thread `language` through `add_snippet` / `update_snippet`.
- Update `src/lib/tauri.ts` `Snippet` interface and the `addSnippet` / `updateSnippet` signatures; update `useSnippets` and the `AddPanel` / `DetailView` callers.

### Rendering (highlight-on-view)
- Add `highlight.js` as a dependency and import a dark theme CSS (`github-dark`) that fits the zinc/indigo look; adjust if needed.
- In `ContentEditor`, track `editingIndex: number | null`:
  - Text block **not** being edited → `<pre><code>` produced by `hljs.highlight(value, { language })`, or `hljs.highlightAuto(value)` when the snippet's language is empty. Clicking it sets `editingIndex` and focuses.
  - Text block being edited → the current `<textarea>` (unchanged behavior). Blur → clear `editingIndex` and save.
- Image blocks are unchanged; inline images keep working.
- Wrap highlight calls in try/catch → fall back to plain text on an unknown language.

### Language selection
- Add a compact language `<select>` in the `DetailView` header (options: `Auto`, plus common languages — bash, js, ts, python, json, sql, rust, go, html, css, yaml, ...). Selecting persists `language` on the snippet. `Auto` stores `''` → auto-detect.

## Feature 3 — Clean copy

- New module `src/lib/content.ts` exporting `stripImageMarkdown(content: string): string`:
  - Remove every `![...](...)` match (`/!\[[^\]]*\]\([^)]+\)/g`).
  - Collapse 3+ consecutive newlines to 2 and trim the result.
- `DetailView.handleCopy` and `QuickPaste`'s `Enter` both copy `stripImageMarkdown(content)`.
- Per-code-block copy buttons are **out of scope** for Tier 1 (optional follow-up).

## Implementation Order

Build smallest → largest so each step is independently verifiable:

1. **Feature 3 (clean copy)** — a pure util + two call sites.
2. **Feature 2 (highlighting + language)** — DB migration, backend/type plumbing, view/edit toggle, language dropdown.
3. **Feature 1 (quick-paste + tray + hotkey)** — the largest: new plugin, tray, second window, QuickPaste component, settings.

## Testing Strategy

- **Unit tests (add Vitest):** `stripImageMarkdown` (images removed, whitespace collapsed, plain text untouched) and the QuickPaste filter function (matches title and content, case-insensitive). These are pure and worth locking down.
- **Manual verification checklist** (native/UI behavior that is impractical to unit test):
  - Hotkey summons the popup from another app; `Enter` copies; `Ctrl+V` elsewhere pastes clean code (no image URLs).
  - `Esc` and focus-loss hide the popup.
  - Closing the main window hides to tray; the hotkey still works; `Quit` from the tray actually exits.
  - Changing the hotkey in Settings rebinds correctly; a conflicting accelerator surfaces the error toast.
  - Highlighted view renders; clicking a block edits as a textarea; blur re-highlights and saves; inline images still render; the language dropdown changes highlighting.

## Out of Scope (Tier 1)

- Auto-paste / keystroke injection.
- Per-code-block copy buttons.
- Semantic search, tags, favorites, export/import (Tier 2/3).
- Moving API keys out of plaintext SQLite (tracked separately).
