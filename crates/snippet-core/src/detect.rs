//! Language auto-detection engine for SnippetAI.

/// Detects the programming language of a snippet based on content heuristics.
/// Returns one of the canonical language identifiers (e.g. "rust", "python", "bash", "json", etc.),
/// or an empty string if no confident match is found.
pub fn detect_language(content: &str) -> &'static str {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return "";
    }

    // 1. Shebang / first line check
    let first_line = trimmed.lines().next().unwrap_or("").trim();
    if first_line.starts_with("#!") {
        if first_line.contains("bash") || first_line.contains("sh") || first_line.contains("zsh") {
            return "bash";
        }
        if first_line.contains("python") {
            return "python";
        }
        if first_line.contains("node") {
            return "javascript";
        }
        if first_line.contains("perl") {
            return "bash";
        }
    }

    // 2. Strict JSON check
    if (trimmed.starts_with('{') && trimmed.ends_with('}'))
        || (trimmed.starts_with('[') && trimmed.ends_with(']'))
    {
        if serde_json::from_str::<serde_json::Value>(trimmed).is_ok() {
            return "json";
        }
    }

    // 3. HTML / XML check
    let lower = trimmed.to_lowercase();
    if lower.contains("<!doctype html")
        || lower.starts_with("<html")
        || (lower.contains("<head") && lower.contains("</head>"))
        || (lower.contains("<body") && lower.contains("</body>"))
        || (lower.contains("<div") && lower.contains("</div>"))
        || (lower.contains("<span") && lower.contains("</span>"))
        || (lower.contains("<p>") && lower.contains("</p>"))
    {
        return "html";
    }

    // 4. SQL keywords check
    let upper = trimmed.to_uppercase();
    if (upper.contains("SELECT ") && (upper.contains(" FROM ") || upper.contains(" WHERE ")))
        || upper.starts_with("SELECT ")
        || upper.starts_with("INSERT INTO ")
        || upper.contains("INSERT INTO ")
        || upper.starts_with("CREATE TABLE ")
        || upper.contains("CREATE TABLE ")
        || upper.starts_with("ALTER TABLE ")
        || (upper.contains("UPDATE ") && upper.contains(" SET "))
        || upper.starts_with("DELETE FROM ")
    {
        return "sql";
    }

    // 5. CSS check
    if (trimmed.contains('{') && trimmed.contains('}'))
        && (trimmed.contains("margin:")
            || trimmed.contains("padding:")
            || trimmed.contains("display: flex")
            || trimmed.contains("background-color:")
            || trimmed.contains("font-family:")
            || trimmed.contains("border-radius:"))
    {
        return "css";
    }

    // 6. Markdown check
    if trimmed.starts_with("# ")
        || trimmed.starts_with("## ")
        || trimmed.starts_with("### ")
        || trimmed.contains("\n# ")
        || trimmed.contains("\n## ")
        || trimmed.starts_with("```")
    {
        return "markdown";
    }

    // 7. Rust check
    let mut rust_score = 0;
    if trimmed.contains("fn main()") { rust_score += 10; }
    if trimmed.contains("pub fn ") || trimmed.contains("fn ") { rust_score += 4; }
    if trimmed.contains("let mut ") { rust_score += 8; }
    if trimmed.contains("println!") || trimmed.contains("eprintln!") || trimmed.contains("format!") { rust_score += 6; }
    if trimmed.contains("use std::") { rust_score += 8; }
    if trimmed.contains("pub struct ") || trimmed.contains("struct ") { rust_score += 4; }
    if trimmed.contains("impl ") { rust_score += 6; }
    if trimmed.contains("i32") || trimmed.contains("u64") || trimmed.contains("usize") || trimmed.contains("&str") { rust_score += 5; }
    if trimmed.contains("#[derive(") { rust_score += 10; }
    if trimmed.contains("-> Result<") || trimmed.contains("-> Option<") { rust_score += 6; }

    // 8. Go check
    let mut go_score = 0;
    if trimmed.starts_with("package ") || trimmed.contains("\npackage ") { go_score += 10; }
    if trimmed.contains("func main()") { go_score += 10; }
    if trimmed.contains("func ") { go_score += 5; }
    if trimmed.contains("fmt.Println") || trimmed.contains("fmt.Printf") { go_score += 8; }
    if trimmed.contains("import (") { go_score += 4; }

    // 9. Python check
    let mut python_score = 0;
    if trimmed.contains("def ") && trimmed.contains(':') { python_score += 6; }
    if trimmed.contains("import ") { python_score += 3; }
    if trimmed.contains("from ") && trimmed.contains(" import ") { python_score += 6; }
    if trimmed.contains("class ") && trimmed.contains(':') { python_score += 4; }
    if trimmed.contains("elif ") { python_score += 6; }
    if trimmed.contains("print(") { python_score += 3; }
    if trimmed.contains("__init__") || trimmed.contains("self.") { python_score += 8; }
    if trimmed.contains("if __name__ == '__main__':") || trimmed.contains("if __name__ == \"__main__\":") { python_score += 12; }

    // 10. TypeScript / JavaScript check
    let mut ts_score = 0;
    let mut js_score = 0;
    if trimmed.contains("interface ") && trimmed.contains('{') { ts_score += 8; }
    if trimmed.contains("type ") && trimmed.contains('=') { ts_score += 6; }
    if trimmed.contains(": string") || trimmed.contains(": number") || trimmed.contains(": boolean") { ts_score += 8; }
    if trimmed.contains("<T>") || trimmed.contains(": Promise<") { ts_score += 8; }

    if trimmed.contains("const ") { js_score += 3; ts_score += 3; }
    if trimmed.contains("let ") { js_score += 2; ts_score += 2; }
    if trimmed.contains("console.log") { js_score += 5; ts_score += 5; }
    if trimmed.contains("function ") { js_score += 4; ts_score += 4; }
    if trimmed.contains("=>") { js_score += 3; ts_score += 3; }
    if trimmed.contains("document.") || trimmed.contains("window.") { js_score += 6; ts_score += 6; }

    // 11. Bash / Shell check
    let mut bash_score = 0;
    for line in trimmed.lines() {
        let l = line.trim();
        if l.starts_with("$ ") { bash_score += 4; }
        if l.starts_with("sudo ") || l.starts_with("apt ") || l.starts_with("apt-get ") { bash_score += 6; }
        if l.starts_with("curl ") || l.starts_with("wget ") { bash_score += 5; }
        if l.starts_with("docker ") || l.starts_with("docker-compose ") { bash_score += 6; }
        if l.starts_with("git ") { bash_score += 5; }
        if l.starts_with("npm ") || l.starts_with("cargo ") || l.starts_with("yarn ") || l.starts_with("pnpm ") { bash_score += 5; }
        if l.starts_with("chmod ") || l.starts_with("chown ") || l.starts_with("mkdir ") { bash_score += 5; }
        if l.starts_with("echo ") || l.starts_with("export ") { bash_score += 4; }
        if l.starts_with("cd ") || l.starts_with("ls ") || l.starts_with("rm ") { bash_score += 3; }
    }

    // 12. YAML check
    let mut yaml_score = 0;
    if trimmed.starts_with("---") { yaml_score += 10; }
    if trimmed.contains(": ") && trimmed.contains("\n  ") { yaml_score += 4; }

    // Determine highest scoring language
    let mut scores = [
        ("rust", rust_score),
        ("go", go_score),
        ("python", python_score),
        ("typescript", ts_score),
        ("javascript", js_score),
        ("bash", bash_score),
        ("yaml", yaml_score),
    ];

    scores.sort_by(|a, b| b.1.cmp(&a.1));

    if let Some(&(lang, score)) = scores.first() {
        if score >= 4 {
            return lang;
        }
    }

    ""
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_shebang() {
        assert_eq!(detect_language("#!/bin/bash\necho hello"), "bash");
        assert_eq!(detect_language("#!/usr/bin/env python\nprint('hi')"), "python");
        assert_eq!(detect_language("#!/usr/bin/env node\nconsole.log(1)"), "javascript");
    }

    #[test]
    fn test_detect_json() {
        assert_eq!(detect_language(r#"{"name": "SnippetAI", "version": "0.3.1"}"#), "json");
        assert_eq!(detect_language(r#"[1, 2, 3, "test"]"#), "json");
    }

    #[test]
    fn test_detect_html() {
        assert_eq!(detect_language("<!DOCTYPE html><html><body><h1>Title</h1></body></html>"), "html");
        assert_eq!(detect_language("<div class=\"container\"><p>Hello world</p></div>"), "html");
    }

    #[test]
    fn test_detect_sql() {
        assert_eq!(detect_language("SELECT id, name FROM users WHERE active = 1;"), "sql");
        assert_eq!(detect_language("CREATE TABLE snippets (id TEXT PRIMARY KEY, title TEXT);"), "sql");
        assert_eq!(detect_language("INSERT INTO users (id, name) VALUES (1, 'Alice');"), "sql");
    }

    #[test]
    fn test_detect_rust() {
        assert_eq!(detect_language("fn main() {\n    let mut x = 5;\n    println!(\"{}\", x);\n}"), "rust");
        assert_eq!(detect_language("use std::sync::Arc;\npub struct Config {\n    pub name: String,\n}"), "rust");
    }

    #[test]
    fn test_detect_python() {
        assert_eq!(detect_language("def calculate_sum(a, b):\n    return a + b\n\nif __name__ == '__main__':\n    print(calculate_sum(1, 2))"), "python");
        assert_eq!(detect_language("import os\nfrom datetime import datetime\n\nclass App:\n    def __init__(self):\n        pass"), "python");
    }

    #[test]
    fn test_detect_typescript() {
        assert_eq!(detect_language("interface User {\n    id: string;\n    name: string;\n}\nconst u: User = { id: '1', name: 'John' };"), "typescript");
    }

    #[test]
    fn test_detect_bash() {
        assert_eq!(detect_language("docker run -d -p 8080:80 nginx\ngit commit -m \"fix\"\ngit push origin main"), "bash");
        assert_eq!(detect_language("sudo apt-get update && sudo apt-get install -y build-essential"), "bash");
    }

    #[test]
    fn test_detect_css() {
        assert_eq!(detect_language(".card {\n    margin: 10px;\n    padding: 16px;\n    display: flex;\n    border-radius: 8px;\n}"), "css");
    }
}
