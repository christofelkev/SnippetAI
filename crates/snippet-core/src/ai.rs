use serde::{Deserialize, Serialize};
use crate::models::{Snippet, LANGUAGES};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct AIGroup {
    pub group_name: String,
    pub reason: String,
    pub snippet_ids: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct AIGroupingResult {
    pub groups: Vec<AIGroup>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Default)]
pub struct GeneratedMetadata {
    pub title: String,
    pub group: String,
    pub language: String,
}

pub fn get_grouping_prompt(snippets: &[Snippet]) -> String {
    let data: Vec<serde_json::Value> = snippets
        .iter()
        .map(|s| {
            serde_json::json!({
                "id": s.id,
                "title": s.title,
                "content": s.content,
            })
        })
        .collect();

    format!(
        "You are an AI assistant that groups code snippets by functionality.\n\
        Given the following list of snippets, group them into logical categories.\n\
        Respond ONLY with a valid JSON object matching this schema:\n\
        {{\n  \
          \"groups\": [\n    \
            {{\n      \
              \"group_name\": \"string\",\n      \
              \"reason\": \"string\",\n      \
              \"snippet_ids\": [\"string\"]\n    \
            }}\n  \
          ]\n\
        }}\n\n\
        Snippets:\n\
        {}",
        serde_json::to_string_pretty(&data).unwrap_or_default()
    )
}

pub fn get_metadata_prompt(content: &str) -> String {
    let allowed: Vec<&str> = LANGUAGES.iter().copied().filter(|s| !s.is_empty()).collect();
    format!(
        "You are an assistant that writes metadata for a code snippet manager.\n\
        Given the snippet content below, respond ONLY with a valid JSON object matching this schema:\n\
        {{\n  \
          \"title\": \"string, a concise descriptive title (max 8 words)\",\n  \
          \"group\": \"string, a short UPPERCASE category name (e.g. DOCKER, GIT, PYTHON), or an empty string if unclear\",\n  \
          \"language\": \"string, exactly one of: {} — or an empty string if none fit\"\n\
        }}\n\n\
        Snippet content:\n\
        {}",
        allowed.join(", "),
        content
    )
}

pub fn parse_json_response<T: for<'de> Deserialize<'de>>(text: &str) -> Result<T, String> {
    if let (Some(start), Some(end)) = (text.find('{'), text.rfind('}')) {
        if start <= end {
            let json_slice = &text[start..=end];
            return serde_json::from_str(json_slice).map_err(|e| e.to_string());
        }
    }
    serde_json::from_str(text).map_err(|e| e.to_string())
}

pub fn normalize_metadata(raw: serde_json::Value) -> GeneratedMetadata {
    let title = raw.get("title").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    let group = raw.get("group").and_then(|v| v.as_str()).unwrap_or("").trim().to_uppercase();
    let lang = raw.get("language").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();

    let valid_lang = if LANGUAGES.iter().any(|&l| !l.is_empty() && l == lang) {
        lang
    } else {
        String::new()
    };

    GeneratedMetadata {
        title,
        group,
        language: valid_lang,
    }
}

pub async fn group_snippets(
    client: &reqwest::Client,
    provider: &str,
    api_key: &str,
    model_override: Option<&str>,
    snippets: &[Snippet],
) -> Result<AIGroupingResult, String> {
    let prompt = get_grouping_prompt(snippets);
    let text = fetch_completion_text(client, provider, api_key, model_override, &prompt).await?;
    parse_json_response(&text)
}

pub async fn generate_metadata(
    client: &reqwest::Client,
    provider: &str,
    api_key: &str,
    model_override: Option<&str>,
    content: &str,
) -> Result<GeneratedMetadata, String> {
    let prompt = get_metadata_prompt(content);
    let text = fetch_completion_text(client, provider, api_key, model_override, &prompt).await?;
    let raw: serde_json::Value = parse_json_response(&text)?;
    Ok(normalize_metadata(raw))
}

async fn fetch_completion_text(
    client: &reqwest::Client,
    provider: &str,
    api_key: &str,
    model_override: Option<&str>,
    prompt: &str,
) -> Result<String, String> {
    match provider.to_lowercase().as_str() {
        "openai" => {
            let model = model_override.unwrap_or("gpt-4o-mini");
            let res = client
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", api_key))
                .json(&serde_json::json!({
                    "model": model,
                    "messages": [{ "role": "user", "content": prompt }],
                    "response_format": { "type": "json_object" }
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            data["choices"][0]["message"]["content"]
                .as_str()
                .map(|s| s.to_string())
                .ok_or_else(|| "Invalid OpenAI response structure".to_string())
        }
        "anthropic" => {
            let model = model_override.unwrap_or("claude-3-5-sonnet-20240620");
            let res = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&serde_json::json!({
                    "model": model,
                    "max_tokens": 4096,
                    "messages": [{ "role": "user", "content": prompt }]
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            data["content"][0]["text"]
                .as_str()
                .map(|s| s.to_string())
                .ok_or_else(|| "Invalid Anthropic response structure".to_string())
        }
        _ => {
            // Default: DeepSeek
            let model = model_override.unwrap_or("deepseek-chat");
            let res = client
                .post("https://api.deepseek.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", api_key))
                .json(&serde_json::json!({
                    "model": model,
                    "messages": [{ "role": "user", "content": prompt }],
                    "response_format": { "type": "json_object" }
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            data["choices"][0]["message"]["content"]
                .as_str()
                .map(|s| s.to_string())
                .ok_or_else(|| "Invalid DeepSeek response structure".to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_json_response() {
        let text = "Here is the result:\n{\n  \"groups\": []\n}\nHope this helps!";
        let parsed: AIGroupingResult = parse_json_response(text).unwrap();
        assert_eq!(parsed.groups.len(), 0);
    }

    #[test]
    fn test_normalize_metadata() {
        let raw = serde_json::json!({
            "title": "  My Python Script  ",
            "group": "  python  ",
            "language": "PYTHON"
        });
        let meta = normalize_metadata(raw);
        assert_eq!(meta.title, "My Python Script");
        assert_eq!(meta.group, "PYTHON");
        assert_eq!(meta.language, "python");
    }
}
