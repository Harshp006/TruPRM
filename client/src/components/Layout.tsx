import React from 'react';
import { Outlet } from 'react-router-dom';
import TopNavbar from './TopNavbar';

const Layout: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopNavbar />
      <main style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ backgroundColor: 'white', border: '1px solid #999', padding: '15px', flex: 1 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
