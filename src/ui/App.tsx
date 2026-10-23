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
