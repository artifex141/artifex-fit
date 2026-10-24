import './tabbar.css';

export type Tab = 'workout' | 'progress' | 'nutrition' | 'profile';

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  {
    id: 'workout',
    label: 'Тренировка',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12" />
      </svg>
    ),
  },
  {
    id: 'progress',
    label: 'Прогресс',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M6 20v-6M12 20V9M18 20V4" />
      </svg>
    ),
  },
  {
    id: 'nutrition',
    label: 'Питание',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Куриная ножка: мясо сверху справа, косточка с двумя шариками снизу слева */}
        <path d="M9 15.2C7.6 11.6 8.6 6.6 12.1 4.3c3.5-2.3 8.4-.9 9 3.5.6 4.5-3.8 8.2-8.8 8.4-1.4.1-2.6-.2-3.3-1z" />
        <path d="M13.2 6.6c1.3-.7 3-.6 4 .3" />
        <path d="M9 15.2l-3.4 3.4" />
        <circle cx="4.3" cy="18.1" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="6.1" cy="19.9" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Профиль',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" />
      </svg>
    ),
  },
];

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t.id} className={t.id === tab ? 'tab on' : 'tab'} onClick={() => onChange(t.id)}>
          <span className="tab-icon">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
