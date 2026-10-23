import { useState } from 'react';
import { TabBar, type Tab } from './TabBar';
import { ProgressScreen } from './progress/ProgressScreen';
import { WorkoutScreen } from './workout/WorkoutScreen';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="screen">
      <h1 className="screen-title">{title}</h1>
    </div>
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>('workout');
  return (
    <>
      {tab === 'workout' && <WorkoutScreen />}
      {tab === 'progress' && <ProgressScreen />}
      {tab === 'nutrition' && <Placeholder title="Питание" />}
      {tab === 'profile' && <Placeholder title="Профиль" />}
      <TabBar tab={tab} onChange={setTab} />
    </>
  );
}
