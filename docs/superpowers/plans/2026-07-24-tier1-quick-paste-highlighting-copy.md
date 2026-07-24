# SnippetAI Tier 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add quick-paste popup (global hotkey + tray), per-snippet syntax highlighting, and clean image-free copy to SnippetAI.

**Architecture:** Frontend picks a React root by window label (`main` → `App`, `quickpaste` → `QuickPaste`). A global hotkey (JS-side, reconfigurable in Settings) shows a small always-on-top `quickpaste` window that copies a snippet to the clipboard. The app hides to a system tray on close so the hotkey keeps working. Code blocks render highlighted (highlight.js) when not being edited; each snippet stores an optional `language`. Copy strips inline image markdown.

**Tech Stack:** Tauri v2 (Rust), React 19 + TypeScript, Tailwind v4, SQLite (`rusqlite`), highlight.js, Vitest, `tauri-plugin-global-shortcut`, `tauri-plugin-clipboard-manager`.

## Global Constraints

- Tauri crate features must include `protocol-asset` (existing) and `tray-icon` (new).
- Default global hotkey accelerator: `CmdOrCtrl+Shift+Space`, persisted in settings key `global_hotkey`.
- Copy (DetailView button and QuickPaste Enter) always copies `stripImageMarkdown(content)` — never raw content.
- New `language` column: `TEXT NOT NULL DEFAULT ''`; empty string means "auto-detect".
- Snippet SELECT column order everywhere: `id, title, content, group_name, created_at, updated_at, language` (language = index 6).
- highlight.js theme: `highlight.js/styles/github-dark.css`.
- Every task ends green: `npx tsc --noEmit` for TS tasks, `cargo check` (run inside `src-tauri`) for Rust tasks, `npm test` for tasks with unit tests.
- Branch: `tier1-quick-paste-highlighting-copy` (already checked out).

---

### Task 1: Clean copy (`stripImageMarkdown`) + Vitest setup

**Files:**
- Create: `src/lib/content.ts`
- Create: `src/lib/content.test.ts`
- Modify: `package.json` (devDeps + scripts)
- Modify: `src/components/DetailView.tsx` (handleCopy)

**Interfaces:**
- Produces: `stripImageMarkdown(content: string): string` — removes every `![alt](url)` match, collapses 3+ newlines to 2, trims.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Add test scripts to package.json**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write the failing test**

Create `src/lib/content.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stripImageMarkdown } from './content';

describe('stripImageMarkdown', () => {
  it('removes a single image markdown', () => {
    expect(
      stripImageMarkdown('a\n![Pasted Image](http://asset.localhost/x.png)\nb')
    ).toBe('a\n\nb');
  });

  it('collapses extra blank lines left behind', () => {
    expect(stripImageMarkdown('code\n\n![i](u)\n\nmore')).toBe('code\n\nmore');
  });

  it('leaves plain code untouched', () => {
    expect(stripImageMarkdown('docker build -t app .')).toBe('docker build -t app .');
  });

  it('removes multiple images', () => {
    expect(stripImageMarkdown('![a](1)x![b](2)y')).toBe('xy');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./content` / `stripImageMarkdown is not a function`.

- [ ] **Step 5: Write minimal implementation**

Create `src/lib/content.ts`:

```ts
const IMAGE_MARKDOWN = /!\[[^\]]*\]\([^)]+\)/g;

/** Remove inline image markdown so only code lands on the clipboard. */
export function stripImageMarkdown(content: string): string {
  return content
    .replace(IMAGE_MARKDOWN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS (4 tests).

- [ ] **Step 7: Wire into DetailView copy**

In `src/components/DetailView.tsx`:
- Add import near the top (after the existing imports):

```ts
import { stripImageMarkdown } from '../lib/content';
```

- Change `handleCopy` so the clipboard write uses the stripped content:

```ts
const handleCopy = async () => {
  await writeText(stripImageMarkdown(content));
  setIsCopied(true);
  onCopy();
  setTimeout(() => setIsCopied(false), 2000);
};
```

- [ ] **Step 8: Verify types**

Run: `npx tsc --noEmit`
Expected: no output (success).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/lib/content.ts src/lib/content.test.ts src/components/DetailView.tsx
git commit -m "feat: clean image-free copy + vitest setup"
```

---

### Task 2: Backend `language` column + plumbing (Rust)

