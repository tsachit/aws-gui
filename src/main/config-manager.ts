import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as ini from 'ini'

const AWS_DIR = path.join(os.homedir(), '.aws')
const CONFIG_PATH = path.join(AWS_DIR, 'config')
const CREDENTIALS_PATH = path.join(AWS_DIR, 'credentials')

export interface AwsProfile {
  name: string
  region?: string
  output?: string
}

export interface AwsCredential {
  name: string
  aws_access_key_id?: string
  aws_secret_access_key?: string
  aws_session_token?: string
}

export interface AwsConfigData {
  profiles: AwsProfile[]
  credentials: AwsCredential[]
}

export function readAwsConfig(): AwsConfigData {
  let profiles: AwsProfile[] = []
  let credentials: AwsCredential[] = []

  if (fs.existsSync(CONFIG_PATH)) {
    const parsed = ini.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    profiles = Object.entries(parsed).map(([section, values]) => ({
      name: section.replace(/^profile /, ''),
      ...(values as Record<string, string>),
    }))
  }

  if (fs.existsSync(CREDENTIALS_PATH)) {
    const parsed = ini.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'))
    credentials = Object.entries(parsed).map(([section, values]) => ({
      name: section,
      ...(values as Record<string, string>),
    }))
  }

  return { profiles, credentials }
}

export function saveAwsConfig(profiles: AwsProfile[]): void {
  const obj: Record<string, unknown> = {}
  profiles.forEach(({ name, ...rest }) => {
    const key = name === 'default' ? 'default' : `profile ${name}`
    obj[key] = rest
  })
  fs.mkdirSync(AWS_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, ini.stringify(obj), { mode: 0o600 })
}

export function saveAwsCredentials(credentials: AwsCredential[]): void {
  const obj: Record<string, unknown> = {}
  credentials.forEach(({ name, ...rest }) => {
    obj[name] = rest
  })
  fs.mkdirSync(AWS_DIR, { recursive: true })
  fs.writeFileSync(CREDENTIALS_PATH, ini.stringify(obj), { mode: 0o600 })
}
