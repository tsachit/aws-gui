# AWS GUI

A desktop app that wraps common AWS CLI operations in a clean, fast GUI. Built with Electron + React + TypeScript.

No vendor lock-in, no SaaS — it runs entirely on your machine using your existing AWS credentials.

---

## Features

| Page | What it does |
|------|-------------|
| **Pipeline** | List all CodePipeline pipelines, view stage-by-stage status, approve or reject manual approval gates |
| **Instances** | Browse ECS clusters and services, list container instances, open SSM sessions in your terminal |
| **CloudWatch Logs** | Search log groups with time range + filter pattern, or live-tail streaming logs |
| **Secrets Manager** | Browse secrets, reveal values, copy to clipboard, edit and save |
| **AWS Credentials** | View and edit `~/.aws/config` and `~/.aws/credentials` directly in the app |

All data is cached locally (stale-while-revalidate) so the UI never shows a blank screen while AWS responds. Every dynamic list has a reload button for manual force-refresh.

---

## Prerequisites

- **Node.js** 18+
- **AWS CLI v2** installed and on your `PATH`
- AWS credentials configured (`aws configure` or `~/.aws/credentials`)
- For SSM sessions: [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) installed

The app shells out to the AWS CLI under the hood — it uses whatever profile and region are set in your `~/.aws/config`.

---

## Getting Started

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build for production (macOS)
npm run build:mac

# Build for production (Windows)
npm run build:win

# Build for production (Linux)
npm run build:linux
```

---

## How It Works

```
Renderer (React)
     │
     │  window.electronAPI.*
     ▼
Preload (contextBridge)
     │
     │  ipcRenderer.invoke
     ▼
Main Process (ipc-handlers.ts)
     │
     │  execa / child_process
     ▼
AWS CLI
```

- **`src/main/aws-commands.ts`** — all AWS CLI calls (`aws codepipeline`, `aws ecs`, `aws logs`, `aws secretsmanager`, etc.)
- **`src/main/ipc-handlers.ts`** — registers IPC handlers that the renderer can call
- **`src/preload/index.ts`** — exposes a typed `window.electronAPI` to the renderer via `contextBridge`
- **`src/renderer/src/cache.ts`** — module-level TTL cache that survives React navigation
- **`src/renderer/src/pages/`** — one file per page

---

## Caching

Each data source has its own TTL:

| Data | TTL |
|------|-----|
| ECS clusters / services | 10 min |
| CloudWatch log groups | 10 min |
| Secrets list | 5 min |
| Pipeline state | 2 min |

On mount, pages seed their UI from the cache instantly, then background-refresh. Use the ↺ reload buttons to force a fresh fetch at any time.

---

## Terminal Integration

On the Instances page, choose which terminal opens when you click **Connect**:

- **iTerm2**
- **Warp**
- **Terminal** (macOS built-in)
- **Custom** — supply your own command template using `{cmd}` as the placeholder, e.g. `kitty -- zsh -c "{cmd}"`

The preference is persisted across sessions.

---

## Tech Stack

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/)
- [React 18](https://react.dev/) + [React Router](https://reactrouter.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [electron-store](https://github.com/sindresorhus/electron-store) for settings persistence
