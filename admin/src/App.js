import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MaintenanceSidebar from './components/MaintenanceSidebar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StudentManagement from './pages/StudentManagement';
import Masterlist from './pages/Masterlist';
import PasswordResetRequests from './pages/PasswordResetRequests';
import ProgramManagement from './pages/ProgramManagement';
import AccountActivity from './pages/AccountActivity';
import AdminAccounts from './pages/AdminAccounts';
import MedicallyUnfit from './pages/MedicallyUnfit';
import StudentMonitoring from './pages/StudentMonitoring';
import ExportData from './pages/ExportData';
import OfficerManagement from './pages/OfficerManagement';
import Grades from './pages/Grades';
import Announcements from './pages/Announcements';
import Documents from './pages/Documents';
import Reports from './pages/Reports';
import Certificate from './pages/Certificate';
import CertificateTemplates from './pages/CertificateTemplates';
import AnnouncementTemplates from './pages/AnnouncementTemplates';
import Settings from './pages/Settings';
import SystemSettings from './pages/SystemMaintenance/SystemSettings';
import { useAuth } from './context/AuthContext';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <RoleShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

// system_maintenance_admin gets a completely separate shell — it must never
// render Sidebar.jsx's NSTP-data nav (Students, Grades, etc.), even hidden.
function RoleShell() {
  const { isSystemMaintenanceAdmin } = useAuth();
  return isSystemMaintenanceAdmin ? <MaintenanceAppShell /> : <AppShell />;
}

function MaintenanceAppShell() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <MaintenanceSidebar />
      <div style={{ flex: 1, marginLeft: '260px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/master-enrollment" replace />} />
          <Route path="/system-settings" element={<SystemSettings />} />
          <Route path="/master-enrollment" element={<Masterlist />} />
          <Route path="/password-reset-requests" element={<PasswordResetRequests />} />
          <Route path="/programs" element={<ProgramManagement />} />
          <Route path="/account-activity" element={<AccountActivity />} />
          <Route path="/admin-accounts" element={<AdminAccounts />} />
          <Route path="/certificate-templates" element={<CertificateTemplates />} />
          <Route path="/announcement-templates" element={<AnnouncementTemplates />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/master-enrollment" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function AppShell() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '260px' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/students" element={<StudentManagement />} />
          <Route path="/monitor-students" element={<StudentMonitoring />} />
          <Route path="/medically-unfit" element={<MedicallyUnfit />} />
          <Route path="/export-data" element={<ExportData />} />
          <Route path="/officers" element={<OfficerManagement />} />
          <Route path="/grades" element={<Grades />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/certificate" element={<Certificate />} />
          <Route
            path="/settings"
            element={
              <ProtectedRoute roles={['admin_cwts', 'admin_rotc', 'super_admin']}>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
