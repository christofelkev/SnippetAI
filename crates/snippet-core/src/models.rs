use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Snippet {
    pub id: String,
    pub title: String,
    pub content: String,
    pub group_name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub language: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

pub const LANGUAGES: &[&str] = &[
    "", "bash", "javascript", "typescript", "python", "json", "sql", "rust", "go", "html", "css",
    "yaml", "markdown",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ContentBlock {
    Text(String),
    Image { alt: String, url: String },
}
