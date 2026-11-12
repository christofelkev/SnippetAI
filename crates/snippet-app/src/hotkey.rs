use global_hotkey::{
    hotkey::{Code, HotKey, Modifiers},
    GlobalHotKeyManager,
};

pub struct HotkeyManager {
    manager: GlobalHotKeyManager,
    current_hotkey: Option<HotKey>,
}

impl HotkeyManager {
    pub fn new() -> Result<Self, String> {
        let manager = GlobalHotKeyManager::new().map_err(|e| e.to_string())?;
        Ok(Self {
            manager,
            current_hotkey: None,
        })
    }

    pub fn register_default(&mut self) -> Result<(), String> {
        let hotkey = HotKey::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
        self.manager.register(hotkey).map_err(|e| e.to_string())?;
        self.current_hotkey = Some(hotkey);
        Ok(())
    }

    #[allow(dead_code)]
    pub fn current_id(&self) -> Option<u32> {
        self.current_hotkey.map(|h| h.id())
    }
}
