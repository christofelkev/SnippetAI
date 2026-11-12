mod app_state;
mod clipboard;
mod hotkey;
mod instance;

use std::sync::Arc;
use slint::{ComponentHandle, ModelRc, SharedString, VecModel};
use snippet_core::db::Database;
use snippet_core::storage::{backup_db_if_exists, get_app_dir};
use snippet_core::ai::group_snippets;
use crate::app_state::AppState;
use crate::clipboard::copy_clean_code;
use crate::hotkey::HotkeyManager;
use crate::instance::SingleInstanceGuard;

slint::include_modules!();

fn theme_str_to_id(theme_str: &str) -> i32 {
    match theme_str {
        "theme-hacker-red" => 1,
        "theme-ocean-blue" => 2,
        "theme-cyberpunk" => 3,
        _ => 0,
    }
}

fn theme_id_to_str(id: i32) -> &'static str {
    match id {
        1 => "theme-hacker-red",
        2 => "theme-ocean-blue",
        3 => "theme-cyberpunk",
        _ => "theme-default",
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Single Instance Guard
    let _instance_guard = match SingleInstanceGuard::acquire("Local\\SnippetAI_SingleInstance") {
        Some(g) => g,
        None => {
            eprintln!("SnippetAI is already running.");
            return Ok(());
        }
    };

    // 2. Initialize AppDir and Database with auto-backup
    let app_dir = get_app_dir();
    if let Ok(Some(backup_path)) = backup_db_if_exists(&app_dir) {
        println!("Database backup created at {:?}", backup_path);
    }

    let db = Arc::new(Database::open(&app_dir).expect("Failed to open SQLite database"));
    let state = Arc::new(AppState::new(db.clone()));

    // 3. Create Windows
    let main_window = MainWindow::new()?;
    let quickpaste_window = QuickPasteWindow::new()?;

    // 4. Load persisted preferences
    if let Ok(Some(sidebar_w_str)) = db.get_setting("snippetai_sidebar_width") {
        if let Ok(w) = sidebar_w_str.parse::<f32>() {
            let clamped = w.clamp(160.0, 350.0);
            main_window.set_sidebar_width(clamped);
        }
    } else {
        main_window.set_sidebar_width(240.0);
    }

    if let Ok(Some(list_w_str)) = db.get_setting("snippetai_list_width") {
        if let Ok(w) = list_w_str.parse::<f32>() {
            let clamped = w.clamp(220.0, 360.0);
            main_window.set_list_width(clamped);
        }
    } else {
        main_window.set_list_width(320.0);
    }

    let current_theme_str = db.get_setting("app_theme").unwrap_or_default().unwrap_or_else(|| "theme-default".to_string());
    let current_theme_id = theme_str_to_id(&current_theme_str);
    main_window.global::<Theme>().set_theme_id(current_theme_id);
    quickpaste_window.global::<Theme>().set_theme_id(current_theme_id);
    main_window.set_setting_theme(current_theme_id);

    if let Ok(Some(prov)) = db.get_setting("ai_provider") {
        main_window.set_setting_provider(SharedString::from(prov));
    }
    if let Ok(Some(key)) = db.get_setting("ai_api_key") {
        main_window.set_setting_api_key(SharedString::from(key));
    }
    if let Ok(Some(hk)) = db.get_setting("global_hotkey") {
        main_window.set_setting_hotkey(SharedString::from(hk));
    }

    // Select first snippet if any
    {
        let all = state.all_snippets.lock().unwrap();
        if let Some(first) = all.first() {
            *state.selected_id.lock().unwrap() = first.id.clone();
        }
    }
    state.update_ui(&main_window);
    state.update_quickpaste(&quickpaste_window, "");

    // 5. Setup MainWindow Callbacks
    {
        let state = state.clone();
        let mw_weak = main_window.as_weak();
        main_window.on_select_group(move |group| {
            if let Some(mw) = mw_weak.upgrade() {
                *state.selected_group.lock().unwrap() = group.to_string();
                state.update_ui(&mw);
            }
        });
    }

    {
        let state = state.clone();
        let mw_weak = main_window.as_weak();
        main_window.on_select_snippet(move |id| {
            if let Some(mw) = mw_weak.upgrade() {
                *state.selected_id.lock().unwrap() = id.to_string();
                state.update_ui(&mw);
            }
        });
    }

    {
        let state = state.clone();
        let mw_weak = main_window.as_weak();
        main_window.on_add_snippet(move || {
            if let Some(mw) = mw_weak.upgrade() {
                let current_group = state.selected_group.lock().unwrap().clone();
                let grp = if current_group.is_empty() { None } else { Some(current_group.as_str()) };
                if let Ok(snippet) = state.db.add_snippet("Untitled Snippet", "", grp, None) {
                    *state.selected_id.lock().unwrap() = snippet.id.clone();
                    state.reload_snippets();
                    state.update_ui(&mw);
                }
            }
        });
    }

    {
        let state = state.clone();
        let mw_weak = main_window.as_weak();
        main_window.on_save_snippet(move |title, group, content, lang| {
            if let Some(mw) = mw_weak.upgrade() {
                let selected_id = state.selected_id.lock().unwrap().clone();
                if !selected_id.is_empty() {
                    let _ = state.db.update_snippet(
                        &selected_id,
                        Some(title.as_str()),
                        Some(content.as_str()),
                        Some(group.as_str()),
                        Some(lang.as_str()),
                    );
                    state.reload_snippets();

                    // Update left list titles/previews smoothly without touching active DetailView
                    let snippets = state.all_snippets.lock().unwrap().clone();
                    let selected_group = state.selected_group.lock().unwrap().clone();
                    let search_query = state.search_query.lock().unwrap().to_lowercase();
                    let filtered: Vec<SnippetItem> = snippets
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
                        .map(|s| {
                            let clean_preview = snippet_core::content::strip_image_markdown(&s.content);
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
                    mw.set_snippets(ModelRc::new(VecModel::from(filtered)));
                }
            }
        });
    }

    {
        let state = state.clone();
        let mw_weak = main_window.as_weak();
        main_window.on_delete_detail_image(move |idx| {
            if let Some(mw) = mw_weak.upgrade() {
                let selected_id = state.selected_id.lock().unwrap().clone();
                if !selected_id.is_empty() {
                    let all = state.all_snippets.lock().unwrap();
                    if let Some(active) = all.iter().find(|s| s.id == selected_id) {
                        let mut blocks = snippet_core::content::parse_content(&active.content);
                        let i = idx as usize;
                        if i < blocks.len() {
                            blocks.remove(i);
                            let new_content = snippet_core::content::blocks_to_string(&blocks);
                            drop(all);
                            let _ = state.db.update_snippet(
                                &selected_id,
                                None,
                                Some(&new_content),
                                None,
                                None,
                            );
                            state.reload_snippets();
                            state.update_ui(&mw);
                        }
                    }
                }
            }
        });
    }

    {
        let state = state.clone();
        let mw_weak = main_window.as_weak();
        main_window.on_edit_detail_text_body(move |new_body| {
            if let Some(mw) = mw_weak.upgrade() {
                let selected_id = state.selected_id.lock().unwrap().clone();
                if !selected_id.is_empty() {
                    let all = state.all_snippets.lock().unwrap();
                    if let Some(active) = all.iter().find(|s| s.id == selected_id) {
                        let blocks = snippet_core::content::parse_content(&active.content);
                        let mut image_markdowns = Vec::new();
                        for b in &blocks {
                            if let snippet_core::models::ContentBlock::Image { alt, url } = b {
                                image_markdowns.push(format!("![{}]({})", alt, url));
                            }
                        }
                        let mut combined = image_markdowns.join("\n\n");
                        if !new_body.trim().is_empty() {
                            if !combined.is_empty() {
                                combined.push_str("\n\n");
                            }
                            combined.push_str(new_body.as_str());
                        }
                        drop(all);
                        let _ = state.db.update_snippet(
                            &selected_id,
                            None,
                            Some(&combined),
                            None,
                            None,
                        );
                        state.reload_snippets();
                        mw.set_detail_content(SharedString::from(combined));
                    }
                }
            }
        });
    }

    {
        let state = state.clone();
        let mw_weak = main_window.as_weak();
        let qp_weak = quickpaste_window.as_weak();
        main_window.on_save_settings(move |theme_id, prov, key, _model, hk| {
            let theme_str = theme_id_to_str(theme_id);
            let _ = state.db.set_setting("app_theme", theme_str);
            let _ = state.db.set_setting("ai_provider", prov.as_str());
            let _ = state.db.set_setting("ai_api_key", key.as_str());
            let _ = state.db.set_setting("global_hotkey", hk.as_str());

            if let Some(mw) = mw_weak.upgrade() {
                mw.global::<Theme>().set_theme_id(theme_id);
            }
            if let Some(qp) = qp_weak.upgrade() {
                qp.global::<Theme>().set_theme_id(theme_id);
            }
        });
    }

    {
        let state = state.clone();
        main_window.on_persist_widths(move |sidebar_w, list_w| {
            let _ = state.db.set_setting("snippetai_sidebar_width", &sidebar_w.to_string());
            let _ = state.db.set_setting("snippetai_list_width", &list_w.to_string());
        });
    }

    {
        let state = state.clone();
        let mw_weak = main_window.as_weak();
        main_window.on_run_ai_grouping(move || {
            if let Some(mw) = mw_weak.upgrade() {
                mw.set_is_ai_loading(true);
                mw.set_ai_error(SharedString::default());
                let state_clone = state.clone();
                let mw_weak_inner = mw.as_weak();

                tokio::spawn(async move {
                    let prov = state_clone.db.get_setting("ai_provider").unwrap_or_default().unwrap_or_else(|| "deepseek".to_string());
                    let api_key = state_clone.db.get_setting("ai_api_key").unwrap_or_default().unwrap_or_default();
                    let snippets = state_clone.all_snippets.lock().unwrap().clone();

                    let result = group_snippets(&state_clone.http_client, &prov, &api_key, None, &snippets).await;
                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(window) = mw_weak_inner.upgrade() {
                            window.set_is_ai_loading(false);
                            match result {
                                Ok(grouping) => {
                                    *state_clone.ai_groups_cache.lock().unwrap() = grouping.groups.clone();
                                    let previews: Vec<AIGroupPreview> = grouping.groups.iter().map(|g| {
                                        AIGroupPreview {
                                            group_name: SharedString::from(&g.group_name),
                                            reason: SharedString::from(&g.reason),
                                            snippet_titles: SharedString::from(format!("{} snippets", g.snippet_ids.len())),
                                        }
                                    }).collect();
                                    window.set_ai_suggestions(ModelRc::new(VecModel::from(previews)));
                                }
                                Err(err) => {
                                    window.set_ai_error(SharedString::from(err));
                                }
                            }
                        }
                    });
                });
            }
        });
    }

    {
        let state = state.clone();
        let mw_weak = main_window.as_weak();
        main_window.on_apply_ai_groups(move || {
            let cached = state.ai_groups_cache.lock().unwrap().clone();
            let mut pairs = Vec::new();
            for group in cached {
                for id in group.snippet_ids {
                    pairs.push((id, group.group_name.clone()));
                }
            }
            if let Ok(()) = state.db.apply_groups(&pairs) {
                state.reload_snippets();
                if let Some(mw) = mw_weak.upgrade() {
                    state.update_ui(&mw);
                }
            }
        });
    }

    // 6. Setup QuickPaste Window Callbacks
    {
        let state = state.clone();
        let qp_weak = quickpaste_window.as_weak();
        quickpaste_window.on_search_edited(move |q| {
            if let Some(qp) = qp_weak.upgrade() {
                state.update_quickpaste(&qp, q.as_str());
            }
        });
    }

    {
        let state = state.clone();
        let qp_weak = quickpaste_window.as_weak();
        quickpaste_window.on_choose_snippet(move |id| {
            if let Some(qp) = qp_weak.upgrade() {
                let all = state.all_snippets.lock().unwrap();
                if let Some(s) = all.iter().find(|s| s.id == id.as_str()) {
                    let _ = copy_clean_code(&s.content);
                }
                let _ = qp.hide();
            }
        });
    }

    // 7. Global Hotkey integration
    let mut hotkey_manager = HotkeyManager::new().ok();
    if let Some(ref mut hm) = hotkey_manager {
        let _ = hm.register_default();
    }

    let qp_weak_hotkey = quickpaste_window.as_weak();
    let hotkey_receiver = global_hotkey::GlobalHotKeyEvent::receiver().clone();
    let _timer = slint::Timer::default();
    _timer.start(slint::TimerMode::Repeated, std::time::Duration::from_millis(50), move || {
        while let Ok(_event) = hotkey_receiver.try_recv() {
            if let Some(qp) = qp_weak_hotkey.upgrade() {
                let _ = qp.show();
            }
        }
    });

    main_window.run()?;
    Ok(())
}
