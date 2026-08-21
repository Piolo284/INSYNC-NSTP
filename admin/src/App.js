import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StudentManagement from './pages/StudentManagement';
import MedicallyUnfit from './pages/MedicallyUnfit';
import StudentMonitoring from './pages/StudentMonitoring';
import ExportData from './pages/ExportData';
import OfficerManagement from './pages/OfficerManagement';
import Activities from './pages/Activities';
import AttendancePage from './pages/Attendance';
import Modules from './pages/Modules';
import Submissions from './pages/Submissions';
import Grades from './pages/Grades';
import Announcements from './pages/Announcements';
import Documents from './pages/Documents';
import Reports from './pages/Reports';
import Certificate from './pages/Certificate';
import Settings from './pages/Settings';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
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
          <Route path="/activities" element={<Activities />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/modules" element={<Modules />} />
          <Route path="/submissions" element={<Submissions />} />
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
