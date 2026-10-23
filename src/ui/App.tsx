import { useState } from 'react';
import { TabBar, type Tab } from './TabBar';

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
      {tab === 'workout' && <Placeholder title="Тренировка" />}
      {tab === 'progress' && <Placeholder title="Прогресс" />}
      {tab === 'nutrition' && <Placeholder title="Питание" />}
      {tab === 'profile' && <Placeholder title="Профиль" />}
      <TabBar tab={tab} onChange={setTab} />
    </>
  );
}
