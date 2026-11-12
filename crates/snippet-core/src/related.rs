use std::collections::HashSet;
use crate::models::Snippet;

pub fn extract_tokens(text: &str) -> HashSet<String> {
    text.split(|c: char| !c.is_alphanumeric() && c != '_')
        .map(|t| t.to_lowercase())
        .filter(|t| t.len() > 2)
        .collect()
}

pub fn calculate_similarity_score(tokens_a: &HashSet<String>, tokens_b: &HashSet<String>) -> f32 {
    if tokens_a.is_empty() && tokens_b.is_empty() {
        return 0.0;
    }
    let intersection = tokens_a.intersection(tokens_b).count();
    let union = tokens_a.len() + tokens_b.len() - intersection;
    if union == 0 {
        0.0
    } else {
        intersection as f32 / union as f32
    }
}

pub fn find_related_snippets<'a>(
    current_snippet: &Snippet,
    all_snippets: &'a [Snippet],
    limit: usize,
) -> Vec<(&'a Snippet, f32)> {
    let current_tokens = extract_tokens(&current_snippet.content);
    let mut scored: Vec<(&'a Snippet, f32)> = all_snippets
        .iter()
        .filter(|s| s.id != current_snippet.id)
        .map(|s| {
            let tokens = extract_tokens(&s.content);
            let score = calculate_similarity_score(&current_tokens, &tokens);
            (s, score)
        })
        .filter(|(_, score)| *score > 0.1)
        .collect();

    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit);
    scored
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_snippet(id: &str, content: &str) -> Snippet {
        Snippet {
            id: id.to_string(),
            title: id.to_string(),
            content: content.to_string(),
            group_name: "TEST".to_string(),
            created_at: 0,
            updated_at: 0,
            language: "rust".to_string(),
        }
    }

    #[test]
    fn test_token_extraction_and_similarity() {
        let s1 = make_snippet("1", "docker run -d --name nginx -p 80:80 nginx:latest");
        let s2 = make_snippet("2", "docker build -t my-app . && docker run my-app");
        let s3 = make_snippet("3", "cargo build --release");

        let all = vec![s1.clone(), s2.clone(), s3.clone()];
        let related = find_related_snippets(&s1, &all, 3);

        assert_eq!(related.len(), 1);
        assert_eq!(related[0].0.id, "2");
        assert!(related[0].1 > 0.1);
    }
}