**Files:**
- Modify: `src-tauri/src/lib.rs` (struct, migration, all snippet SQL)

**Interfaces:**
- Produces: `Snippet` now has `language: String`. `update_snippet` accepts a new optional `language: Option<String>` argument. New snippets are created with `language = ""`.

> Note: no Rust unit-test harness exists in this project; this task is verified by `cargo check` plus a manual DB check. That is intentional for the DB/native layer.

- [ ] **Step 1: Add `language` to the `Snippet` struct**

In `src-tauri/src/lib.rs`, update the struct (around line 7):

```rust
#[derive(Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub title: String,
    pub content: String,
    pub group_name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub language: String,
}
```

- [ ] **Step 2: Add the migration in `init_db`**

In `init_db`, immediately before `Ok(conn)`, add:

```rust
    // Migration: add `language` column if this DB predates it.
    let mut col_stmt = conn.prepare("PRAGMA table_info(snippets)")?;
    let has_language = col_stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .any(|name| name == "language");
    drop(col_stmt);
    if !has_language {
        conn.execute(
            "ALTER TABLE snippets ADD COLUMN language TEXT NOT NULL DEFAULT ''",
            [],
        )?;
    }
```

- [ ] **Step 3: Update `get_snippets` SELECT + row mapping**

Change the query string to include `language` and add `row.get(6)`:

```rust
    let mut stmt = conn
        .prepare("SELECT id, title, content, group_name, created_at, updated_at, language FROM snippets ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let snippets = stmt
        .query_map([], |row| {
            Ok(Snippet {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                group_name: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                language: row.get(6)?,
            })
        })
```

- [ ] **Step 4: Update `add_snippet` (default language + INSERT)**

In `add_snippet`, set `language` on the struct literal and add it to the INSERT:

```rust
    let snippet = Snippet {
        id: generate_id(),
        title,
        content,
        group_name: group_name.unwrap_or_default(),
        created_at: current_timestamp(),
        updated_at: current_timestamp(),
        language: String::new(),
    };

    conn.execute(
        "INSERT INTO snippets (id, title, content, group_name, created_at, updated_at, language) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            snippet.id,
            snippet.title,
            snippet.content,
            snippet.group_name,
            snippet.created_at,
            snippet.updated_at,
            snippet.language
        ],
    )
    .map_err(|e| e.to_string())?;
```

- [ ] **Step 5: Update `update_snippet` signature, add language UPDATE, fix re-select**

Add the `language` parameter (place it before `state`):

```rust
#[tauri::command]
fn update_snippet(
    id: String,
    title: Option<String>,
    content: Option<String>,
    group_name: Option<String>,
    language: Option<String>,
    state: tauri::State<AppState>,
) -> Result<Snippet, String> {
```

After the existing `group_name` update block, add:

```rust
    if let Some(l) = &language {
        conn.execute(
            "UPDATE snippets SET language = ?1, updated_at = ?2 WHERE id = ?3",
            params![l, updated_at, id],
        ).map_err(|e| e.to_string())?;
    }
```

Update the re-select statement and mapping to include `language`:

```rust
    let mut stmt = conn
        .prepare("SELECT id, title, content, group_name, created_at, updated_at, language FROM snippets WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let snippet = stmt.query_row(params![id], |row| {
        Ok(Snippet {
            id: row.get(0)?,
            title: row.get(1)?,
            content: row.get(2)?,
            group_name: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            language: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
```

- [ ] **Step 6: Update `search_snippets` SELECT + row mapping**

```rust
    let mut stmt = conn
        .prepare("SELECT id, title, content, group_name, created_at, updated_at, language FROM snippets WHERE title LIKE ?1 OR content LIKE ?2 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let snippets = stmt
        .query_map(params![like_query, like_query], |row| {
            Ok(Snippet {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                group_name: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                language: row.get(6)?,
            })
        })
```

- [ ] **Step 7: Verify it compiles**

