import { useNavigate } from 'react-router-dom'
import { GitBranch, Server, ScrollText, Lock, KeyRound } from 'lucide-react'

const actions = [
  {
    label: 'Pipeline Status',
    description: 'View all CodePipeline stages, approve or reject deployments',
    icon: GitBranch,
    to: '/pipeline',
    color: 'border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950',
  },
  {
    label: 'Browse Instances',
    description: 'List ECS container instances and open SSM sessions',
    icon: Server,
    to: '/instances',
    color: 'border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950',
  },
  {
    label: 'CloudWatch Logs',
    description: 'Search log groups or live-tail streaming logs',
    icon: ScrollText,
    to: '/logs',
    color: 'border-green-500 hover:bg-green-50 dark:hover:bg-green-950',
  },
  {
    label: 'Secrets Manager',
    description: 'Browse, reveal, copy, and edit AWS secrets',
    icon: Lock,
    to: '/secrets',
    color: 'border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-950',
  },
  {
    label: 'AWS Credentials',
    description: 'Edit ~/.aws/config and ~/.aws/credentials',
    icon: KeyRound,
    to: '/config',
    color: 'border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950',
  }
]

export function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-2">Dashboard</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">Quick access to your AWS tools</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map(({ label, description, icon: Icon, to, color }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`flex flex-col items-start gap-3 p-5 rounded-xl border-2 transition-colors text-left ${color}`}
          >
            <Icon size={24} className="opacity-80" />
            <div>
              <p className="font-semibold">{label}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
