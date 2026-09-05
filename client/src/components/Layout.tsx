import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AttendanceToggleWidget from './AttendanceToggleWidget';

const Layout: React.FC = () => {
  return (
    <div className="flex h-screen bg-[#F0F4F8] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="text-sm font-medium text-slate-500">TruPRM Management System</div>
          <div className="flex items-center gap-4">
            <AttendanceToggleWidget compact />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