Run inside `src-tauri`: `cargo check`
Expected: `Finished` with no errors.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add language column + backend plumbing"
```

---

### Task 3: Frontend `language` type plumbing (additive)

**Files:**
- Modify: `src/lib/tauri.ts` (interface + updateSnippet signature)
- Modify: `src/hooks/useSnippets.ts` (updateSnippet wrapper)

**Interfaces:**
- Consumes: backend `update_snippet` now takes `language`.
- Produces: `Snippet.language: string`; `tauriApi.updateSnippet(id, title?, content?, groupName?, language?)`; `useSnippets().updateSnippet(id, title?, content?, groupName?, language?)`.

> These changes are additive (new optional params, new field populated by the backend), so `tsc` stays green without touching call sites yet.

- [ ] **Step 1: Add `language` to the Snippet interface**

In `src/lib/tauri.ts`:

```ts
export interface Snippet {
  id: string;
  title: string;
  content: string;
  group_name: string;
  created_at: number;
  updated_at: number;
  language: string;
}
```

- [ ] **Step 2: Extend `updateSnippet` in tauriApi**

```ts
  updateSnippet: (id: string, title?: string, content?: string, groupName?: string, language?: string) =>
    invoke<Snippet>('update_snippet', { id, title, content, groupName, language }),
```

- [ ] **Step 3: Extend the `useSnippets` updateSnippet wrapper**

In `src/hooks/useSnippets.ts`:

```ts
  const updateSnippet = async (id: string, title?: string, content?: string, groupName?: string, language?: string) => {
    await tauriApi.updateSnippet(id, title, content, groupName, language);
    fetchSnippets();
  };
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tauri.ts src/hooks/useSnippets.ts
git commit -m "feat: thread language through frontend api"
```

---

### Task 4: Syntax highlighting + language dropdown

**Files:**
- Modify: `package.json` (highlight.js dep)
- Modify: `src/main.tsx` (import theme CSS)
- Modify: `src/components/ContentEditor.tsx` (view/edit toggle + highlight)
- Modify: `src/components/DetailView.tsx` (language dropdown, pass `language`, update onUpdate signature)
- Modify: `src/App.tsx` (pass language through onUpdate)

**Interfaces:**
- Consumes: `Snippet.language`, `useSnippets().updateSnippet(..., language?)`.
- Produces: `ContentEditor` accepts a `language: string` prop; `DetailView` `onUpdate` signature becomes `(title: string, content: string, group: string, language: string) => void`.

- [ ] **Step 1: Install highlight.js**

Run: `npm install highlight.js`

- [ ] **Step 2: Import the highlight theme globally**

In `src/main.tsx`, add after `import "./App.css";`:

```ts
import "highlight.js/styles/github-dark.css";
```

- [ ] **Step 3: Add highlight helper + view/edit toggle to ContentEditor**

In `src/components/ContentEditor.tsx`:

- Add imports at the top:

```ts
import hljs from 'highlight.js';
```

- Add these helpers above the component (after the `blocksToString` function):

```ts
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightCode(code: string, language: string): string {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}
```

- Change the props interface and signature to accept `language`:

```ts
interface ContentEditorProps {
  content: string;
  language: string;
  onChange: (content: string) => void;
  onSave: () => void;
}

