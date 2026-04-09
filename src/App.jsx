import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import HonorariosFijosView from './pages/IngresosView';
import HonorariosVariablesView from './pages/HonorariosVariablesView';
import CalendarView from './pages/CalendarView';
import UsersView from './pages/UsersView';
import Layout from './components/Layout';
import CrmView from './pages/CrmView';
import EgresosView from './pages/EgresosView';
import TributacionView from './pages/TributacionView';
import CajaView from './pages/CajaView';
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/caja" replace />} />
          <Route path="/dashboard" element={<Navigate to="/caja" replace />} />
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/crm" element={<CrmView />} />
              <Route path="/honorarios-fijos" element={<HonorariosFijosView />} />
              <Route path="/honorarios-variables" element={<HonorariosVariablesView />} />
              <Route path="/egresos" element={<EgresosView />} />
              <Route path="/agenda" element={<CalendarView />} />
              <Route path="/personal" element={<UsersView />} />
              
              <Route element={<ProtectedRoute blockColaborador={true} />}>
                <Route path="/tributacion" element={<TributacionView />} />
                <Route path="/caja" element={<CajaView />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
