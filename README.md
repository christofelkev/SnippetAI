# Snippets App

A fast, local-first desktop application designed to securely store, organize, and quickly access your code snippets and terminal commands. Built with modern web technologies and powered by a Rust backend, it offers lightning-fast search, one-click copying, and an intelligent AI-powered grouping feature.

## Features

- ⚡ **Instant Search**: Find snippets instantly with SQLite-powered real-time search.
- 📋 **Quick Copy**: Copy snippets to your clipboard with a single click.
- 🤖 **AI Grouping**: Automatically organize your snippets into logical groups using AI. Supports DeepSeek (default), Anthropic, and OpenAI.
- 🔗 **Smart Related Snippets**: Automatically discovers and links similar snippets based on content overlap—completely offline.
- 🛡️ **Local-First & Secure**: All your data is stored locally in an SQLite database on your machine (`%APPDATA%\com.snippets.app\snippets.db`).

## Technology Stack

- **Desktop Shell**: [Tauri 2](https://v2.tauri.app/)
- **Frontend**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Backend**: [Rust](https://www.rust-lang.org/)
- **Database**: [SQLite](https://sqlite.org/) (via `rusqlite`)

## Shortcuts

- <kbd>Ctrl</kbd> + <kbd>K</kbd> — Focus the search bar.
- <kbd>Ctrl</kbd> + <kbd>N</kbd> — Open the "Add New Snippet" panel.
- <kbd>Escape</kbd> — Close modals and panels.

## Getting Started

### Prerequisites
Make sure you have the following installed on your system:
- **Node.js** (v18+)
- **Rust** & Cargo
- **Visual Studio C++ Build Tools** (Required for compiling Rust on Windows)

### Installation

1. Clone or download this repository.
2. Install the frontend dependencies:
   ```bash
   npm install
   ```

### Development Mode

To run the application in development mode with Hot Module Replacement (HMR):
```bash
npm run tauri dev
```

### Compiling the App (Building Installers)

To compile the application into a standalone desktop installer (`.msi` and `.exe`):
```bash
npm run tauri build
```
Once the build is complete, your installer files will be located at:
`src-tauri/target/release/bundle/nsis/` and `src-tauri/target/release/bundle/msi/`.

## AI Configuration

The AI provider handles the intelligent grouping of your snippets. You can configure your AI provider directly inside the app through the **Settings** menu.

Alternatively, you can provide fallback environment variables by creating a `.env` file in the root of the project:
```env
VITE_AI_PROVIDER=deepseek        # options: deepseek | anthropic | openai
VITE_AI_API_KEY=sk-...           # your api key
VITE_AI_MODEL=deepseek-chat      # (optional) model override
```

> **Note:** Settings configured via the app's UI take priority over `.env` variables and are stored securely in your local SQLite database.
