import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '../components/Layout';

import Dashboard from '../pages/Dashboard';
import Employees from '../pages/Employees';
import Contracts from '../pages/Contracts';
import Attendance from '../pages/Attendance';
import TimeOff from '../pages/TimeOff';
import SalaryStructures from '../pages/SalaryStructures';
import SalaryRules from '../pages/SalaryRules';
import Payruns from '../pages/Payruns';
import Payslips from '../pages/Payslips';
import Users from '../pages/Users';
import Settings from '../pages/Settings';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="time-off" element={<TimeOff />} />
        <Route path="salary-structures" element={<SalaryStructures />} />
        <Route path="salary-rules" element={<SalaryRules />} />
        <Route path="payruns" element={<Payruns />} />
        <Route path="payslips" element={<Payslips />} />
        <Route path="users" element={<Users />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
