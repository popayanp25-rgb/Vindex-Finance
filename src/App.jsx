import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import HomeDashboard from './pages/HomeDashboard';
import ExpedientesView from './pages/ExpedientesView';
import CalendarView from './pages/CalendarView';
import TaskView from './pages/TaskView';
import CatalogsView from './pages/CatalogsView';
import UsersView from './pages/UsersView';
import Layout from './components/Layout';
import MyTasksView from './pages/MyTasksView';
import ArchivedTasksView from './pages/ArchivedTasksView';
import CrmView from './pages/CrmView';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<HomeDashboard />} />
              <Route path="/crm" element={<CrmView />} />
              <Route path="/expedientes" element={<ExpedientesView />} />
              <Route path="/tareas" element={<TaskView />} />
              <Route path="/mis-tareas" element={<MyTasksView />} />
              <Route path="/agenda" element={<CalendarView />} />
              <Route path="/catalogos" element={<CatalogsView />} />
              <Route path="/archivo-tareas" element={<ArchivedTasksView />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute requireAdmin={true} />}>
            <Route element={<Layout />}>
              <Route path="/personal" element={<UsersView />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