export default function ContentEditor({ content, language, onChange, onSave }: ContentEditorProps) {
```

- Add editing state near the other hooks (after the `blocks` state):

```ts
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
```

- Replace the text-block branch of the `blocks.map(...)` (the `block.type === 'text' ? (...)` JSX) with a view/edit toggle. The editing branch keeps the current textarea; the view branch renders highlighted code:

```tsx
        block.type === 'text' ? (
          editingIndex === i ? (
            <textarea
              key={`text-${i}`}
              ref={el => {
                if (el) {
                  textareaRefs.current.set(i, el);
                  autoResize(el);
                }
              }}
              autoFocus
              value={block.value}
              onChange={e => {
                updateTextBlock(i, e.target.value);
                autoResize(e.target);
              }}
              onBlur={() => {
                setEditingIndex(null);
                onSave();
              }}
              onPaste={e => handlePaste(e, i)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 resize-none transition-colors"
              placeholder="Type your snippet here... (Ctrl+V to paste images)"
            />
          ) : (
            <pre
              key={`text-${i}`}
              onClick={() => setEditingIndex(i)}
              className="w-full min-h-[60px] bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm overflow-x-auto cursor-text hover:border-zinc-700 transition-colors"
            >
              {block.value.trim() ? (
                <code
                  className="hljs bg-transparent p-0 font-mono"
                  dangerouslySetInnerHTML={{ __html: highlightCode(block.value, language) }}
                />
              ) : (
                <span className="text-zinc-600 font-mono">Click to edit…</span>
              )}
            </pre>
          )
        ) : (
```

- [ ] **Step 4: Add the language dropdown + pass props in DetailView**

In `src/components/DetailView.tsx`:

- Add a languages constant above the component:

```ts
const LANGUAGES = ['', 'bash', 'javascript', 'typescript', 'python', 'json', 'sql', 'rust', 'go', 'html', 'css', 'yaml', 'markdown'];
```

- Update the props interface `onUpdate` signature:

```ts
  onUpdate: (title: string, content: string, group: string, language: string) => void;
```

- Add `language` state and sync it (mirror the existing `content` state pattern):

```ts
  const [language, setLanguage] = useState(snippet.language);
```

Add `setLanguage(snippet.language);` inside the existing `useEffect(() => { ... }, [snippet])` block.

- Update `handleSave` to include language:

```ts
  const handleSave = () => {
    if (
      title !== snippet.title ||
      content !== snippet.content ||
      group !== snippet.group_name ||
      language !== snippet.language
    ) {
      onUpdate(title, content, group, language);
    }
  };
```

- Add a change handler that persists immediately when the dropdown changes:

```ts
  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    onUpdate(title, content, group, value);
  };
```

- In the header's action row (the `<div className="flex items-center gap-2">` that holds Copy/Delete), add the dropdown as the first child:

```tsx
          <select
            value={language}
            onChange={e => handleLanguageChange(e.target.value)}
            title="Snippet language"
            className="bg-zinc-900 border border-zinc-800 rounded-md px-2 py-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
          >
            {LANGUAGES.map(l => (
              <option key={l} value={l}>{l === '' ? 'Auto' : l}</option>
            ))}
          </select>
```

- Pass `language` to `ContentEditor`:

```tsx
        <ContentEditor
          content={content}
          language={language}
          onChange={setContent}
          onSave={handleSave}
        />
```

- [ ] **Step 5: Update App.tsx onUpdate to pass language**

In `src/App.tsx`, update the DetailView `onUpdate` prop:

```tsx
            onUpdate={(title, content, group, language) => snippetsState.updateSnippet(selectedSnippet.id, title, content, group, language)}
```

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: no output (success).

- [ ] **Step 7: Manual check**

Run: `npm run tauri dev`. Open a snippet: code shows highlighted; clicking it turns it into an editable textarea; blur re-highlights and saves; changing the language dropdown changes the highlighting; inline images still render.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/main.tsx src/components/ContentEditor.tsx src/components/DetailView.tsx src/App.tsx
git commit -m "feat: syntax highlighting + per-snippet language"
```

---

### Task 5: Tray, hide-to-tray, second window, global-shortcut plugin (Rust)

**Files:**
- Modify: `src-tauri/Cargo.toml` (features + plugin dep)
- Modify: `src-tauri/tauri.conf.json` (second window)
- Modify: `src-tauri/capabilities/default.json` (windows + permissions)
- Modify: `src-tauri/src/lib.rs` (plugin, tray, window-close handler)

**Interfaces:**
- Produces: a hidden `quickpaste` webview window; a tray icon with `open` / `quickpaste` / `quit` menu items; the `main` window hides instead of closing; the global-shortcut plugin is initialized so the frontend can register shortcuts.

> Verified by `cargo check` + manual run. No Rust unit tests.

- [ ] **Step 1: Enable tray feature + add the global-shortcut plugin**

In `src-tauri/Cargo.toml`, update the `tauri` dependency and add the plugin:

```toml
tauri = { version = "2", features = ["protocol-asset", "tray-icon"] }
tauri-plugin-global-shortcut = "2"
```

- [ ] **Step 2: Declare the quickpaste window**

In `src-tauri/tauri.conf.json`, replace the `app.windows` array with both windows:

```json
    "windows": [
      {
        "label": "main",
        "title": "SnippetAI",
        "width": 1000,
        "height": 700
      },
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
    ],
```

- [ ] **Step 3: Grant capabilities for both windows**

Replace `src-tauri/capabilities/default.json` contents with:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the app windows",
  "windows": [
    "main",
    "quickpaste"
  ],
  "permissions": [
    "core:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "core:event:default",
    "opener:default",
    "clipboard-manager:default",
    "clipboard-manager:allow-write-text",
    "clipboard-manager:allow-read-image",
    "global-shortcut:default",
    "http:default",
    {
      "identifier": "http:default",
      "allow": [{"url": "https://**"}, {"url": "http://**"}]
    }
  ]
}
```

- [ ] **Step 4: Register the plugin, build the tray, and hide-to-tray**

In `src-tauri/src/lib.rs`, update the imports line:

```rust
use tauri::{
    Manager,
    WindowEvent,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};
```

Then replace the entire `run()` builder chain with:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let db = init_db(&app_dir).expect("Failed to initialize database");
            app.manage(AppState {
                db: Mutex::new(db),
            });

            // System tray
            let open_i = MenuItem::with_id(app, "open", "Open SnippetAI", true, None::<&str>)?;
            let quick_i = MenuItem::with_id(app, "quickpaste", "Quick Paste", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &quick_i, &quit_i])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("SnippetAI")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quickpaste" => {
                        if let Some(w) = app.get_webview_window("quickpaste") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_snippets,
            add_snippet,
            update_snippet,
            delete_snippet,
            search_snippets,
            apply_groups,
            get_setting,
            set_setting,
            save_image_to_disk,
            read_image_from_disk
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Verify it compiles**

Run inside `src-tauri`: `cargo check`
Expected: `Finished` with no errors.

- [ ] **Step 6: Manual check**

Run: `npm run tauri dev`. A tray icon appears. Closing the main window hides it (app keeps running); tray → "Open SnippetAI" brings it back; tray → "Quit" exits. (The quickpaste window is wired in the next task.)

- [ ] **Step 7: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json src-tauri/capabilities/default.json src-tauri/src/lib.rs
git commit -m "feat: system tray, hide-to-tray, quickpaste window + global-shortcut plugin"
```

---

### Task 6: QuickPaste component + window-label routing

**Files:**
- Create: `src/lib/quickpaste.ts`
- Create: `src/lib/quickpaste.test.ts`
- Create: `src/components/QuickPaste.tsx`
- Modify: `src/main.tsx` (route by window label)

**Interfaces:**
- Consumes: `tauriApi.getSnippets()`, `stripImageMarkdown`, `getCurrentWebviewWindow()`.
- Produces: `filterSnippets(snippets: Snippet[], query: string): Snippet[]`; default-exported `QuickPaste` React component.

- [ ] **Step 1: Write the failing filter test**

Create `src/lib/quickpaste.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterSnippets } from './quickpaste';
import { Snippet } from './tauri';

const mk = (id: string, title: string, content: string): Snippet => ({
  id, title, content, group_name: '', language: '', created_at: 0, updated_at: 0,
});

const data = [
  mk('1', 'Docker build', 'docker build -t app .'),
  mk('2', 'Git reset', 'git reset --hard'),
];

describe('filterSnippets', () => {
  it('returns all snippets for an empty query', () => {
    expect(filterSnippets(data, '  ')).toHaveLength(2);
  });
  it('matches on title, case-insensitively', () => {
    expect(filterSnippets(data, 'DOCKER').map(s => s.id)).toEqual(['1']);
  });
  it('matches on content', () => {
    expect(filterSnippets(data, '--hard').map(s => s.id)).toEqual(['2']);
  });
  it('returns [] when nothing matches', () => {
    expect(filterSnippets(data, 'kubernetes')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./quickpaste`.

- [ ] **Step 3: Implement the filter**

Create `src/lib/quickpaste.ts`:

```ts
import { Snippet } from './tauri';

export function filterSnippets(snippets: Snippet[], query: string): Snippet[] {
  const q = query.trim().toLowerCase();
  if (!q) return snippets;
  return snippets.filter(
    s => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all suites green).

- [ ] **Step 5: Create the QuickPaste component**

Create `src/components/QuickPaste.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { Search } from 'lucide-react';
import { tauriApi, Snippet } from '../lib/tauri';
import { filterSnippets } from '../lib/quickpaste';
import { stripImageMarkdown } from '../lib/content';

export default function QuickPaste() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const win = getCurrentWebviewWindow();

  const results = filterSnippets(snippets, query);

  const load = async () => {
    try {
      setSnippets(await tauriApi.getSnippets());
    } catch (e) {
      console.error('QuickPaste load failed:', e);
    }
  };

  useEffect(() => {
    load();
    inputRef.current?.focus();
    const unlisten = win.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        load();
        setQuery('');
        setActive(0);
        inputRef.current?.focus();
      } else {
        win.hide();
      }
    });
    return () => { unlisten.then(f => f()); };
  }, []);

  useEffect(() => { setActive(0); }, [query]);

  const choose = async (s: Snippet) => {
    await writeText(stripImageMarkdown(s.content));
    await win.hide();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      win.hide();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-zinc-800">
        <Search className="w-4 h-4 text-zinc-500" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search snippets… (Enter to copy, Esc to close)"
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder-zinc-600"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-600">No snippets found</div>
        ) : (
          results.map((s, i) => (
            <button
              key={s.id}
              onClick={() => choose(s)}
              onMouseEnter={() => setActive(i)}
              className={`w-full text-left px-4 py-2.5 border-b border-zinc-800/60 ${
                i === active ? 'bg-indigo-600/20' : 'hover:bg-zinc-800/40'
              }`}
            >
              <div className="text-sm font-medium text-zinc-200 truncate">{s.title}</div>
              <div className="text-xs text-zinc-500 truncate font-mono">
                {stripImageMarkdown(s.content).split('\n')[0]}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Route by window label in main.tsx**

Replace `src/main.tsx` with:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import QuickPaste from "./components/QuickPaste";
import "./App.css";
import "highlight.js/styles/github-dark.css";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const Root = getCurrentWebviewWindow().label === "quickpaste" ? QuickPaste : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
```

- [ ] **Step 7: Verify types + tests**

Run: `npx tsc --noEmit`
Expected: no output.
Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Manual check**

Run: `npm run tauri dev`. Tray → "Quick Paste" opens the popup; typing filters; ↑/↓ moves selection; Enter copies clean code and hides; Esc hides; clicking outside (focus loss) hides.

- [ ] **Step 9: Commit**

```bash
git add src/lib/quickpaste.ts src/lib/quickpaste.test.ts src/components/QuickPaste.tsx src/main.tsx
git commit -m "feat: quick-paste popup window + filter"
```

---

### Task 7: Global hotkey registration + Settings field

**Files:**
- Create: `src/lib/hotkey.ts`
- Modify: `src/App.tsx` (register on mount + error toast)
- Modify: `src/components/SettingsModal.tsx` (hotkey field + rebind on save)

**Interfaces:**
- Consumes: `@tauri-apps/plugin-global-shortcut` (`register`, `unregister`, `unregisterAll`, `isRegistered`), `WebviewWindow.getByLabel`.
- Produces: `DEFAULT_HOTKEY`, `registerHotkey(accelerator: string): Promise<void>`, `rebindHotkey(accelerator: string): Promise<void>`.

- [ ] **Step 1: Create the hotkey helper**

Create `src/lib/hotkey.ts`:

```ts
import { register, unregister, unregisterAll, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export const DEFAULT_HOTKEY = 'CmdOrCtrl+Shift+Space';

async function showQuickPaste() {
  const win = await WebviewWindow.getByLabel('quickpaste');
  if (win) {
    await win.show();
    await win.setFocus();
  }
}

/** Register a global accelerator, replacing it first if already bound. */
export async function registerHotkey(accelerator: string): Promise<void> {
  if (await isRegistered(accelerator)) {
    await unregister(accelerator);
  }
  await register(accelerator, event => {
    if (event.state === 'Pressed') showQuickPaste();
  });
}

/** Clear any existing bindings and register the given accelerator. */
export async function rebindHotkey(accelerator: string): Promise<void> {
  await unregisterAll();
  await registerHotkey(accelerator);
}
```

- [ ] **Step 2: Register the hotkey on App mount**

In `src/App.tsx`:
- Add imports:

```ts
import { registerHotkey, DEFAULT_HOTKEY } from './lib/hotkey';
```

- Add an effect after the existing shortcut `useEffect` (the `showToast` function is already defined below; move the registration effect below `showToast`, or reference a stable inline handler). Place this effect immediately after the `showToast` definition:

```ts
  useEffect(() => {
    tauriApi.getSetting('global_hotkey').then(hk => {
      registerHotkey(hk || DEFAULT_HOTKEY).catch(() =>
        showToast('Hotkey gagal didaftarkan — mungkin dipakai aplikasi lain')
      );
    });
  }, []);
```

- [ ] **Step 3: Add the hotkey field to Settings**

In `src/components/SettingsModal.tsx`:
- Add imports:

```ts
import { rebindHotkey, DEFAULT_HOTKEY } from '../lib/hotkey';
```

- Add state:

```ts
  const [hotkey, setHotkey] = useState(DEFAULT_HOTKEY);
```

- Add `tauriApi.getSetting('global_hotkey')` to the `Promise.all` load and set it. The load becomes:

```ts
    Promise.all([
      tauriApi.getSetting('ai_provider'),
      tauriApi.getSetting('ai_api_key'),
      tauriApi.getSetting('ai_model'),
      tauriApi.getSetting('app_theme'),
      tauriApi.getSetting('global_hotkey')
    ]).then(([p, k, m, t, hk]) => {
      setProvider(p || 'deepseek');
      setApiKey(k || '');
      setModel(m || '');
      setAppTheme(t || 'theme-default');
      setHotkey(hk || DEFAULT_HOTKEY);
      setLoading(false);
    });
```

- Persist + rebind in `handleSave`:

```ts
  const handleSave = async () => {
    await tauriApi.setSetting('ai_provider', provider);
    await tauriApi.setSetting('ai_api_key', apiKey);
    await tauriApi.setSetting('ai_model', model);
    await tauriApi.setSetting('app_theme', appTheme);
    await tauriApi.setSetting('global_hotkey', hotkey);
    await rebindHotkey(hotkey).catch(() => {});
    onClose();
  };
```

- Add the input to the settings body (after the App Theme block, before the `<hr />`):

```tsx
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Quick-Paste Hotkey</label>
            <input
              type="text"
              value={hotkey}
              onChange={e => setHotkey(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              placeholder="CmdOrCtrl+Shift+Space"
            />
            <p className="text-[10px] text-zinc-500 mt-1">e.g. CmdOrCtrl+Shift+Space, Alt+Space. Restart not required.</p>
          </div>
```

- [ ] **Step 4: Verify types + tests**

Run: `npx tsc --noEmit`
Expected: no output.
Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Manual check**

Run: `npm run tauri dev`. From another app, press `Ctrl+Shift+Space` → the popup appears. Pick a snippet, then `Ctrl+V` in an editor → clean code (no image URLs). Change the hotkey in Settings → Save → the new combo works. Enter a nonsense/occupied combo → the error toast appears on next launch/registration.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hotkey.ts src/App.tsx src/components/SettingsModal.tsx
git commit -m "feat: global quick-paste hotkey + settings binding"
```

---

### Task 8: Final integration verification

**Files:** none (verification only).

- [ ] **Step 1: Full type + test gate**

Run: `npx tsc --noEmit` → clean.
Run: `npm test` → all suites pass.
Run inside `src-tauri`: `cargo check` → clean.

- [ ] **Step 2: End-to-end manual checklist**

Run: `npm run tauri dev` and confirm:
- Global hotkey summons the popup from another app; Enter copies; Ctrl+V pastes clean code.
- Esc and focus-loss hide the popup.
- Closing the main window hides to tray; hotkey still works; tray → Quit exits.
- Changing the hotkey in Settings rebinds; an occupied combo surfaces the error toast.
- Highlighted view renders; click-to-edit works; blur re-highlights and saves; inline images still render; language dropdown changes highlighting.
- Copy button on a snippet with images copies code only.

- [ ] **Step 3: Final commit (if any doc/cleanup remains)**

```bash
git add -A
git commit -m "chore: tier 1 verification" --allow-empty
```

---

## Self-Review Notes

- **Spec coverage:** Quick-paste popup (Tasks 5,6,7) · tray + hide-to-tray (Task 5) · global hotkey default + configurable (Task 7) · highlight-on-view + language column (Tasks 2,3,4) · clean copy in DetailView and QuickPaste (Tasks 1,6). All spec sections map to a task.
- **Type consistency:** `stripImageMarkdown` (Task 1) reused in Tasks 4-context/6. `filterSnippets` defined and consumed in Task 6. `Snippet.language` added in Task 3, consumed in Tasks 4 and 6 test mock. `onUpdate(title, content, group, language)` set in DetailView (Task 4) and matched in App (Task 4). `registerHotkey`/`rebindHotkey`/`DEFAULT_HOTKEY` defined in Task 7 and consumed by App + Settings in the same task.
- **Out of scope (unchanged):** auto-paste, per-block copy, tags/favorites/export, API-key encryption.
