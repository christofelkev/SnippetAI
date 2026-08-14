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

/**
 * Clear any existing bindings and register the given accelerator.
 * If registration fails, best-effort restore `previous` so the app never
 * ends up with no working hotkey, then re-throw the original error.
 */
export async function rebindHotkey(accelerator: string, previous: string): Promise<void> {
  await unregisterAll();
  try {
    await registerHotkey(accelerator);
  } catch (err) {
    try {
      await registerHotkey(previous);
    } catch {
      // best-effort restore only; don't mask the original failure
    }
    throw err;
  }
}
