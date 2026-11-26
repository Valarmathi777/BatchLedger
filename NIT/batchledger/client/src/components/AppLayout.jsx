import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppLayout() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="page flex-1">
        <Outlet />
      </main>
    </div>
  );
}
