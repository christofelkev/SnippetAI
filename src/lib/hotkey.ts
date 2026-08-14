import { register, unregister, unregisterAll, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export const DEFAULT_HOTKEY = 'CmdOrCtrl+Shift+Space';

async function showQuickPaste() {
  const win = await WebviewWindow.getByLabel('quickpaste');
  if (win) {
    await win.show();
    await win.setFocus();
  }
}

/** Register a global accelerator, replacing it first if already bound. */
export async function registerHotkey(accelerator: string): Promise<void> {
  if (await isRegistered(accelerator)) {
    await unregister(accelerator);
  }
  await register(accelerator, event => {
    if (event.state === 'Pressed') showQuickPaste();
  });
}

/** Clear any existing bindings and register the given accelerator. */
export async function rebindHotkey(accelerator: string): Promise<void> {
  await unregisterAll();
  await registerHotkey(accelerator);
}
