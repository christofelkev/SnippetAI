use snippet_core::content::strip_image_markdown;

pub fn copy_clean_code(content: &str) -> Result<(), String> {
    let clean = strip_image_markdown(content);
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(clean).map_err(|e| e.to_string())
}
