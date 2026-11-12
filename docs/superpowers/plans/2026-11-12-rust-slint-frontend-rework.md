# SnippetAI Rust Slint Frontend Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the frontend of SnippetAI into a 100% native Rust GUI using Slint UI, completely eliminating WebView2 while guaranteeing visual/UX parity and 100% data preservation.

**Architecture:** A Cargo workspace containing:
1. `crates/snippet-core`: Database engine (`rusqlite`), data models, file storage (`$APPDATA/images`), AI HTTP client (`reqwest`), and content parsers.
2. `crates/snippet-app`: Slint UI binary crate implementing the main 3-column window, frameless QuickPaste popup, global hotkey, system tray, and syntect syntax highlighting.

**Tech Stack:** Rust 2021, Slint UI 1.9, `rusqlite`, `syntect`, `global-hotkey`, `tray-icon`, `arboard`, `reqwest`, `tokio`, `uuid`, `serde`, `serde_json`, `dirs`.

---

## Global Constraints

- **Zero Data Loss**: Database MUST be accessed at `%APPDATA%\com.snippets.app\snippets.db` and images at `%APPDATA%\com.snippets.app\images`. Automatic backup created before first read.
- **Visual Parity**: Must match the exact styling, font choices ('Teko', 'Orbitron', 'Inter'), colors, and layouts of the 4 themes (Zinc, Hacker Red, Ocean Blue, Cyberpunk 2077).
- **All Tasks End Green**: Every task must compile clean with `cargo check --workspace` and pass unit tests with `cargo test --workspace`.
- **Existing App Untouched**: The Tauri v2 app in `src-tauri` and `src` remains functional until the Slint app reaches complete parity and the final cutover is approved.

---

### Task 1: Setup Cargo Workspace & `snippet-core` Foundation

**Files:**
- Create: `Cargo.toml` (root workspace)
- Create: `crates/snippet-core/Cargo.toml`
- Create: `crates/snippet-core/src/lib.rs`
- Create: `crates/snippet-core/src/models.rs`
- Create: `crates/snippet-core/src/content.rs`
- Create: `crates/snippet-core/src/content_test.rs`

- [x] **Step 1: Create Root `Cargo.toml` Workspace Manifest**
Configure root Cargo workspace containing `crates/snippet-core` and `crates/snippet-app` (and keeping `src-tauri` separate or included).

- [x] **Step 2: Define Data Models in `crates/snippet-core/src/models.rs`**
Port `Snippet`, `Setting`, and `LANGUAGES` constants from TypeScript / `src-tauri/src/lib.rs`.

- [x] **Step 3: Port `stripImageMarkdown` & Markdown Image Scanner in `crates/snippet-core/src/content.rs`**
Port balanced-delimiter image parser and `stripImageMarkdown` from `src/lib/content.ts` to Rust with unit tests.

- [x] **Step 4: Run unit tests**
Run: `cargo test -p snippet-core`
Expected: PASS.

---

### Task 2: Database Engine, Migrations, and Auto-Backup

**Files:**
- Create: `crates/snippet-core/src/db.rs`
- Create: `crates/snippet-core/src/storage.rs`
- Create: `crates/snippet-core/src/db_test.rs`

- [x] **Step 1: Implement `storage.rs` with Safe DB Backup**
Implement resolution of `%APPDATA%\com.snippets.app` via `dirs::data_dir()`. Implement `backup_db_if_exists()` which copies `snippets.db` to `snippets.db.backup_<timestamp>` before opening.

- [x] **Step 2: Implement SQLite Operations in `db.rs`**
Port `init_db`, `get_snippets`, `add_snippet`, `update_snippet`, `delete_snippet`, `search_snippets`, `apply_groups`, `get_setting`, and `set_setting` with full transaction support.

- [x] **Step 3: Implement Image Disk Storage in `storage.rs`**
Implement `save_image_to_disk(bytes)` and `read_image_from_disk(filename)` targeting `$APPDATA/images/`.

- [x] **Step 4: Unit Test SQLite & Backup Operations**
Write unit tests using in-memory or temporary SQLite databases.
Run: `cargo test -p snippet-core`
Expected: PASS.

---

### Task 3: AI HTTP Client & Offline Token Similarity in `snippet-core`

**Files:**
- Create: `crates/snippet-core/src/ai.rs`
- Create: `crates/snippet-core/src/related.rs`

- [x] **Step 1: Implement Token-Overlap Related Snippets Algorithm in `related.rs`**
Port the exact word-token intersection formula from `src/components/DetailView.tsx` into pure Rust.

- [x] **Step 2: Implement Async AI Service in `ai.rs`**
Port `groupSnippets` and `generateMetadata` using `reqwest` for OpenAI, Anthropic, and DeepSeek endpoints.

- [x] **Step 3: Unit test token similarity**
Run: `cargo test -p snippet-core`
Expected: PASS.

---

### Task 4: Slint Application Setup & 4-Theme Engine

**Files:**
- Create: `crates/snippet-app/Cargo.toml`
- Create: `crates/snippet-app/build.rs`
- Create: `crates/snippet-app/ui/theme.slint`
- Create: `crates/snippet-app/ui/app.slint`
- Create: `crates/snippet-app/src/main.rs`

- [x] **Step 1: Configure `crates/snippet-app/Cargo.toml` & `build.rs`**
Add dependencies: `slint = "1.9"`, `snippet-core`, `tokio`, `arboard`, `syntect`, `dirs`. Set up `slint_build::compile("ui/app.slint")`.

