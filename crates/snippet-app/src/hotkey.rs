use global_hotkey::{
    hotkey::{Code, HotKey, Modifiers},
    GlobalHotKeyManager,
};

pub struct HotkeyManager {
    manager: GlobalHotKeyManager,
    current_hotkey: Option<HotKey>,
}

fn parse_code(s: &str) -> Option<Code> {
    match s.trim().to_ascii_lowercase().as_str() {
        "space" => Some(Code::Space),
        "enter" | "return" => Some(Code::Enter),
        "escape" | "esc" => Some(Code::Escape),
        "tab" => Some(Code::Tab),
        "backquote" | "`" => Some(Code::Backquote),
        "f1" => Some(Code::F1),
        "f2" => Some(Code::F2),
        "f3" => Some(Code::F3),
        "f4" => Some(Code::F4),
        "f5" => Some(Code::F5),
        "f6" => Some(Code::F6),
        "f7" => Some(Code::F7),
        "f8" => Some(Code::F8),
        "f9" => Some(Code::F9),
        "f10" => Some(Code::F10),
        "f11" => Some(Code::F11),
        "f12" => Some(Code::F12),
        "a" => Some(Code::KeyA),
        "b" => Some(Code::KeyB),
        "c" => Some(Code::KeyC),
        "d" => Some(Code::KeyD),
        "e" => Some(Code::KeyE),
        "f" => Some(Code::KeyF),
        "g" => Some(Code::KeyG),
        "h" => Some(Code::KeyH),
        "i" => Some(Code::KeyI),
        "j" => Some(Code::KeyJ),
        "k" => Some(Code::KeyK),
        "l" => Some(Code::KeyL),
        "m" => Some(Code::KeyM),
        "n" => Some(Code::KeyN),
        "o" => Some(Code::KeyO),
        "p" => Some(Code::KeyP),
        "q" => Some(Code::KeyQ),
        "r" => Some(Code::KeyR),
        "s" => Some(Code::KeyS),
        "t" => Some(Code::KeyT),
        "u" => Some(Code::KeyU),
        "v" => Some(Code::KeyV),
        "w" => Some(Code::KeyW),
        "x" => Some(Code::KeyX),
        "y" => Some(Code::KeyY),
        "z" => Some(Code::KeyZ),
        "0" => Some(Code::Digit0),
        "1" => Some(Code::Digit1),
        "2" => Some(Code::Digit2),
        "3" => Some(Code::Digit3),
        "4" => Some(Code::Digit4),
        "5" => Some(Code::Digit5),
        "6" => Some(Code::Digit6),
        "7" => Some(Code::Digit7),
        "8" => Some(Code::Digit8),
        "9" => Some(Code::Digit9),
        _ => None,
    }
}

pub fn parse_hotkey(s: &str) -> Result<HotKey, String> {
    let mut mods = Modifiers::empty();
    let mut code = None;

    for part in s.split('+') {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }
        match trimmed.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "shift" => mods |= Modifiers::SHIFT,
            "alt" | "opt" | "option" => mods |= Modifiers::ALT,
            "super" | "win" | "cmd" | "command" | "meta" => mods |= Modifiers::SUPER,
            other => {
                if let Some(c) = parse_code(other) {
                    code = Some(c);
                } else {
                    return Err(format!("Unknown key: '{}'", other));
                }
            }
        }
    }

    let code = code.ok_or_else(|| "No key code specified in hotkey string".to_string())?;
    let mods = if mods.is_empty() { None } else { Some(mods) };
    Ok(HotKey::new(mods, code))
}

impl HotkeyManager {
    pub fn new() -> Result<Self, String> {
        let manager = GlobalHotKeyManager::new().map_err(|e| e.to_string())?;
        Ok(Self {
            manager,
            current_hotkey: None,
        })
    }

    pub fn register(&mut self, hotkey_str: &str) -> Result<(), String> {
        let hotkey = parse_hotkey(hotkey_str)?;
        if let Some(old) = self.current_hotkey.take() {
            let _ = self.manager.unregister(old);
        }
        self.manager.register(hotkey).map_err(|e| e.to_string())?;
        self.current_hotkey = Some(hotkey);
        Ok(())
    }

    pub fn register_default(&mut self) -> Result<(), String> {
        self.register("Ctrl+Shift+Space")
    }

    #[allow(dead_code)]
    pub fn current_id(&self) -> Option<u32> {
        self.current_hotkey.map(|h| h.id())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_hotkeys() {
        assert!(parse_hotkey("Ctrl+Shift+Space").is_ok());
        assert!(parse_hotkey("Alt+Space").is_ok());
        assert!(parse_hotkey("Ctrl+Alt+V").is_ok());
        assert!(parse_hotkey("F12").is_ok());
    }

    #[test]
    fn test_parse_invalid_hotkeys() {
        assert!(parse_hotkey("InvalidKey").is_err());
        assert!(parse_hotkey("Ctrl+Shift").is_err());
    }
}
