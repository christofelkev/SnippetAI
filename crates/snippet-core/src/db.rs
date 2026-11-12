use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use crate::models::Snippet;

pub struct Database {
    conn: Mutex<Connection>,
}

pub fn current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

pub fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn init_db(app_dir: &Path) -> Result<Connection, rusqlite::Error> {
    std::fs::create_dir_all(app_dir).unwrap_or_default();
    let db_path = app_dir.join("snippets.db");
    let conn = Connection::open(db_path)?;
    setup_schema(&conn)?;
    Ok(conn)
}

pub fn setup_schema(conn: &Connection) -> Result<(), rusqlite::Error> {
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

    Ok(())
}

impl Database {
    pub fn new(conn: Connection) -> Self {
        Self {
            conn: Mutex::new(conn),
        }
    }

    pub fn open(app_dir: &Path) -> Result<Self, rusqlite::Error> {
        let conn = init_db(app_dir)?;
        Ok(Self::new(conn))
    }

    pub fn get_snippets(&self) -> Result<Vec<Snippet>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, content, group_name, created_at, updated_at, language FROM snippets ORDER BY created_at DESC"
        )?;
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
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(snippets)
    }

    pub fn add_snippet(
        &self,
        title: &str,
        content: &str,
        group_name: Option<&str>,
        language: Option<&str>,
    ) -> Result<Snippet, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = current_timestamp();
        let snippet = Snippet {
            id: generate_id(),
            title: title.to_string(),
            content: content.to_string(),
            group_name: group_name.unwrap_or_default().to_string(),
            created_at: now,
            updated_at: now,
            language: language.unwrap_or_default().to_string(),
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
        )?;

        Ok(snippet)
    }

    pub fn update_snippet(
        &self,
        id: &str,
        title: Option<&str>,
        content: Option<&str>,
        group_name: Option<&str>,
        language: Option<&str>,
    ) -> Result<Snippet, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let updated_at = current_timestamp();

        if let Some(t) = title {
            conn.execute(
                "UPDATE snippets SET title = ?1, updated_at = ?2 WHERE id = ?3",
                params![t, updated_at, id],
            )?;
        }
        if let Some(c) = content {
            conn.execute(
                "UPDATE snippets SET content = ?1, updated_at = ?2 WHERE id = ?3",
                params![c, updated_at, id],
            )?;
        }
        if let Some(g) = group_name {
            conn.execute(
                "UPDATE snippets SET group_name = ?1, updated_at = ?2 WHERE id = ?3",
                params![g, updated_at, id],
            )?;
        }
        if let Some(l) = language {
            conn.execute(
                "UPDATE snippets SET language = ?1, updated_at = ?2 WHERE id = ?3",
                params![l, updated_at, id],
            )?;
        }

        let mut stmt = conn.prepare(
            "SELECT id, title, content, group_name, created_at, updated_at, language FROM snippets WHERE id = ?1"
        )?;

        stmt.query_row(params![id], |row| {
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
    }

    pub fn delete_snippet(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn search_snippets(&self, query: &str) -> Result<Vec<Snippet>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let like_query = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT id, title, content, group_name, created_at, updated_at, language FROM snippets WHERE title LIKE ?1 OR content LIKE ?2 ORDER BY created_at DESC"
        )?;
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
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(snippets)
    }

    pub fn apply_groups(&self, groups: &[(String, String)]) -> Result<(), rusqlite::Error> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let updated_at = current_timestamp();

        {
            let mut stmt = tx.prepare("UPDATE snippets SET group_name = ?1, updated_at = ?2 WHERE id = ?3")?;
            for (id, group_name) in groups {
                stmt.execute(params![group_name, updated_at, id])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        stmt.query_row(params![key], |row| row.get(0)).optional()
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crud_and_search() {
        let conn = Connection::open_in_memory().unwrap();
        setup_schema(&conn).unwrap();
        let db = Database::new(conn);

        // Add
        let s1 = db.add_snippet("Docker Build", "docker build -t test .", Some("DOCKER"), Some("bash")).unwrap();
        assert_eq!(s1.title, "Docker Build");
        assert_eq!(s1.group_name, "DOCKER");
        assert_eq!(s1.language, "bash");

        // List
        let list = db.get_snippets().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, s1.id);

        // Update
        let updated = db.update_snippet(&s1.id, Some("Docker Build & Run"), None, None, Some("sh")).unwrap();
        assert_eq!(updated.title, "Docker Build & Run");
        assert_eq!(updated.language, "sh");

        // Search
        let found = db.search_snippets("Build").unwrap();
        assert_eq!(found.len(), 1);
        let not_found = db.search_snippets("Kubernetes").unwrap();
        assert_eq!(not_found.len(), 0);

        // Apply groups
        db.apply_groups(&[(s1.id.clone(), "CONTAINER".to_string())]).unwrap();
        let updated_group = db.get_snippets().unwrap();
        assert_eq!(updated_group[0].group_name, "CONTAINER");

        // Settings
        db.set_setting("app_theme", "theme-cyberpunk").unwrap();
        let theme = db.get_setting("app_theme").unwrap();
        assert_eq!(theme, Some("theme-cyberpunk".to_string()));

        // Delete
        db.delete_snippet(&s1.id).unwrap();
        assert_eq!(db.get_snippets().unwrap().len(), 0);
    }
}
