import React from 'react';

const Header: React.FC = () => {
  return (
    <header style={{ padding: '1rem 2rem', backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h2 style={{ margin: 0 }}>HR & Payroll</h2>
      <div>
        <span>User Profile</span>
      </div>
    </header>
  );
};

export default Header;
