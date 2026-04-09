import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { secondaryAuth } from '../utils/firebaseSecondary';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Loader2, User, Pencil, Trash2, Mail, Briefcase, Zap } from 'lucide-react';

export default function UsersView() {
  const [users, setUsers] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userData } = useAuth();
  
  const [activeTab, setActiveTab] = useState('empleados');
  
  useEffect(() => {
     if (userData?.rol && userData.rol !== 'admin') {
         setActiveTab('socios');
     }
  }, [userData]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null); 
  
  const initialForm = { nombre: '', email: '', password: '', rol: 'user', dni: '', telefono: '', direccion: '' };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubSocios = onSnapshot(collection(db, 'socios'), (snapshot) => {
      setSocios(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubUsers(); unsubSocios(); };
  }, []);

  // --- ESTADO PARA SOCIOS ---
  const [isSocioModalOpen, setIsSocioModalOpen] = useState(false);
  const [editingSocioId, setEditingSocioId] = useState(null);
  const [socioFormData, setSocioFormData] = useState({ 
     nombres: '', apellidos: '', dni: '', celular: '', porcentaje: 0 
  });
  const [tempSociosList, setTempSociosList] = useState([]);
  
  const sumTotalSocios = Number(socioFormData.porcentaje) + tempSociosList.reduce((acc, s) => acc + Number(s.porcentaje), 0);
  const isSocioValid = sumTotalSocios === 100;

  const openSocioModal = (socio = null) => {
      if (socio) {
          setEditingSocioId(socio.id);
          setSocioFormData({
             nombres: socio.nombres || '',
             apellidos: socio.apellidos || '',
             dni: socio.dni || '',
             celular: socio.celular || '',
             porcentaje: socio.porcentaje || 0
          });
          setTempSociosList(socios.filter(s => s.id !== socio.id).map(s => ({...s})));
      } else {
          setEditingSocioId(null);
          setSocioFormData({
             nombres: '', apellidos: '', dni: '', celular: '', porcentaje: 0
          });
          setTempSociosList(socios.map(s => ({...s})));
      }
      setIsSocioModalOpen(true);
  };

  const handleTempSocioChange = (id, newVal) => {
      const val = Number(newVal) || 0;
      setTempSociosList(prev => prev.map(s => s.id === id ? {...s, porcentaje: val} : s));
  };

  const handleSaveSocio = async (e) => {
      e.preventDefault();
      if (!isSocioValid) {
          alert('La suma de participaciones debe ser exactamente 100%');
          return;
      }
      setIsSaving(true);
      try {
          // Update temp socios
          for (let ts of tempSociosList) {
             const originalSocio = socios.find(s => s.id === ts.id);
             if (originalSocio && originalSocio.porcentaje !== ts.porcentaje) {
                 await updateDoc(doc(db, 'socios', ts.id), {
                     porcentaje: ts.porcentaje
                 });
             }
          }
          // Save main socio
          const docData = {
              nombres: socioFormData.nombres,
              apellidos: socioFormData.apellidos,
              dni: socioFormData.dni,
              celular: socioFormData.celular,
              porcentaje: Number(socioFormData.porcentaje),
              documento: 'Socio Fundador'
          };
          if (editingSocioId) {
             await updateDoc(doc(db, 'socios', editingSocioId), docData);
          } else {
             const newDocRef = doc(collection(db, 'socios'));
             await setDoc(newDocRef, docData);
          }
          setIsSocioModalOpen(false);
      } catch (err) {
          console.error(err);
          alert('Error al guardar socio: ' + err.message);
      }
      setIsSaving(false);
  };

  const handleDeleteSocio = async (s) => {
      if (s.porcentaje > 0) {
          alert(`No puedes eliminar a ${s.nombres} porque posee el ${s.porcentaje}% de participaciones. Primero edítalo y asígnale 0%, transfiriendo su porcentaje a otro socio.`);
          return;
      }
      if (window.confirm(`¿Estás seguro de eliminar a ${s.nombres} del control de sociedad?`)) {
          await deleteDoc(doc(db, 'socios', s.id));
      }
  };

  // --- ESTADO PARA USUARIOS ---
  const openAddModal = () => {
    setFormData(initialForm);
    setEditingUserId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setFormData({
      nombre: user.nombre || '',
      email: user.email || '',
      password: '', // Ignorado al editar
      rol: user.rol || 'user',
      dni: user.dni || '',
      telefono: user.telefono || '',
      direccion: user.direccion || ''
    });
    setEditingUserId(user.id);
    setIsModalOpen(true);
  };

  const handleResetPassword = async () => {
    if (!formData.email || formData.email.trim() === '') {
      alert("Por favor, escriba primero un correo electrónico válido en la casilla de arriba antes de enviar la alerta de contraseña.");
      return;
    }
    try {
      if(!window.confirm(`Se le enviará un correo oficial a ${formData.email} con un enlace seguro para que el usuario escriba su nueva contraseña. ¿Proceder?`)) return;
      await sendPasswordResetEmail(auth, formData.email);
      alert(`Éxito. Se ha enviado un correo a ${formData.email} con las instrucciones para restablecer la contraseña.`);
    } catch (error) {
      console.error("Error sending password reset email", error);
      alert("Error al intentar enviar el correo. Verifique que la dirección sea válida u oprima 'Guardar Cambios' primero.");
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingUserId) {
        // MODO EDICION
        await setDoc(doc(db, 'users', editingUserId), {
          nombre: formData.nombre,
          rol: formData.rol,
          dni: formData.dni,
          telefono: formData.telefono,
          direccion: formData.direccion,
          email: formData.email 
        }, { merge: true });
        
      } else {
        // MODO CREACION
        const credential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        await setDoc(doc(db, 'users', credential.user.uid), {
          nombre: formData.nombre,
          email: formData.email,
          rol: formData.rol,
          dni: formData.dni,
          telefono: formData.telefono,
          direccion: formData.direccion
        });
        await signOut(secondaryAuth);
      }
      
      setIsModalOpen(false);
      setFormData(initialForm);
      setEditingUserId(null);
    } catch (error) {
      console.error("Error al guardar usuario:", error);
      alert("Error al guardar el usuario. Verifique los datos ingresados.");
    }
    setIsSaving(false);
  };

  const handleDelete = async (id, nombre) => {
    if(window.confirm(`¿Está seguro de eliminar a ${nombre} de la plataforma? (Nota: Esto borra su acceso al ecosistema, debiendo eliminar también el correo en Firebase Console)`)) {
      await deleteDoc(doc(db, 'users', id));
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-900 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-5 max-w-6xl mx-auto w-full">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end bg-white p-6 rounded-xl shadow-sm border border-brand-200 gap-4 shrink-0">
        <div className="flex-1">
          <h1 className="text-xl font-black text-brand-900 tracking-tight flex items-center gap-3">
             <User className="text-brand-500" />
             Administración General
          </h1>
          <p className="text-xs font-medium text-brand-500 mt-1">Directorio corporativo VINDEX: Empleados y Socios comerciales.</p>
          
          <div className="flex gap-2 mt-4 bg-brand-50/50 block w-fit p-1 rounded-xl border border-brand-100">
             {userData?.rol === 'admin' && (
                 <button 
                    onClick={() => setActiveTab('empleados')} 
                    className={`py-2 px-5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'empleados' ? 'bg-white shadow-sm text-brand-900' : 'text-brand-500 hover:text-brand-700'}`}
                 >
                    <User size={14} className="inline mr-1.5"/> Equipo & Colaboradores
                 </button>
             )}
             <button 
                onClick={() => setActiveTab('socios')} 
                className={`py-2 px-5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'socios' ? 'bg-white shadow-sm text-brand-900' : 'text-brand-500 hover:text-brand-700'}`}
             >
                <Briefcase size={14} className="inline mr-1.5"/> Control de Sociedad
             </button>
          </div>
        </div>
        
        <div className="flex gap-3 mt-4 md:mt-0 items-center">
            {activeTab === 'empleados' && (
                <button 
                  onClick={openAddModal}
                  className="bg-brand-900 hover:bg-brand-800 text-white px-6 py-3 rounded-lg font-bold shadow-md transition-all flex items-center gap-2 text-xs uppercase tracking-wider"
                >
                  <Plus size={18} />
                  Registrar Colaborador
                </button>
            )}
        </div>
      </div>

      {/* TABLE */}
      {/* TABLA COLABORADORES */}
      {activeTab === 'empleados' && (
          <div className="bg-white rounded-xl shadow-sm border border-brand-200 overflow-hidden flex-1 animate-in fade-in duration-300">
            <div className="overflow-x-auto h-full custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-50 text-brand-900 text-[10px] uppercase tracking-widest font-bold border-b border-brand-100">
                    <th className="px-6 py-4">Empleado / Acceso</th>
                    <th className="px-6 py-4">Rol en Sistema</th>
                    <th className="px-6 py-4">Contacto (Celular)</th>
                    <th className="px-6 py-4">Dirección</th>
                    <th className="px-6 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100/50 text-sm">
                  {users.length === 0 && (
                      <tr><td colSpan="5" className="px-6 py-10 text-center text-brand-400 font-medium">No existen colaboradores registrados. Puedes crear uno o probar el botón SEED remoto.</td></tr>
                  )}
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-brand-50/30 transition-colors">
                      <td className="px-6 py-4">
                         <div className="font-black text-brand-900">{u.nombre}</div>
                         <div className="text-[11px] font-bold text-brand-500/80 mt-0.5">{u.email}</div>
                      </td>
                      <td className="px-6 py-4">
                         <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            u.rol === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800'
                         }`}>
                            {u.rol === 'admin' ? 'Super Admin' : 'Operativo Local'}
                         </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-brand-700 text-xs">{u.telefono || '-'}</td>
                      <td className="px-6 py-4 font-bold text-brand-500 text-xs truncate max-w-[150px]">{u.direccion || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-3">
                          <button 
                            onClick={() => openEditModal(u)}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white p-2 rounded-lg transition-colors"
                            title="Editar Perfil"
                          >
                             <Pencil size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(u.id, u.nombre)}
                            disabled={u.rol === 'admin'}
                            title={u.rol === 'admin' ? "No se puede eliminar a un administrador central" : "Revocar Accesos de Sistema"}
                            className={`p-2 rounded-lg transition-colors ${u.rol === 'admin' ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'}`}
                          >
                             <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      )}

      {/* TABLA SOCIOS */}
      {activeTab === 'socios' && (
          <div className="bg-white rounded-xl shadow-sm border border-brand-200 p-8 flex-1 animate-in fade-in duration-300">
             <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center mb-8">
                   <div className="w-16 h-16 bg-brand-50 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-brand-100">
                       <Briefcase size={32}/>
                   </div>
                   <h2 className="text-xl font-black text-brand-900 tracking-tight">Registro Maestro de Sociedad VINDEX</h2>
                   <p className="text-xs font-bold text-brand-500 mt-2 max-w-lg mx-auto leading-relaxed">
                       Este listado es **aislado y sagrado**. Sus porcentajes de participación controlan automáticamente qué nombres aparecen en la liquidación de la Bóveda de Utilidades en la Caja Central.
                   </p>
                   
                   {userData?.rol === 'admin' && (
                       <button 
                            onClick={() => openSocioModal()}
                            className="mt-6 bg-brand-900 hover:bg-brand-800 text-white px-6 py-2.5 rounded-lg font-bold shadow-md transition-all flex items-center gap-2 text-xs uppercase tracking-wider mx-auto"
                       >
                           <Plus size={16} /> Registrar Socio Nuevo
                       </button>
                   )}
                </div>

                {socios.length === 0 ? (
                    <div className="text-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                       <p className="text-sm font-bold text-slate-400">Sociedad No Inicializada. Utiliza el botón superior 'SEED' para cargar los socios fundadores Cristian y Noelia al 50% cada uno, correspondiente a sus acciones nominales.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                       {socios.map((s, idx) => (
                           <div key={s.id} className="flex justify-between items-center p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all">
                               <div className="flex items-center gap-5">
                                  <div className="text-3xl font-black text-brand-200">{(idx + 1).toString().padStart(2, '0')}</div>
                                  <div>
                                      <h3 className="text-lg font-black text-brand-900">{s.nombres}</h3>
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-500 px-2 py-1 bg-brand-100 rounded block w-fit mt-1">{s.documento || 'Socio Accionista'}</span>
                                  </div>
                               </div>
                               <div className="text-right flex flex-col items-end gap-2">
                                  <span className="block text-2xl font-black text-emerald-600">{s.porcentaje}%</span>
                                  {userData?.rol === 'admin' && (
                                     <div className="flex gap-2">
                                        <button onClick={() => openSocioModal(s)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded" title="Editar Participación y Datos"><Pencil size={14}/></button>
                                        <button onClick={() => handleDeleteSocio(s)} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="Eliminar Socio"><Trash2 size={14}/></button>
                                     </div>
                                  )}
                               </div>
                           </div>
                       ))}
                    </div>
                )}
             </div>
          </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
         <div className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] border border-brand-200">
              <div className="bg-brand-50 border-b border-brand-200 px-6 py-4 flex items-center justify-between shrink-0">
                 <h3 className="text-lg font-black text-brand-900 tracking-tight uppercase">
                    {editingUserId ? "Editar Perfil de Usuario" : "Alta de Nuevo Usuario"}
                 </h3>
                 <button onClick={() => setIsModalOpen(false)} className="text-brand-500 hover:text-brand-900 transition-colors bg-white rounded-full p-1 shadow-sm border border-brand-200">
                    <X size={20} />
                 </button>
              </div>

              <form onSubmit={handleSaveUser} className="flex flex-col flex-1 overflow-hidden">
                 <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                   <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="col-span-2">
                         <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Nombre Completo <span className="text-red-500">*</span></label>
                         <input 
                           required
                           value={formData.nombre}
                           onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                           className="w-full border border-brand-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-900 font-medium text-sm text-brand-900" 
                           placeholder="Ej. Noelia..." 
                         />
                      </div>
                      
                      <div>
                         <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Rol de Acceso</label>
                         <select 
                           value={formData.rol}
                           onChange={(e) => setFormData({...formData, rol: e.target.value})}
                           className="w-full border border-brand-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-900 font-medium text-sm text-brand-900 bg-white"
                         >
                           <option value="user">Empleado (Acceso Básico)</option>
                           <option value="admin">Administrador (Control Total)</option>
                           <option value="colaborador">Colaborador (Acceso Restringido)</option>
                         </select>
                      </div>

                      <div>
                         <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Documento (DNI)</label>
                         <input 
                           value={formData.dni}
                           onChange={(e) => setFormData({...formData, dni: e.target.value})}
                           className="w-full border border-brand-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-900 font-medium text-sm text-brand-900" 
                           placeholder="Opcional" 
                         />
                      </div>

                      <div className="col-span-2">
                         <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Teléfono Celular (WhatsApp) <span className="text-red-500">*</span></label>
                         <input 
                           required
                           value={formData.telefono}
                           onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                           className="w-full border border-brand-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-900 font-medium text-sm text-brand-900" 
                           placeholder="+51 ..." 
                         />
                      </div>

                      <div className="col-span-2">
                         <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Dirección Física</label>
                         <input 
                           value={formData.direccion}
                           onChange={(e) => setFormData({...formData, direccion: e.target.value})}
                           className="w-full border border-brand-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-900 font-medium text-sm text-brand-900" 
                           placeholder="Opcional" 
                         />
                      </div>

                      <div className="col-span-2 my-2 border-t border-brand-100"></div>

                      <div className="col-span-2 pb-2">
                         <p className="text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">
                            {editingUserId ? "Gestión de Credenciales de Acceso" : "Credenciales de Acceso"}
                         </p>
                      </div>

                      <div className={editingUserId ? "col-span-2" : "col-span-1"}>
                         <label className="block text-xs font-semibold text-brand-900 mb-1.5">Correo Electrónico Oficial <span className="text-red-500">*</span></label>
                         <input 
                           required
                           type="email"
                           value={formData.email}
                           onChange={(e) => setFormData({...formData, email: e.target.value})}
                           className="w-full border border-brand-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-900 font-medium text-sm text-brand-900" 
                           placeholder="correo@vindex.com" 
                         />
                         {editingUserId && <p className="text-[9px] text-brand-500 mt-1">* Si cambias el correo aquí, asegúrate que coincida con el registro real del usuario.</p>}
                      </div>
                      
                      {!editingUserId ? (
                         <div className="col-span-1">
                            <label className="block text-xs font-semibold text-brand-900 mb-1.5">Contraseña Inicial <span className="text-red-500">*</span></label>
                            <input 
                              required
                              type="password"
                              value={formData.password}
                              onChange={(e) => setFormData({...formData, password: e.target.value})}
                              className="w-full border border-brand-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-900 font-medium text-sm text-brand-900" 
                              placeholder="Mínimo 6 caracteres" 
                            />
                         </div>
                      ) : (
                         <div className="col-span-2 mt-2">
                            <button 
                              type="button"
                              onClick={handleResetPassword}
                              className="w-full bg-brand-50 border border-brand-200 text-brand-900 hover:bg-brand-100 px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                            >
                               <Mail size={16} className="text-brand-500"/>
                               Enviar alerta de Cambio de Contraseña
                            </button>
                            <p className="text-[10px] text-brand-400 mt-2 text-center leading-tight">
                               * Por seguridad, Firebase prefiere que el usuario asigne su propia clave. Al pulsar, <b>{formData.email}</b> recibirá un enlace oficial para escribir una nueva contraseña secreta.
                            </p>
                         </div>
                      )}
                   </div>
                 </div>

                 <div className="p-5 border-t border-brand-200 bg-brand-50 flex justify-end gap-3 shrink-0">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 py-2 border border-brand-300 rounded-lg text-brand-700 hover:bg-brand-200 font-bold transition-colors text-xs uppercase tracking-wider bg-white"
                    >
                       Cancelar
                    </button>
                    <button 
                      disabled={isSaving}
                      type="submit" 
                      className="bg-brand-900 hover:bg-brand-800 disabled:bg-brand-300 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                    >
                       {isSaving ? <Loader2 className="animate-spin" size={16} /> : (editingUserId ? 'Guardar Cambios' : 'Crear Usuario')}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL SOCIOS */}
      {isSocioModalOpen && (
         <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] border border-brand-200">
              <div className="bg-brand-50 border-b border-brand-200 px-6 py-4 flex items-center justify-between shrink-0">
                 <h3 className="text-lg font-black text-brand-900 tracking-tight uppercase flex items-center gap-2">
                    <Briefcase size={20} className="text-brand-500" />
                    {editingSocioId ? "Editar Socio Accionista" : "Alta de Socio Accionista"}
                 </h3>
                 <button onClick={() => setIsSocioModalOpen(false)} className="text-brand-500 hover:text-brand-900 transition-colors bg-white rounded-full p-1 shadow-sm border border-brand-200">
                    <X size={20} />
                 </button>
              </div>

              <form onSubmit={handleSaveSocio} className="flex flex-col flex-1 overflow-hidden">
                 <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col md:flex-row gap-8">
                    {/* COLUMNA IZQ: Datos del Socio */}
                    <div className="flex-1 space-y-4">
                       <h4 className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-4 border-b border-brand-100 pb-2">1. Datos Personales</h4>
                       <div>
                          <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Nombres <span className="text-red-500">*</span></label>
                          <input required value={socioFormData.nombres} onChange={(e) => setSocioFormData({...socioFormData, nombres: e.target.value})} className="w-full border border-brand-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-900 font-medium text-sm text-brand-900 bg-slate-50 focus:bg-white" placeholder="Ej. Juan..." />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Apellidos</label>
                          <input value={socioFormData.apellidos} onChange={(e) => setSocioFormData({...socioFormData, apellidos: e.target.value})} className="w-full border border-brand-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-900 font-medium text-sm text-brand-900 bg-slate-50 focus:bg-white" placeholder="Opcional..." />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">DNI</label>
                             <input value={socioFormData.dni} onChange={(e) => setSocioFormData({...socioFormData, dni: e.target.value})} className="w-full border border-brand-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-900 font-medium text-sm text-brand-900 bg-slate-50 focus:bg-white" placeholder="Opcional..." />
                          </div>
                          <div>
                             <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Celular</label>
                             <input value={socioFormData.celular} onChange={(e) => setSocioFormData({...socioFormData, celular: e.target.value})} className="w-full border border-brand-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-900 font-medium text-sm text-brand-900 bg-slate-50 focus:bg-white" placeholder="Opcional..." />
                          </div>
                       </div>
                    </div>

                    {/* COLUMNA DER: Distribución de acciones */}
                    <div className="flex-1 space-y-4">
                       <h4 className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-4 border-b border-brand-100 pb-2">2. Distribución Accionaria</h4>
                       
                       <div className={`p-4 rounded-xl border-2 transition-colors flex justify-between items-center ${isSocioValid ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                          <div>
                             <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Distribuido</span>
                             <span className={`text-2xl font-black ${isSocioValid ? 'text-emerald-700' : 'text-red-600'}`}>{sumTotalSocios}%</span>
                          </div>
                          {!isSocioValid && <span className="text-xs font-bold text-red-500">Debe sumar exactamente 100%</span>}
                          {isSocioValid && <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Zap size={14}/> Perfecto</span>}
                       </div>

                       <div className="space-y-3 mt-4">
                          <div className="flex justify-between items-center p-3 bg-brand-50 rounded-lg border border-brand-200 shadow-sm relative overflow-hidden">
                             <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500"></div>
                             <div className="pl-3">
                                <span className="block font-bold text-brand-900 text-sm">Este Socio (Nuevo/Edición)</span>
                                <span className="text-[10px] uppercase font-bold text-brand-500">{socioFormData.nombres || 'Sin nombre'}</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <input type="number" min="0" max="100" required value={socioFormData.porcentaje} onChange={(e) => setSocioFormData({...socioFormData, porcentaje: parseFloat(e.target.value)||0})} className="w-20 text-right font-black text-brand-900 border border-brand-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500" />
                                <span className="font-bold text-brand-500">%</span>
                             </div>
                          </div>

                          {tempSociosList.length > 0 && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">Ajustar a otros socios:</p>}
                          
                          {tempSociosList.map(ts => (
                             <div key={ts.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <div>
                                   <span className="block font-bold text-slate-700 text-sm">{ts.nombres}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                   <input type="number" min="0" max="100" required value={ts.porcentaje} onChange={(e) => handleTempSocioChange(ts.id, e.target.value)} className="w-20 text-right font-black text-slate-700 border border-slate-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500" />
                                   <span className="font-bold text-slate-400">%</span>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="p-5 border-t border-brand-200 bg-brand-50 flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={() => setIsSocioModalOpen(false)} className="px-5 py-2 border border-brand-300 rounded-lg text-brand-700 hover:bg-brand-200 font-bold transition-colors text-xs uppercase tracking-wider bg-white">
                       Cancelar
                    </button>
                    <button disabled={isSaving || !isSocioValid} type="submit" className="bg-brand-900 hover:bg-brand-800 disabled:bg-brand-300 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider">
                       {isSaving ? <Loader2 className="animate-spin" size={16} /> : (editingSocioId ? 'Guardar Cambios' : 'Registrar Socio')}
                    </button>
                 </div>
              </form>
           </div>
         </div>
      )}

    </div>
  );
}
