use std::collections::HashMap;
use crate::models::ContentBlock;

fn build_matches(bytes: &[u8], open: u8, close: u8) -> HashMap<usize, usize> {
    let mut stack = Vec::new();
    let mut matches = HashMap::new();
    for (i, &b) in bytes.iter().enumerate() {
        if b == open {
            stack.push(i);
        } else if b == close {
            if let Some(start) = stack.pop() {
                matches.insert(start, i);
            }
        }
    }
    matches
}

pub fn remove_image_markdown(content: &str) -> String {
    let bytes = content.as_bytes();
    let bracket_matches = build_matches(bytes, b'[', b']');
    let paren_matches = build_matches(bytes, b'(', b')');

    let mut result = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'!' && i + 1 < bytes.len() && bytes[i + 1] == b'[' {
            if let Some(&alt_close) = bracket_matches.get(&(i + 1)) {
                if alt_close + 1 < bytes.len() && bytes[alt_close + 1] == b'(' {
                    if let Some(&url_close) = paren_matches.get(&(alt_close + 1)) {
                        i = url_close + 1;
                        continue;
                    }
                }
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(result).unwrap_or_else(|_| content.to_string())
}

pub fn strip_image_markdown(content: &str) -> String {
    let stripped = remove_image_markdown(content);
    let normalized = stripped.replace("\r\n", "\n");
    let mut collapsed = String::with_capacity(normalized.len());
    let mut consecutive_newlines = 0;
    for ch in normalized.chars() {
        if ch == '\n' {
            consecutive_newlines += 1;
            if consecutive_newlines <= 2 {
                collapsed.push(ch);
            }
        } else {
            consecutive_newlines = 0;
            collapsed.push(ch);
        }
    }
    collapsed.trim().to_string()
}

pub fn parse_content(content: &str) -> Vec<ContentBlock> {
    let bytes = content.as_bytes();
    let bracket_matches = build_matches(bytes, b'[', b']');
    let paren_matches = build_matches(bytes, b'(', b')');

    let mut blocks = Vec::new();
    let mut last_index = 0;
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b'!' && i + 1 < bytes.len() && bytes[i + 1] == b'[' {
            if let Some(&alt_close) = bracket_matches.get(&(i + 1)) {
                if alt_close + 1 < bytes.len() && bytes[alt_close + 1] == b'(' {
                    if let Some(&url_close) = paren_matches.get(&(alt_close + 1)) {
                        if i > last_index {
                            let text = &content[last_index..i];
                            if !text.trim().is_empty() || text.contains('\n') {
                                blocks.push(ContentBlock::Text(text.to_string()));
                            }
                        }
                        let alt = &content[i + 2..alt_close];
                        let url = &content[alt_close + 2..url_close];
                        blocks.push(ContentBlock::Image {
                            alt: if alt.is_empty() { "Image".to_string() } else { alt.to_string() },
                            url: url.to_string(),
                        });
                        last_index = url_close + 1;
                        i = last_index;
                        continue;
                    }
                }
            }
        }
        i += 1;
    }

    if last_index < content.len() {
        blocks.push(ContentBlock::Text(content[last_index..].to_string()));
    }

    if blocks.is_empty() {
        blocks.push(ContentBlock::Text(content.to_string()));
    }

    blocks
}

pub fn with_editable_gaps(blocks: Vec<ContentBlock>) -> Vec<ContentBlock> {
    if blocks.is_empty() {
        return vec![ContentBlock::Text(String::new())];
    }

    let mut result = Vec::new();

    if let Some(ContentBlock::Image { .. }) = blocks.first() {
        result.push(ContentBlock::Text(String::new()));
    }

    for i in 0..blocks.len() {
        let block = &blocks[i];
        result.push(block.clone());
        if let ContentBlock::Image { .. } = block {
            let next = blocks.get(i + 1);
            match next {
                None | Some(ContentBlock::Image { .. }) => {
                    result.push(ContentBlock::Text(String::new()));
                }
                _ => {}
            }
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_removes_single_image_markdown() {
        assert_eq!(
            strip_image_markdown("a\n![Pasted Image](http://asset.localhost/x.png)\nb"),
            "a\n\nb"
        );
    }

    #[test]
    fn test_collapses_extra_blank_lines() {
        assert_eq!(
            strip_image_markdown("code\n\n![i](u)\n\nmore"),
            "code\n\nmore"
        );
    }

    #[test]
    fn test_leaves_plain_code_untouched() {
        assert_eq!(
            strip_image_markdown("docker build -t app ."),
            "docker build -t app ."
        );
    }

    #[test]
    fn test_removes_multiple_images() {
        assert_eq!(
            strip_image_markdown("![a](1)x![b](2)y"),
            "xy"
        );
    }

    #[test]
    fn test_removes_image_with_nested_brackets_in_alt() {
        assert_eq!(
            strip_image_markdown("x ![Pasted [Image]](http://foo/bar.png) y"),
            "x  y"
        );
    }

    #[test]
    fn test_removes_image_with_parenthesis_in_url() {
        assert_eq!(
            strip_image_markdown("before ![alt](https://en.wikipedia.org/wiki/Foo_(bar)) after"),
            "before  after"
        );
    }

    #[test]
    fn test_removes_multiple_images_with_nested_brackets_and_parens() {
        assert_eq!(
            strip_image_markdown("![a [x]](http://a/(1).png)mid![b](http://b/(2)/y.png)end"),
            "midend"
        );
    }

    #[test]
    fn test_removes_deeply_nested() {
        assert_eq!(
            strip_image_markdown("A ![t1 [t2 [t3]]](http://host/(p1(p2(p3)))) B"),
            "A  B"
        );
    }

    #[test]
    fn test_leaves_unbalanced_untouched() {
        assert_eq!(
            strip_image_markdown("![a](http://foo/bar(baz"),
            "![a](http://foo/bar(baz"
        );
    }

    #[test]
    fn test_strips_well_formed_following_unclosed() {
        assert_eq!(
            strip_image_markdown("X![b](unclosedY![c](3)Z"),
            "X![b](unclosedYZ"
        );
    }

    #[test]
    fn test_parse_content_and_gaps() {
        let content = "prefix\n![img](test.png)\npostfix";
        let blocks = parse_content(content);
        assert_eq!(blocks.len(), 3);
        let gaps = with_editable_gaps(blocks);
        assert_eq!(gaps.len(), 3);
    }
}
