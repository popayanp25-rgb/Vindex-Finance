import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, Calendar, Database, LogOut, Users, X, Loader2, Mail, Lock, Archive, PieChart, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../firebase';

export default function Layout() {
  const location = useLocation();
  const { userData, logout } = useAuth();
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({ nombre: '', telefono: '', direccion: '' });
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Hook global de notificaciones push
  useEffect(() => {
    if (!userData?.uid && !userData?.id) return;
    const userId = userData.uid || userData.id;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const q = query(collection(db, 'tareas'), where('assigneeId', '==', userId));
    let isFirstRun = true;

    const unsub = onSnapshot(q, (snapshot) => {
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      
      snapshot.docChanges().forEach((change) => {
        if ("Notification" in window && Notification.permission === "granted") {
          const task = change.doc.data();
          // Solo notificar si la tarea cambió y es del usuario logueado en otra ventana, o nueva
          if (change.type === 'added') {
            new Notification('¡Nueva Tarea Asignada!', {
              body: `📌 ${task.title}\n📁 ${task.caseInfo || ''}`,
              icon: 'https://cdn-icons-png.flaticon.com/512/3276/3276856.png' // Icono neutral
            });
          } else if (change.type === 'modified') {
             // Opcional: Podrías notificar modificaciones importantes
             new Notification('Tarea Actualizada', {
               body: `La tarea "${task.title}" ha sido editada o comentada.`,
               icon: 'https://cdn-icons-png.flaticon.com/512/3276/3276856.png'
             });
          }
        }
      });
    });

    return () => unsub();
  }, [userData]);

  const openProfile = () => {
    setProfileData({
      nombre: userData?.nombre || '',
      telefono: userData?.telefono || '',
      direccion: userData?.direccion || ''
    });
    setProfileMsg({ text: '', type: '' });
    setIsProfileOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const userId = userData?.uid || userData?.id;
    if (!userId) {
       console.error("No se encontró el ID del usuario");
       return;
    }
    setIsSaving(true);
    setProfileMsg({ text: '', type: '' });
    
    try {
      await updateDoc(doc(db, 'users', userId), {
        nombre: profileData.nombre,
        telefono: profileData.telefono,
        direccion: profileData.direccion
      });
      setProfileMsg({ text: '¡Perfil actualizado con éxito!', type: 'success' });
      setTimeout(() => setIsProfileOpen(false), 2000);
    } catch(err) {
      console.error(err);
      setProfileMsg({ text: 'Error al actualizar perfil.', type: 'error' });
    }
    setIsSaving(false);
  };

  const handleSendPasswordReset = async () => {
     if (!userData?.email) {
        setProfileMsg({ text: 'No se encontró tu correo corporativo.', type: 'error' });
        return;
     }
     try {
       await sendPasswordResetEmail(auth, userData.email);
       setProfileMsg({ text: 'Correo enviado. Revisa tu bandeja de entrada o SPAM.', type: 'success' });
     } catch (err) {
       console.error(err);
       setProfileMsg({ text: 'Error al enviar el correo.', type: 'error' });
     }
  };

  const navigation = [
    { name: 'Dashboard Inicial', href: '/dashboard', icon: PieChart },
    { name: 'Directorio CRM', href: '/crm', icon: Users },
    { name: 'Control de Expedientes', href: '/expedientes', icon: LayoutDashboard },
    { name: 'Delegador de Tareas', href: '/tareas', icon: CheckSquare },
    { name: 'Mis Tareas', href: '/mis-tareas', icon: CheckSquare },
    { name: 'Calendario Corporativo', href: '/agenda', icon: Calendar },
    { name: 'Archivo de Tareas', href: '/archivo-tareas', icon: Archive },
    { name: 'Catálogos Base', href: '/catalogos', icon: Database },
  ];

  if (userData?.rol === 'admin') {
    navigation.push({ name: 'Personal', href: '/personal', icon: Users });
  }

  return (
    <div className="flex h-screen overflow-hidden font-sans glass-bg">
      {/* Sidebar navigation */}
      <div className="w-64 bg-brand-900/95 dark:bg-slate-950/90 backdrop-blur-xl border-r border-brand-800 dark:border-slate-800 flex flex-col shrink-0 shadow-xl z-20 transition-colors duration-500">
        <div className="h-20 flex items-center justify-center border-b border-brand-800 dark:border-slate-800">
          <div className="text-center">
            <h1 className="text-2xl font-black text-white tracking-tight">VINDEX</h1>
            <p className="text-brand-400 font-bold uppercase tracking-[0.2em] text-[8px] mt-0.5">Legal Group</p>
          </div>
        </div>
        
        <div className="flex-1 py-6 flex flex-col gap-2 overflow-y-auto custom-scrollbar px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                  isActive 
                    ? 'bg-brand-800 text-white shadow-md border-l-4 border-brand-400' 
                    : 'text-brand-300 hover:bg-brand-800/50 hover:text-white border-l-4 border-transparent'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-brand-400' : 'text-brand-400/70'} />
                <span className="text-sm tracking-wide">{item.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-brand-800 bg-brand-900">
          <div onClick={openProfile} className="flex items-center gap-3 mb-4 px-3 py-2.5 cursor-pointer hover:bg-brand-800 rounded-lg transition-all group" title="Editar Mi Perfil">
            <div className="w-10 h-10 rounded-lg bg-brand-700 flex items-center justify-center font-black text-white shadow-inner uppercase group-hover:bg-brand-600 transition-colors text-lg">
              {userData?.nombre ? userData.nombre.charAt(0) : 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-brand-50 tracking-wide group-hover:text-white transition-colors truncate">{userData?.nombre || 'Usuario'}</p>
              <p className="text-[10px] uppercase tracking-wider text-brand-400 font-bold mt-0.5">
                {userData?.rol === 'admin' ? 'Administrador' : 'Empleado'}
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="flex items-center justify-between px-4 py-2.5 w-full bg-brand-800/50 hover:bg-brand-800 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-brand-200 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider mb-2"
          >
            <span className="flex items-center gap-2">
               {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />} 
               Oscuro
            </span>
            <div className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${isDarkMode ? 'bg-blue-500' : 'bg-brand-900'}`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-4' : ''}`}></div>
            </div>
          </button>

          <button 
            onClick={logout}
            className="flex items-center justify-center gap-2 px-4 py-2.5 w-full bg-brand-800 hover:bg-brand-700 dark:bg-slate-800 dark:hover:bg-slate-700 hover:text-white text-brand-200 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider"
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* PROFILE MODAL */}
      {isProfileOpen && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col border border-brand-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-brand-50 border-b border-brand-200 px-6 py-4 flex items-center justify-between">
                 <h3 className="text-lg font-black text-brand-900 tracking-tight flex items-center gap-2">Mi Perfil</h3>
                 <button onClick={() => setIsProfileOpen(false)} className="text-brand-400 hover:text-brand-900 transition-colors bg-white rounded-full p-1.5 shadow-sm border border-brand-200"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto">
                 {profileMsg.text && (
                   <div className={`p-3 rounded-lg text-xs font-bold text-center border ${profileMsg.type === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                     {profileMsg.text}
                   </div>
                 )}
                 <form onSubmit={handleSaveProfile} className="space-y-4">
                   <div>
                      <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Nombre Completo <span className="text-red-500">*</span></label>
                      <input required value={profileData.nombre} onChange={e => setProfileData({...profileData, nombre: e.target.value})} className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-all font-medium text-brand-900" />
                   </div>
                   <div>
                      <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Teléfono (Celular) <span className="text-red-500">*</span></label>
                      <input required value={profileData.telefono} onChange={e => setProfileData({...profileData, telefono: e.target.value})} className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-all font-medium text-brand-900" />
                   </div>
                   <div>
                      <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Dirección</label>
                      <input value={profileData.direccion} onChange={e => setProfileData({...profileData, direccion: e.target.value})} className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-all font-medium text-brand-900" placeholder="Opcional" />
                   </div>
                   <div className="pt-2 flex justify-end gap-3 mt-4">
                      <button type="button" onClick={() => setIsProfileOpen(false)} className="px-5 py-2.5 text-brand-600 font-bold text-xs uppercase cursor-pointer hover:bg-brand-50 rounded-lg transition-colors tracking-wide border border-transparent">Cancelar</button>
                      <button disabled={isSaving} type="submit" className="bg-brand-900 hover:bg-brand-800 disabled:bg-brand-300 text-white px-6 py-2.5 rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide">
                         {isSaving ? <Loader2 className="animate-spin" size={16} /> : 'Actualizar'}
                      </button>
                   </div>
                 </form>
                 
                 <div className="border-t border-brand-100 pt-5 mt-4 text-center">
                    <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
                       <Lock size={12}/> Seguridad de la Cuenta
                    </label>
                    <button 
                      type="button" 
                      onClick={handleSendPasswordReset}
                      className="w-full bg-brand-50 border border-brand-200 text-brand-900 hover:bg-brand-100 px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                    >
                       <Mail size={16} className="text-brand-600"/>
                       Solicitar Cambio de Contraseña (Correo)
                    </button>
                    <p className="text-[9px] text-brand-400 mt-2 text-center leading-tight mx-2">
                       Se enviará un enlace automático a tu correo registrado para que cambies tu clave de forma privada y segura.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 glass-panel border-b-0 flex items-center justify-between px-10 shrink-0 shadow-sm relative z-10 rounded-none border-t-0 border-x-0">
          <h2 className="text-xl font-black text-brand-900 dark:text-white tracking-tight">
             {navigation.find(n => location.pathname.startsWith(n.href))?.name || "Panel de Comando"}
          </h2>
          <div className="hidden"></div>
        </header>

        <main className="flex-1 overflow-auto p-8 relative custom-scrollbar z-0">
           <AnimatePresence mode="wait">
             <motion.div
               key={location.pathname}
               initial={{ opacity: 0, scale: 0.98, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.98, y: -10 }}
               transition={{ duration: 0.4, ease: "easeOut" }}
               className="h-full"
             >
               <Outlet />
             </motion.div>
           </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
