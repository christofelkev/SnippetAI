use std::sync::{Arc, Mutex};
use slint::{ModelRc, SharedString, VecModel};
use snippet_core::db::Database;
use snippet_core::models::Snippet;
use snippet_core::content::strip_image_markdown;
use snippet_core::related::find_related_snippets;
use snippet_core::ai::AIGroup;
use crate::{MainWindow, GroupItem, SnippetItem, RelatedItem, QuickPasteWindow};

pub struct AppState {
    pub db: Arc<Database>,
    pub http_client: reqwest::Client,
    pub all_snippets: Mutex<Vec<Snippet>>,
    pub selected_group: Mutex<String>,
    pub search_query: Mutex<String>,
    pub selected_id: Mutex<String>,
    pub ai_groups_cache: Mutex<Vec<AIGroup>>,
}

impl AppState {
    pub fn new(db: Arc<Database>) -> Self {
        let snippets = db.get_snippets().unwrap_or_default();
        Self {
            db,
            http_client: reqwest::Client::new(),
            all_snippets: Mutex::new(snippets),
            selected_group: Mutex::new(String::new()),
            search_query: Mutex::new(String::new()),
            selected_id: Mutex::new(String::new()),
            ai_groups_cache: Mutex::new(Vec::new()),
        }
    }

    pub fn reload_snippets(&self) {
        if let Ok(snippets) = self.db.get_snippets() {
            let mut lock = self.all_snippets.lock().unwrap();
            *lock = snippets;
        }
    }

    pub fn update_ui(&self, window: &MainWindow) {
        let snippets = self.all_snippets.lock().unwrap().clone();
        let selected_group = self.selected_group.lock().unwrap().clone();
        let search_query = self.search_query.lock().unwrap().to_lowercase();
        let selected_id = self.selected_id.lock().unwrap().clone();

        // 1. Compute groups and counts
        let mut group_counts: std::collections::BTreeMap<String, i32> = std::collections::BTreeMap::new();
        for s in &snippets {
            if !s.group_name.trim().is_empty() {
                *group_counts.entry(s.group_name.trim().to_string()).or_insert(0) += 1;
            }
        }

        let group_items: Vec<GroupItem> = group_counts
            .into_iter()
            .map(|(name, count)| GroupItem {
                name: SharedString::from(name),
                count,
            })
            .collect();

        window.set_all_count(snippets.len() as i32);
        window.set_groups(ModelRc::new(VecModel::from(group_items)));
        window.set_selected_group(SharedString::from(&selected_group));

        // 2. Filter snippets by group and search query
        let filtered: Vec<Snippet> = snippets
            .iter()
            .filter(|s| {
                if !selected_group.is_empty() && s.group_name != selected_group {
                    return false;
                }
                if !search_query.is_empty() {
                    let matches_title = s.title.to_lowercase().contains(&search_query);
                    let matches_content = s.content.to_lowercase().contains(&search_query);
                    let matches_group = s.group_name.to_lowercase().contains(&search_query);
                    return matches_title || matches_content || matches_group;
                }
                true
            })
            .cloned()
            .collect();

        let snippet_items: Vec<SnippetItem> = filtered
            .iter()
            .map(|s| {
                let clean_preview = strip_image_markdown(&s.content);
                let first_line = clean_preview.lines().next().unwrap_or("").to_string();
                SnippetItem {
                    id: SharedString::from(&s.id),
                    title: SharedString::from(&s.title),
                    preview: SharedString::from(first_line),
                    group_name: SharedString::from(&s.group_name),
                    language: SharedString::from(&s.language),
                }
            })
            .collect();

        window.set_snippets(ModelRc::new(VecModel::from(snippet_items)));
        window.set_selected_snippet_id(SharedString::from(&selected_id));

        // 3. Update Detail View
        if let Some(active) = snippets.iter().find(|s| s.id == selected_id) {
            window.set_detail_title(SharedString::from(&active.title));
            window.set_detail_group(SharedString::from(&active.group_name));
            window.set_detail_content(SharedString::from(&active.content));
            window.set_detail_language(SharedString::from(&active.language));

            // Related snippets
            let related = find_related_snippets(active, &snippets, 3);
            let related_items: Vec<RelatedItem> = related
                .into_iter()
                .map(|(s, _score)| RelatedItem {
                    id: SharedString::from(&s.id),
                    title: SharedString::from(&s.title),
                })
                .collect();
            window.set_related_snippets(ModelRc::new(VecModel::from(related_items)));
        } else {
            window.set_detail_title(SharedString::default());
            window.set_detail_group(SharedString::default());
            window.set_detail_content(SharedString::default());
            window.set_detail_language(SharedString::default());
            window.set_related_snippets(ModelRc::new(VecModel::default()));
        }
    }

    pub fn update_quickpaste(&self, window: &QuickPasteWindow, query: &str) {
        let snippets = self.all_snippets.lock().unwrap().clone();
        let q = query.to_lowercase();
        let filtered: Vec<SnippetItem> = snippets
            .iter()
            .filter(|s| {
                if q.is_empty() {
                    return true;
                }
                s.title.to_lowercase().contains(&q)
                    || s.content.to_lowercase().contains(&q)
                    || s.group_name.to_lowercase().contains(&q)
            })
            .map(|s| {
                let clean_preview = strip_image_markdown(&s.content);
                let first_line = clean_preview.lines().next().unwrap_or("").to_string();
                SnippetItem {
                    id: SharedString::from(&s.id),
                    title: SharedString::from(&s.title),
                    preview: SharedString::from(first_line),
                    group_name: SharedString::from(&s.group_name),
                    language: SharedString::from(&s.language),
                }
            })
            .collect();

        window.set_snippets(ModelRc::new(VecModel::from(filtered)));
    }
}
