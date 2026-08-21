import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import StudentManagement from './pages/StudentManagement';
import MedicallyUnfit from './pages/MedicallyUnfit';
import StudentMonitoring from './pages/StudentMonitoring';
import ExportData from './pages/ExportData';
import Grades from './pages/Grades';
import Announcements from './pages/Announcements';
import Certificate from './pages/Certificate';
import Reports from './pages/Reports';
import Instructors from './pages/Instructors';

function App() {
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
          <Route path="/officers" element={<Placeholder title="Officers" />} />
          <Route path="/instructors" element={<Instructors />} />
          <Route path="/grades" element={<Grades />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/documents" element={<Placeholder title="Documents" />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/certificate" element={<Certificate />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function Placeholder({ title }) {
  return (
    <div style={{ padding: '120px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
      <h2>{title} Page</h2>
      <p style={{ marginTop: '8px' }}>This page is under construction.</p>
    </div>
  );
}

export default App;
