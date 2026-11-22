use std::sync::OnceLock;
use syntect::parsing::SyntaxSet;
use syntect::highlighting::{ThemeSet, Color as SynColor};
use syntect::easy::HighlightLines;
use slint::{Color, SharedString, ModelRc, VecModel};
use crate::{HighlightToken, HighlightLine};

static SYNTAX_SET: OnceLock<SyntaxSet> = OnceLock::new();
static THEME_SET: OnceLock<ThemeSet> = OnceLock::new();

fn get_syntax_set() -> &'static SyntaxSet {
    SYNTAX_SET.get_or_init(SyntaxSet::load_defaults_newlines)
}

fn get_theme_set() -> &'static ThemeSet {
    THEME_SET.get_or_init(ThemeSet::load_defaults)
}

fn syn_to_slint_color(c: SynColor) -> Color {
    Color::from_argb_u8(c.a, c.r, c.g, c.b)
}

fn map_lang_token(lang: &str) -> &'static str {
    match lang.trim().to_lowercase().as_str() {
        "rust" | "rs" => "rs",
        "python" | "py" => "py",
        "javascript" | "js" => "js",
        "typescript" | "ts" => "ts",
        "bash" | "sh" | "shell" | "zsh" => "sh",
        "json" => "json",
        "sql" => "sql",
        "html" | "htm" => "html",
        "css" => "css",
        "yaml" | "yml" => "yaml",
        "markdown" | "md" => "md",
        "go" | "golang" => "go",
        _ => "",
    }
}

pub fn highlight_code(code: &str, lang: &str, theme_id: i32) -> Vec<HighlightLine> {
    let ps = get_syntax_set();
    let ts = get_theme_set();

    let theme_name = if theme_id == 2 {
        "InspiredGitHub"
    } else {
        "base16-ocean.dark"
    };

    let theme = ts.themes.get(theme_name)
        .or_else(|| ts.themes.get("base16-ocean.dark"))
        .or_else(|| ts.themes.values().next())
        .expect("At least one syntect theme must be available");

    let token_hint = map_lang_token(lang);
    let syntax = if !token_hint.is_empty() {
        ps.find_syntax_by_extension(token_hint)
            .or_else(|| ps.find_syntax_by_token(token_hint))
            .unwrap_or_else(|| ps.find_syntax_plain_text())
    } else if let Some(syn) = ps.find_syntax_by_first_line(code) {
        syn
    } else {
        ps.find_syntax_plain_text()
    };

    let default_fg = if theme_id == 2 {
        Color::from_argb_u8(255, 15, 23, 42)
    } else {
        Color::from_argb_u8(255, 244, 244, 245)
    };

    let mut highlighter = HighlightLines::new(syntax, theme);
    let mut result = Vec::new();

    let lines: Vec<&str> = if code.is_empty() {
        vec![""]
    } else {
        code.lines().collect()
    };

    for (idx, line) in lines.iter().enumerate() {
        // Line ending for syntect (expects newlines for multi-line grammars)
        let line_with_nl = format!("{}\n", line);
        let ranges = highlighter.highlight_line(&line_with_nl, ps);

        let mut tokens = Vec::new();
        match ranges {
            Ok(token_ranges) => {
                for (style, text) in token_ranges {
                    let clean_text = text.trim_end_matches('\r').trim_end_matches('\n');
                    if !clean_text.is_empty() {
                        tokens.push(HighlightToken {
                            text: SharedString::from(clean_text),
                            color: syn_to_slint_color(style.foreground),
                        });
                    }
                }
            }
            Err(_) => {
                if !line.is_empty() {
                    tokens.push(HighlightToken {
                        text: SharedString::from(*line),
                        color: default_fg,
                    });
                }
            }
        }

        // If line is empty, ensure at least one space token so the line maintains its visual height
        if tokens.is_empty() {
            tokens.push(HighlightToken {
                text: SharedString::from(" "),
                color: Color::from_argb_u8(0, 0, 0, 0),
            });
        }

        result.push(HighlightLine {
            line_num: (idx + 1) as i32,
            tokens: ModelRc::new(VecModel::from(tokens)),
        });
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use slint::Model;

    #[test]
    fn test_highlight_rust_code() {
        let code = "fn main() {\n    let msg = \"hello\";\n    println!(\"{}\", msg);\n}";
        let lines = highlight_code(code, "rust", 0);
        assert_eq!(lines.len(), 4);
        assert_eq!(lines[0].line_num, 1);
        assert!(lines[0].tokens.row_count() > 0);
    }

    #[test]
    fn test_highlight_python_code() {
        let code = "def greet(name):\n    print(f'Hello {name}')";
        let lines = highlight_code(code, "python", 2); // light theme
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].line_num, 1);
        assert!(lines[0].tokens.row_count() > 0);
    }

    #[test]
    fn test_highlight_empty_code() {
        let lines = highlight_code("", "", 0);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].line_num, 1);
    }
}