- [x] **Step 2: Implement `theme.slint` with all 4 Themes**
Recreate Default Zinc, Persona 5 Royal (Hacker Red), Ocean Blue, and Cyberpunk 2077 styling, colors, and background images.

- [x] **Step 3: Smoke Test Slint App Window**
Create basic `app.slint` window and launch with `cargo run -p snippet-app`.
Expected: Window opens smoothly in <50ms with correct theme background.

---

### Task 5: 3-Column Resizable Layout & Sidebar

**Files:**
- Create: `crates/snippet-app/ui/components/sidebar.slint`
- Create: `crates/snippet-app/ui/components/resize_handle.slint`
- Modify: `crates/snippet-app/ui/app.slint`
- Create: `crates/snippet-app/src/app_state.rs`

- [x] **Step 1: Implement `resize_handle.slint`**
Create a divider bar component with hover color, drag cursor (`col-resize`), mouse drag tracking, and double-click reset to default width.

- [x] **Step 2: Implement `sidebar.slint`**
Create group list with "All Snippets" count, per-group count badge, group selection, and add group button.

- [x] **Step 3: Connect Sidebar to `app_state.rs`**
Wire group selection and column width persistence into `snippet-core` settings.

---

### Task 6: Snippet List, Search, and Filtering

**Files:**
- Create: `crates/snippet-app/ui/components/snippet_list.slint`
- Modify: `crates/snippet-app/ui/app.slint`

- [x] **Step 1: Implement Snippet Card in `snippet_list.slint`**
Render snippet cards showing title, stripped preview text, language badge, and date.

- [x] **Step 2: Implement Search Input with `Ctrl+K` Hotkey**
Filter snippet list in real-time by search query and selected group.

- [x] **Step 3: Add Action Bar**
Include Add Snippet button (`Ctrl+N`), AI Grouping button, and Settings button in footer.

---

### Task 7: Detail View, Syntax Highlighting, and Inline Images

**Files:**
- Create: `crates/snippet-app/ui/components/detail_view.slint`
- Create: `crates/snippet-app/ui/components/content_editor.slint`
- Create: `crates/snippet-app/src/highlight.rs`

- [x] **Step 1: Implement Syntax Highlighting in `src/highlight.rs`**
Integrate `syntect` to tokenize and color code blocks matching `github-dark` theme.

- [x] **Step 2: Implement Content Editor with Inline Images**
Render alternating text blocks and disk images from `$APPDATA/images/`. Allow clicking text blocks to edit.

- [x] **Step 3: Implement Copy & Delete Actions**
Wire copy button to `arboard` (stripping image markdown before clipboard write) with 2-second checkmark animation. Add delete confirmation modal.

- [x] **Step 4: Related Snippets List**
Display top 3 related snippets and handle click-to-select.

---

### Task 8: QuickPaste Popup Window & Global Hotkey

**Files:**
- Create: `crates/snippet-app/ui/quickpaste.slint`
- Create: `crates/snippet-app/src/hotkey.rs`
- Create: `crates/snippet-app/src/clipboard.rs`

- [x] **Step 1: Implement `quickpaste.slint`**
Design frameless, always-on-top window (640x420) with search bar, keyboard navigation (Up/Down/Enter/Esc), and auto-hide on blur.

- [x] **Step 2: Register Global Hotkey**
Integrate `global-hotkey` crate for `Ctrl+Shift+Space` (or stored preference from settings).

- [x] **Step 3: Connect Clipboard Action**
On Enter press, write clean code to clipboard via `arboard` and hide popup window.

---

### Task 9: System Tray & Single Instance Guard

**Files:**
- Create: `crates/snippet-app/src/tray.rs`
- Modify: `crates/snippet-app/src/main.rs`

- [x] **Step 1: Implement Single Instance Lock**
Use a named Windows mutex to detect if an instance is already running. If so, signal and raise existing window.

- [x] **Step 2: Implement System Tray Icon**
Add tray icon with menu items: "Open SnippetAI", "Quick Paste", "Quit". Intercept window close event to hide to tray.

---

### Task 10: Settings Modal & AI Grouping Integration

**Files:**
- Create: `crates/snippet-app/ui/components/settings_modal.slint`
- Create: `crates/snippet-app/ui/components/ai_modal.slint`

- [x] **Step 1: Implement Settings Modal**
Theme selector (Default Zinc, Hacker Red, Ocean Blue, Cyberpunk 2077), AI Provider & API Key input, global hotkey rebind.

- [x] **Step 2: Implement AI Grouping Modal**
Trigger `snippet_core::ai::group_snippets`, display category preview diff, and execute `apply_groups` transaction upon confirmation.

---

### Task 11: Production Verification & Cutover

**Files:**
- Manual testing & benchmarks

- [ ] **Step 1: Verify Against Real Production Data**
Point application to real `%APPDATA%\com.snippets.app\snippets.db`. Verify:
  - All existing snippets, tags, dates, and languages load correctly.
  - All existing pasted images load without broken links.
  - New snippets created save properly.
- [ ] **Step 2: Benchmark Performance & Memory**
Verify RAM usage is <30 MB (vs 200MB+ in WebView2).
Verify cold start time is <50 ms.
- [ ] **Step 3: Document Build & Release Instructions**
Update documentation for `cargo build --release -p snippet-app`.
