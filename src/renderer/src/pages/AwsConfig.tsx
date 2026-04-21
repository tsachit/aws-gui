import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { AwsProfile, AwsCredential } from '../types/electron-api'

export function AwsConfig() {
  const [profiles, setProfiles] = useState<AwsProfile[]>([])
  const [credentials, setCredentials] = useState<AwsCredential[]>([])
  const [saved, setSaved] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)

  useEffect(() => {
    window.electronAPI.getAwsConfig().then(data => {
      setProfiles(data.profiles)
      setCredentials(data.credentials)
    })
  }, [])

  const handleSave = async () => {
    await window.electronAPI.saveAwsConfig(profiles)
    await window.electronAPI.saveAwsCredentials(credentials)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateProfile = (i: number, field: keyof AwsProfile, value: string) => {
    setProfiles(prev => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)))
  }

  const updateCredential = (i: number, field: keyof AwsCredential, value: string) => {
    setCredentials(prev => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)))
  }

  const addProfile = () =>
    setProfiles(prev => [...prev, { name: 'new-profile', region: 'us-east-1', output: 'json' }])
  const removeProfile = (i: number) => setProfiles(prev => prev.filter((_, idx) => idx !== i))

  const addCredential = () =>
    setCredentials(prev => [
      ...prev,
      { name: 'new-profile', aws_access_key_id: '', aws_secret_access_key: '' },
    ])
  const removeCredential = (i: number) =>
    setCredentials(prev => prev.filter((_, idx) => idx !== i))

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">AWS Config</h2>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white ${
            saved ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'
          }`}
        >
          <Save size={14} />
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Config profiles (~/.aws/config) */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">~/.aws/config profiles</h3>
          <button
            onClick={addProfile}
            className="flex items-center gap-1 text-sm text-purple-500 hover:text-purple-600"
          >
            <Plus size={14} /> Add Profile
          </button>
        </div>
        <div className="space-y-3">
          {profiles.map((profile, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                    Profile Name
                  </label>
                  <input
                    value={profile.name}
                    onChange={e => updateProfile(i, 'name', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                    Region
                  </label>
                  <input
                    value={profile.region ?? ''}
                    onChange={e => updateProfile(i, 'region', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                    Output
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={profile.output ?? 'json'}
                      onChange={e => updateProfile(i, 'output', e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                    >
                      <option value="json">json</option>
                      <option value="table">table</option>
                      <option value="text">text</option>
                    </select>
                    <button
                      onClick={() => removeProfile(i)}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {profiles.length === 0 && (
            <p className="text-sm text-gray-400 italic">No profiles found in ~/.aws/config</p>
          )}
        </div>
      </section>

      {/* Credentials (~/.aws/credentials) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">~/.aws/credentials</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSecrets(s => !s)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {showSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
              {showSecrets ? 'Hide keys' : 'Show keys'}
            </button>
            <button
              onClick={addCredential}
              className="flex items-center gap-1 text-sm text-purple-500 hover:text-purple-600"
            >
              <Plus size={14} /> Add Profile
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {credentials.map((cred, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3"
            >
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                    Profile Name
                  </label>
                  <input
                    value={cred.name}
                    onChange={e => updateCredential(i, 'name', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
                  />
                </div>
                <button
                  onClick={() => removeCredential(i)}
                  className="text-red-400 hover:text-red-600 p-1 mt-5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Access Key ID
                </label>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={cred.aws_access_key_id ?? ''}
                  onChange={e => updateCredential(i, 'aws_access_key_id', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Secret Access Key
                </label>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={cred.aws_secret_access_key ?? ''}
                  onChange={e => updateCredential(i, 'aws_secret_access_key', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
                />
              </div>
              {cred.aws_session_token !== undefined && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                    Session Token
                  </label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={cred.aws_session_token ?? ''}
                    onChange={e => updateCredential(i, 'aws_session_token', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
                  />
                </div>
              )}
            </div>
          ))}
          {credentials.length === 0 && (
            <p className="text-sm text-gray-400 italic">No credentials found in ~/.aws/credentials</p>
          )}
        </div>
      </section>
    </div>
  )
}
