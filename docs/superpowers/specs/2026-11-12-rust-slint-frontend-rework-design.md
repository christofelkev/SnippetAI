# SnippetAI — Rust Slint Frontend Rework Design

**Date:** 2026-11-12  
**Status:** Approved (design phase)  
**Scope:** Rework SnippetAI frontend from Tauri v2 + React 19 (WebView2) to a 100% native Rust GUI using **Slint UI**, eliminating the WebView2 runtime dependency while ensuring zero visual/UX difference and zero data loss.

---

## 1. Executive Summary & Goals

### Problem Statement
The current implementation relies on Microsoft Edge WebView2 via Tauri v2. While functional, WebView2 introduces:
- Heavy memory consumption (150MB – 300MB+ RAM for a lightweight snippet tool).
- Startup latency (cold-boot overhead from the Chromium web engine).
- Runtime dependency on Edge WebView2 in Windows.

### Core Objectives
1. **Zero WebView2**: 100% native rendering via Slint + Skia/FemtoVG. Memory target: **<30MB RAM**; startup target: **<50ms**.
2. **Visual & UX Parity**: From the end user's perspective, the application must look and feel identical to the current Tailwind v4 + React 19 UI:
   - 3-column resizable layout (Sidebar, Snippet List, Detail View) with drag handles and double-click reset.
   - Complete 4-theme engine: Default Dark (Zinc), Hacker Red (Persona 5 Royal with crimson red and 'Teko' font), Ocean Blue (Light), Cyberpunk 2077 (Yellow/Cyan with 'Orbitron' font).
   - Code block editor with syntax highlighting and inline image previews.
   - Floating, frameless QuickPaste popup window triggered by global hotkey (`Ctrl+Shift+Space`).
   - System tray integration with hide-to-tray behavior.
   - AI Grouping and metadata auto-generation.
3. **Zero Data Loss Guarantee**:
   - Reuse the exact database path: `%APPDATA%\com.snippets.app\snippets.db`.
   - Reuse the exact images directory: `%APPDATA%\com.snippets.app\images\*.png`.
   - Maintain 100% schema compatibility with existing `snippets` and `settings` SQLite tables.
   - Automated safety backup on first run.

---

## 2. Architecture & Workspace Structure

We decouple core backend/storage logic from UI presentation using a clean Cargo workspace:

```
SnippetAI/
├── Cargo.toml                      # Root workspace manifest
├── crates/
│   ├── snippet-core/               # Shared business logic & database engine
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── db.rs               # rusqlite connection, schema & migration
│   │       ├── models.rs           # Snippet, Setting, AIGrouping data structures
│   │       ├── storage.rs          # Image disk I/O ($APPDATA/images) & DB backup
│   │       ├── content.rs          # Image markdown parser & stripImageMarkdown
│   │       ├── ai.rs               # Async OpenAI / Anthropic / DeepSeek HTTP client
│   │       └── related.rs          # Offline token-overlap similarity scoring
│   │
│   └── snippet-app/                # Native Slint desktop application
│       ├── Cargo.toml
│       ├── build.rs                # slint_build compiler configuration
│       ├── ui/
│       │   ├── app.slint           # Main application window layout
│       │   ├── quickpaste.slint    # Frameless floating quick-paste window
│       │   ├── theme.slint         # Theme palette & dynamic style properties
│       │   └── components/
│       │       ├── sidebar.slint
│       │       ├── snippet_list.slint
│       │       ├── detail_view.slint
│       │       ├── content_editor.slint
│       │       ├── resize_handle.slint
│       │       ├── ai_modal.slint
│       │       ├── settings_modal.slint
│       │       └── toast.slint
│       └── src/
│           ├── main.rs             # App entry point, single-instance guard
│           ├── app_state.rs        # Slint model adapters and reactive state
│           ├── highlight.rs        # syntect code highlighter
│           ├── hotkey.rs           # global-hotkey manager
│           ├── tray.rs             # tray-icon setup and event loop
│           └── clipboard.rs        # arboard clipboard helper
```

---

## 3. Data Safety & Persistence Model

