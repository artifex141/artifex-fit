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
        <path d="M12 7c-1.5-1.5-6-2-7 2.5S7 20 9.5 20c1 0 1.5-.5 2.5-.5s1.5.5 2.5.5C17 20 20 14 19 9.5S13.5 5.5 12 7z" />
        <path d="M12 7c0-2 1-3.5 3-4" />
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
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
