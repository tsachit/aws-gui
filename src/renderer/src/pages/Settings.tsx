import { useState, useEffect } from 'react'
import { AppSettings, TerminalApp } from '../types/electron-api'

export function Settings() {
  const [terminalApp, setTerminalApp] = useState<TerminalApp>('iterm2')
  const [customTerminalCommand, setCustomTerminalCommand] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.electronAPI.getSettings().then(s => {
      setTerminalApp(s.terminalApp)
      setCustomTerminalCommand(s.customTerminalCommand)
    })
  }, [])

  const save = async (patch: Partial<AppSettings>) => {
    await window.electronAPI.saveSettings(patch)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="p-8 max-w-xl">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold mb-1">Terminal App</h3>
        <p className="text-xs text-gray-400 mb-4">
          Which terminal opens when you click Connect on an instance.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {(['iterm2', 'warp', 'terminal', 'custom'] as TerminalApp[]).map(t => (
            <button
              key={t}
              onClick={() => {
                setTerminalApp(t)
                save({ terminalApp: t })
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                terminalApp === t
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'
              }`}
            >
              {t === 'iterm2' ? 'iTerm2' : t === 'warp' ? 'Warp' : t === 'custom' ? 'Custom…' : 'Terminal'}
            </button>
          ))}
        </div>

        {terminalApp === 'custom' && (
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
              Command template — use <code className="font-mono">{'{cmd}'}</code> for the SSH command
            </label>
            <input
              value={customTerminalCommand}
              onChange={e => setCustomTerminalCommand(e.target.value)}
              onBlur={() => save({ customTerminalCommand })}
              placeholder={`kitty -- zsh -c "{cmd}"`}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {saved && (
          <p className="text-xs text-green-500 mt-3">✓ Saved</p>
        )}
      </section>
    </div>
  )
}
