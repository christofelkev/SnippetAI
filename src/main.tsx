import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import QuickPaste from "./components/QuickPaste";
import "./App.css";
import "highlight.js/styles/github-dark.css";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const Root = getCurrentWebviewWindow().label === "quickpaste" ? QuickPaste : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
