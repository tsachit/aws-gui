import Store from 'electron-store'

export type TerminalApp = 'terminal' | 'iterm2' | 'warp' | 'custom'

export interface AppSettings {
  terminalApp: TerminalApp
  customTerminalCommand: string
}

const DEFAULT_SETTINGS: AppSettings = {
  terminalApp: 'iterm2',
  customTerminalCommand: '',
}

const store = new Store<AppSettings>({
  name: 'app-settings',
  defaults: DEFAULT_SETTINGS,
})

export function getSettings(): AppSettings {
  return {
    terminalApp: store.get('terminalApp'),
    customTerminalCommand: store.get('customTerminalCommand'),
  }
}

export function saveSettings(settings: Partial<AppSettings>): void {
  if (settings.terminalApp !== undefined) store.set('terminalApp', settings.terminalApp)
  if (settings.customTerminalCommand !== undefined) store.set('customTerminalCommand', settings.customTerminalCommand)
}

export function resetSettings(): void {
  store.clear()
}