### SQLite Schema Continuity
The SQLite database at `%APPDATA%\com.snippets.app\snippets.db` remains unchanged:
- **`snippets` table**: `id (TEXT)`, `title (TEXT)`, `content (TEXT)`, `group_name (TEXT)`, `created_at (INTEGER)`, `updated_at (INTEGER)`, `language (TEXT)`.
- **`settings` table**: `key (TEXT PRIMARY KEY)`, `value (TEXT)`.
  - Keys used: `app_theme`, `ai_provider`, `ai_api_key`, `ai_model`, `global_hotkey`, `snippetai_sidebar_width`, `snippetai_list_width`.

### Auto-Backup Routine
Before executing any query on startup, `snippet-core` checks if `snippets.db` exists. If present, it creates a copy named `snippets.db.backup_<UNIX_TIMESTAMP>` in the same directory.

### Asset Protocol Replacement
Tauri's `asset://` URL protocol is replaced by direct local filesystem references. Slint's `Image` component natively renders local image files directly from `%APPDATA%\com.snippets.app\images\<uuid>.png`.

---

## 4. UI/UX Parity Specifications

### 4.1. Three-Column Resizable Layout
- **Sidebar**:
  - Displays "All Snippets" count and derived list of groups with snippet counts.
  - Allows selecting group filter and reordering groups.
  - Width bounded: min 160px, max 450px, default 240px.
- **Resize Handle**:
  - Hover highlight (indigo / theme accent), cursor `col-resize`.
  - Drag to resize adjacent column. Double-click resets to default width.
  - Width preferences persisted to `settings` table.
- **Snippet List**:
  - Search box with `Ctrl+K` autofocus.
  - Add button `+` (`Ctrl+N`).
  - Snippet cards displaying title, preview snippet (stripped of markdown images), language badge, and relative/formatted date.
  - Footer with "✨ AI Grouping" button and "⚙ Settings" button.
  - Width bounded: min 220px, max 600px, default 320px.
- **Detail View**:
  - Title and Group text inputs with blur-to-save behavior.
  - Language dropdown (`LANGUAGES` list).
  - Action buttons: "Copy" (with 2-second checkmark feedback), "Delete" (with confirmation dialog).
  - `ContentEditor`:
    - Alternating blocks: editable text blocks and inline image blocks.
    - Syntax highlighting powered by `syntect` when viewing.
    - Click-to-edit transition.
    - Paste listener: intercepts clipboard image data, writes to disk, and inserts markdown tag.
  - Related snippets section: calculated via the same token-overlap similarity formula.

### 4.2. Complete 4-Theme System
1. **Default Zinc**: Deep dark background `#09090b`, zinc borders, indigo-600 accents.
2. **Hacker Red (Persona 5 Royal)**: Pure black `#000000`, crimson borders `#e60012`, crimson accents, bundled 'Teko' font, background image `bg-persona.png`.
3. **Ocean Blue**: Clean light theme `#f8fafc`, slate borders, sky-blue accents `#0284c7`.
4. **Cyberpunk 2077**: Deep black `#050505`, cyberpunk yellow `#fcee0a`, cyan text `#00f0ff`, neon red borders `#ff003c`, bundled 'Orbitron' font, background image `bg-cyberpunk.png`.

### 4.3. Secondary Window: QuickPaste
- Frameless, floating popup window (`640x420`, `always-on-top: true`, `no-frame: true`).
- Summoned globally via `Ctrl+Shift+Space`.
- Instantly focuses search input.
- Keyboard navigation: Arrow Down / Up to navigate items, Enter to copy clean snippet and hide window, Escape to dismiss.
- Window focus listener: automatically hides on blur/loss of focus.

### 4.4. System Tray & Single-Instance Guard
- Built with `tray-icon` crate.
- Tray menu: "Open SnippetAI", "Quick Paste", "Quit".
- Window close button (`X`) hides to system tray rather than killing process.
- Single-instance lock via Windows named mutex: relaunching unhides and focuses existing window.

### 4.5. AI Integration
- Reimplemented in Rust using `reqwest` and `tokio`.
- Supports OpenAI, Anthropic, and DeepSeek endpoints.
- Auto-fill metadata (Title, Group, Language) and batch AI grouping preview with transactional apply.

---

## 5. Verification & Quality Gates

Each milestone must meet the following static and runtime criteria:
1. `cargo check --workspace` passes with zero errors and warnings.
2. `cargo test --workspace` passes all unit tests for `snippet-core`.
3. Memory consumption under standard workload verified < 30 MB.
4. Cold boot latency verified < 50 ms.
5. Verification against production `snippets.db` confirms 100% data and image integrity.
