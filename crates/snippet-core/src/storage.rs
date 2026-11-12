use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn get_app_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.snippets.app")
}

pub fn backup_db_if_exists(app_dir: &Path) -> std::io::Result<Option<PathBuf>> {
    let db_path = app_dir.join("snippets.db");
    if db_path.exists() {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let backup_path = app_dir.join(format!("snippets.db.backup_{}", timestamp));
        std::fs::copy(&db_path, &backup_path)?;
        Ok(Some(backup_path))
    } else {
        Ok(None)
    }
}

pub fn save_image_to_disk(bytes: &[u8], app_dir: &Path) -> Result<String, std::io::Error> {
    let images_dir = app_dir.join("images");
    std::fs::create_dir_all(&images_dir)?;
    let id = uuid::Uuid::new_v4().to_string();
    let filename = format!("{}.png", id);
    let file_path = images_dir.join(&filename);
    std::fs::write(&file_path, bytes)?;
    Ok(file_path.to_string_lossy().to_string())
}

pub fn read_image_from_disk(filename: &str, app_dir: &Path) -> Result<Vec<u8>, std::io::Error> {
    let file_path = app_dir.join("images").join(filename);
    std::fs::read(&file_path)
}

pub fn resolve_image_path(url: &str, app_dir: &Path) -> Option<PathBuf> {
    let direct_path = PathBuf::from(url);
    if direct_path.exists() && direct_path.is_file() {
        return Some(direct_path);
    }

    let decoded = url
        .replace("%5C", "\\")
        .replace("%2F", "/")
        .replace("%3A", ":")
        .replace("%20", " ");

    let decoded_path = PathBuf::from(&decoded);
    if decoded_path.exists() && decoded_path.is_file() {
        return Some(decoded_path);
    }

    if let Some(filename) = decoded
        .split(&['/', '\\'][..])
        .filter(|s| s.ends_with(".png") || s.ends_with(".jpg") || s.ends_with(".jpeg"))
        .last()
    {
        let in_images = app_dir.join("images").join(filename);
        if in_images.exists() {
            return Some(in_images);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backup_non_existent_db() {
        let temp = std::env::temp_dir().join(format!("snippet_test_backup_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let result = backup_db_if_exists(&temp).unwrap();
        assert!(result.is_none());
        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn test_backup_existing_db() {
        let temp = std::env::temp_dir().join(format!("snippet_test_backup_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let db_file = temp.join("snippets.db");
        std::fs::write(&db_file, b"sqlite data").unwrap();

        let result = backup_db_if_exists(&temp).unwrap();
        assert!(result.is_some());
        let backup_path = result.unwrap();
        assert!(backup_path.exists());
        assert_eq!(std::fs::read(&backup_path).unwrap(), b"sqlite data");
        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn test_save_and_read_image() {
        let temp = std::env::temp_dir().join(format!("snippet_test_img_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp).unwrap();
        let test_bytes = b"fake-png-data";
        let saved_path_str = save_image_to_disk(test_bytes, &temp).unwrap();
        let path = PathBuf::from(&saved_path_str);
        assert!(path.exists());

        let filename = path.file_name().unwrap().to_str().unwrap();
        let read_bytes = read_image_from_disk(filename, &temp).unwrap();
        assert_eq!(read_bytes, test_bytes);

        // Test resolve_image_path with Tauri's URL format
        let tauri_url = format!("http://asset.localhost/C%3A%5CUsers%5Ctest%5Cimages%5C{}", filename);
        let resolved = resolve_image_path(&tauri_url, &temp);
        assert_eq!(resolved, Some(path));

        let _ = std::fs::remove_dir_all(&temp);
    }
}
