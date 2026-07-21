import type { Screen } from '../../App'

interface Props {
  current: Screen
  onChange: (screen: Screen) => void
}

const ITEMS: { screen: Screen; label: string; icon: string }[] = [
  { screen: 'home', label: 'Inicio', icon: '🏠' },
  { screen: 'gastos', label: 'Gastos', icon: '💸' },
  { screen: 'calendario', label: 'Calendario', icon: '📅' },
  { screen: 'metas', label: 'Metas', icon: '🎯' },
  { screen: 'perfil', label: 'Perfil', icon: '🏆' },
]

export default function BottomNav({ current, onChange }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
      {ITEMS.map((item) => (
        <button
          key={item.screen}
          onClick={() => onChange(item.screen)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium ${
            current === item.screen
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}
        >
          <span className="text-xl">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}
