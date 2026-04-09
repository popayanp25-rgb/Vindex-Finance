import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ requireAdmin = false, blockColaborador = false }) {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-900 w-10 h-10" />
      </div>
    );
  }

  if (!currentUser) {
    // Si no está logueado, expulsar al login
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && userData?.rol !== 'admin') {
    // Si intenta entrar a una vista de administrador estricta, lo mandamos a caja
    return <Navigate to="/caja" replace />;
  }

  if (blockColaborador && userData?.rol === 'colaborador') {
    // Si el colaborador intenta forzar la URL de finanzas maestras, repeler hacia CRM
    return <Navigate to="/crm" replace />;
  }

  // Renderiza los sub-componentes (las vistas protegidas)
  return <Outlet />;
}
