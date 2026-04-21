const colorMap: Record<string, string> = {
  Succeeded: 'bg-green-500',
  InProgress: 'bg-blue-500 animate-pulse',
  Failed: 'bg-red-500',
  Stopped: 'bg-gray-500',
  Abandoned: 'bg-gray-600',
  Superseded: 'bg-gray-400',
}

export function StatusBadge({ status }: { status: string }) {
  const color = colorMap[status] ?? 'bg-gray-400'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white ${color}`}
    >
      {status}
    </span>
  )
}
