import { useState } from 'react';
import { NutritionScreen } from './nutrition/NutritionScreen';
import { CycleDialog } from './profile/CycleDialog';
import { ProfileScreen } from './profile/ProfileScreen';
import { ProgressScreen } from './progress/ProgressScreen';
import { TabBar, type Tab } from './TabBar';
import { WorkoutScreen } from './workout/WorkoutScreen';

export function App() {
  const [tab, setTab] = useState<Tab>('workout');
  const [endingCycle, setEndingCycle] = useState<number | null>(null);
  return (
    <>
      {tab === 'workout' && <WorkoutScreen onCycleEnd={setEndingCycle} />}
      {tab === 'progress' && <ProgressScreen />}
      {tab === 'nutrition' && <NutritionScreen />}
      {tab === 'profile' && <ProfileScreen onNewCycle={setEndingCycle} />}
      <TabBar tab={tab} onChange={setTab} />
      <div className="rotate-lock">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
          <path d="M11 18.5h2" />
        </svg>
        Поверни телефон вертикально
      </div>
      {endingCycle !== null && (
        <CycleDialog
          cycle={endingCycle}
          onClose={() => {
            setEndingCycle(null);
            setTab('workout');
          }}
        />
      )}
    </>
  );
}
