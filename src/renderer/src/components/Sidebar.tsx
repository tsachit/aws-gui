import { NavLink } from 'react-router-dom'
import { LayoutDashboard, GitBranch, Server, ScrollText, Lock, KeyRound, Sun, Moon } from 'lucide-react'
import logo from '../assets/logo.png'

interface SidebarProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { to: '/instances', label: 'Instances', icon: Server },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/secrets', label: 'Secrets', icon: Lock },
  { to: '/config', label: 'AWS Config', icon: KeyRound },
]

export function Sidebar({ theme, onToggleTheme }: SidebarProps) {
  return (
    <aside className="flex flex-col w-56 min-h-screen bg-gray-900 dark:bg-gray-950 text-white border-r border-gray-700 dark:border-gray-800 shrink-0">
      <div className="px-4 py-5 border-b border-gray-700 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <img src={logo} alt="AWS GUI" className="w-7 h-7 rounded-md" />
          <h1 className="text-lg font-bold tracking-wide text-white">AWS GUI</h1>
        </div>
      </div>
      <nav className="flex-1 py-4 space-y-1 px-2">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-gray-700 dark:border-gray-800">
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </aside>
  )
}
