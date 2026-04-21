import { spawn, execSync, execFile } from 'child_process'

export interface RunnerCallbacks {
  onStdout: (line: string) => void
  onStderr: (line: string) => void
  onExit: (code: number | null) => void
}

/**
 * Builds a PATH string that includes common aws-cli install locations.
 * This makes the app standalone — no ~/.zshrc sourcing needed.
 */
function getAwsEnv(): NodeJS.ProcessEnv {
  const extraPaths = [
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/opt/homebrew/bin',          // Homebrew on Apple Silicon
    '/opt/homebrew/sbin',
    '/usr/local/sbin',
    '/opt/local/bin',             // MacPorts
    '/home/linuxbrew/.linuxbrew/bin', // Homebrew on Linux
  ]

  const currentPath = process.env.PATH ?? ''
  const allPaths = [...new Set([...currentPath.split(':'), ...extraPaths])]

  return {
    ...process.env,
    PATH: allPaths.join(':'),
  }
}

/**
 * Runs an AWS CLI command and streams output line by line.
 * Returns a kill function to cancel the process.
 */
export function runCommand(command: string, callbacks: RunnerCallbacks): () => void {
  const env = getAwsEnv()

  const child = spawn('sh', ['-c', command], { env })

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')

  child.stdout.on('data', (data: string) => {
    data.split('\n').forEach(line => {
      if (line.trim()) callbacks.onStdout(line)
    })
  })

  child.stderr.on('data', (data: string) => {
    data.split('\n').forEach(line => {
      if (line.trim()) callbacks.onStderr(line)
    })
  })

  child.on('close', (code) => callbacks.onExit(code))

  return () => child.kill()
}

/**
 * Runs a command synchronously and returns stdout as a string.
 * Used for structured data fetching (pipeline state, instance lists).
 */
export function runCommandSync(command: string): string {
  try {
    return execSync(command, {
      env: getAwsEnv(),
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
    }).toString('utf8')
  } catch (err: unknown) {
    const error = err as { stdout?: Buffer; stderr?: Buffer; message?: string }
    const stdout = error.stdout?.toString('utf8').trim()
    if (stdout) return stdout
    const stderr = error.stderr?.toString('utf8').trim()
    throw new Error(stderr ?? error.message ?? String(err))
  }
}

/**
 * Opens a terminal window on macOS and runs the given command.
 * SSH requires a real PTY which can't be emulated inside Electron without node-pty,
 * so we hand off to the user's preferred terminal app.
 */
export function openInTerminal(
  command: string,
  terminalApp: 'terminal' | 'iterm2' | 'warp' | 'custom' = 'iterm2',
  customTerminalCommand = ''
): void {
  if (terminalApp === 'warp') {
    execFile('open', [`warp://action/new_tab?cmd=${encodeURIComponent(command)}`])
    return
  }

  if (terminalApp === 'custom') {
    if (!customTerminalCommand) return
    // Replace {cmd} placeholder with the actual command
    const final = customTerminalCommand.replace(/\{cmd\}/g, command)
    spawn('sh', ['-c', final], { env: getAwsEnv(), detached: true, stdio: 'ignore' }).unref()
    return
  }

  const escaped = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const script = terminalApp === 'iterm2'
    ? `tell application "iTerm2"\n  create window with default profile\n  tell current session of current window\n    write text "${escaped}"\n  end tell\nend tell`
    : `tell application "Terminal"\n  do script "${escaped}"\n  activate\nend tell`

  execFile('osascript', ['-e', script])
}
