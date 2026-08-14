import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import QuickPaste from "./components/QuickPaste";
import "./App.css";
import "highlight.js/styles/github-dark.css";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

/**
 * Pick the root by window label. Tauri injects `__TAURI_INTERNALS__` in a
 * document-creation script, but this module runs at import time — if those
 * internals are not there yet (or we are in a plain browser), reading the
 * label throws and would blank the whole window. Fall back to the main app
 * instead: a wrong-but-visible UI beats a white screen.
 */
function resolveRoot() {
  try {
    return getCurrentWebviewWindow().label === "quickpaste" ? QuickPaste : App;
  } catch (err) {
    console.error("Could not read the window label; defaulting to main app.", err);
    return App;
  }
}

const Root = resolveRoot();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
