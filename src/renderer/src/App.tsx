import { HashRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { useTheme } from './hooks/useTheme'
import { Dashboard } from './pages/Dashboard'
import { Pipeline } from './pages/Pipeline'
import { Instances } from './pages/Instances'
import { Logs } from './pages/Logs'
import { Secrets } from './pages/Secrets'
import { AwsConfig } from './pages/AwsConfig'

export function App() {
  const { theme, toggle } = useTheme()

  return (
    <HashRouter>
      <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
        <Sidebar theme={theme} onToggleTheme={toggle} />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/instances" element={<Instances />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/secrets" element={<Secrets />} />
            <Route path="/config" element={<AwsConfig />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
