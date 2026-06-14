use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub title: String,
    pub content: String,
    pub group_name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

struct AppState {
    db: Mutex<Connection>,
}

fn init_db(app_dir: &std::path::Path) -> Result<Connection, rusqlite::Error> {
    std::fs::create_dir_all(app_dir).unwrap_or_default();
    let db_path = app_dir.join("snippets.db");
    let conn = Connection::open(db_path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS snippets (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            content     TEXT NOT NULL,
            group_name  TEXT NOT NULL DEFAULT '',
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    Ok(conn)
}

fn current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[tauri::command]
fn get_snippets(state: tauri::State<AppState>) -> Result<Vec<Snippet>, String> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, title, content, group_name, created_at, updated_at FROM snippets ORDER BY created_at DESC")
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
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(snippets)
}

#[tauri::command]
fn add_snippet(
    title: String,
    content: String,
    group_name: Option<String>,
    state: tauri::State<AppState>,
) -> Result<Snippet, String> {
    let conn = state.db.lock().unwrap();
    let snippet = Snippet {
        id: generate_id(),
        title,
        content,
        group_name: group_name.unwrap_or_default(),
        created_at: current_timestamp(),
        updated_at: current_timestamp(),
    };

    conn.execute(
        "INSERT INTO snippets (id, title, content, group_name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            snippet.id,
            snippet.title,
            snippet.content,
            snippet.group_name,
            snippet.created_at,
            snippet.updated_at
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(snippet)
}

#[tauri::command]
fn update_snippet(
    id: String,
    title: Option<String>,
    content: Option<String>,
    group_name: Option<String>,
    state: tauri::State<AppState>,
) -> Result<Snippet, String> {
    let conn = state.db.lock().unwrap();
    let updated_at = current_timestamp();

    if let Some(t) = &title {
        conn.execute(
            "UPDATE snippets SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![t, updated_at, id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(c) = &content {
        conn.execute(
            "UPDATE snippets SET content = ?1, updated_at = ?2 WHERE id = ?3",
            params![c, updated_at, id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(g) = &group_name {
        conn.execute(
            "UPDATE snippets SET group_name = ?1, updated_at = ?2 WHERE id = ?3",
            params![g, updated_at, id],
        ).map_err(|e| e.to_string())?;
    }

    let mut stmt = conn
        .prepare("SELECT id, title, content, group_name, created_at, updated_at FROM snippets WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    
    let snippet = stmt.query_row(params![id], |row| {
        Ok(Snippet {
            id: row.get(0)?,
            title: row.get(1)?,
            content: row.get(2)?,
            group_name: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    Ok(snippet)
}

#[tauri::command]
fn delete_snippet(id: String, state: tauri::State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn search_snippets(query: String, state: tauri::State<AppState>) -> Result<Vec<Snippet>, String> {
    let conn = state.db.lock().unwrap();
    let like_query = format!("%{}%", query);
    let mut stmt = conn
        .prepare("SELECT id, title, content, group_name, created_at, updated_at FROM snippets WHERE title LIKE ?1 OR content LIKE ?2 ORDER BY created_at DESC")
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
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(snippets)
}

#[tauri::command]
fn apply_groups(groups: Vec<(String, String)>, state: tauri::State<AppState>) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let updated_at = current_timestamp();
    
    {
        let mut stmt = tx.prepare("UPDATE snippets SET group_name = ?1, updated_at = ?2 WHERE id = ?3").map_err(|e| e.to_string())?;
        for (id, group_name) in groups {
            stmt.execute(params![group_name, updated_at, id]).map_err(|e| e.to_string())?;
        }
    }
    
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_setting(key: String, state: tauri::State<AppState>) -> Result<Option<String>, String> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1").map_err(|e| e.to_string())?;
    let value: Option<String> = stmt.query_row(params![key], |row| row.get(0)).optional().map_err(|e| e.to_string())?;
    Ok(value)
}

#[tauri::command]
fn set_setting(key: String, value: String, state: tauri::State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let db = init_db(&app_dir).expect("Failed to initialize database");
            app.manage(AppState {
                db: Mutex::new(db),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_snippets,
            add_snippet,
            update_snippet,
            delete_snippet,
            search_snippets,
            apply_groups,
            get_setting,
            set_setting
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
