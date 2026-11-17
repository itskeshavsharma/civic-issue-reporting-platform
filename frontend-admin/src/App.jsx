import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import AdminRoute from './routes/AdminRoute';
import AdminLogin from './pages/admin/AdminLogin';
import Dashboard from './pages/admin/Dashboard';
import MapConsole from './pages/admin/MapConsole';
import ComplaintsTable from './pages/admin/ComplaintsTable';
import ManageOfficers from './pages/admin/ManageOfficers';
import ResolvedIssues from './pages/admin/ResolvedIssues';
import MasterWards from './pages/admin/MasterWards';
import MasterDepartments from './pages/admin/MasterDepartments';
import Profile from './pages/admin/Profile';

function App() {
  return (
    <Routes>
      {/* Public Login Route (Email & Password Only) */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Protected Admin Console Routes */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="map" element={<MapConsole />} />
        <Route path="complaints" element={<ComplaintsTable />} />
        <Route path="resolved" element={<ResolvedIssues />} />
        <Route path="profile" element={<Profile />} />

        {/* Master Data: Super Admin ONLY */}
        <Route
          path="wards"
          element={
            <AdminRoute requireSuperAdmin={true}>
              <MasterWards />
            </AdminRoute>
          }
        />
        <Route
          path="departments"
          element={
            <AdminRoute requireSuperAdmin={true}>
              <MasterDepartments />
            </AdminRoute>
          }
        />

        {/* Manage Officers: Super Admin, Managing Officer, Ward Officer */}
        <Route
          path="officers"
          element={
            <AdminRoute allowedRoles={['super_admin', 'managing_officer', 'ward_officer']}>
              <ManageOfficers />
            </AdminRoute>
          }
        />
      </Route>

      {/* Root & Catch-all redirect to Admin Dashboard */}
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}

export default App;
