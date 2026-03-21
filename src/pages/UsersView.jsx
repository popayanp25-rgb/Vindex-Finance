import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { secondaryAuth } from '../utils/firebaseSecondary';
import { Plus, X, Loader2, User, Pencil, Trash2, Mail } from 'lucide-react';

export default function UsersView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null); 
  
  const initialForm = { nombre: '', email: '', password: '', rol: 'user', dni: '', telefono: '', direccion: '' };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(data);
      setLoading(false);
    });
    return unsub;
  }, []);

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
    try {
      if(!window.confirm(`Se le enviará un correo oficial a ${formData.email} con un enlace seguro para que el usuario escriba su nueva contraseña. ¿Proceder?`)) return;
      await sendPasswordResetEmail(auth, formData.email);
      alert(`Éxito. Se ha enviado un correo a ${formData.email} con las instrucciones para restablecer la contraseña.`);
    } catch (error) {
      console.error("Error sending password reset email", error);
      alert("Error al intentar enviar el correo. Verifique que la dirección sea válida.");
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
    <div className="h-full flex flex-col gap-6 max-w-6xl mx-auto w-full">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-brand-200">
        <div>
          <h1 className="text-2xl font-black text-brand-900 tracking-tight flex items-center gap-3">
             <User className="text-brand-500" />
             Administración de Personal
          </h1>
          <p className="text-sm font-medium text-brand-500 mt-1">Gestione los accesos y datos del equipo VINDEX.</p>
        </div>
        
        <button 
          onClick={openAddModal}
          className="bg-brand-900 hover:bg-brand-800 text-white px-6 py-3 rounded-lg font-bold shadow-md transition-all flex items-center gap-2 text-sm uppercase tracking-wider"
        >
          <Plus size={18} />
          Registrar Usuario
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-200 overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-50 text-brand-900 text-xs uppercase tracking-widest font-bold">
                <th className="px-6 py-4">Empleado</th>
                <th className="px-6 py-4">Rol en Sistema</th>
                <th className="px-6 py-4">Teléfono (Cel/Wsp)</th>
                <th className="px-6 py-4">Dirección</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100 text-sm">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-brand-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-brand-900 flex flex-col">
                     {u.nombre}
                     <span className="text-xs font-medium text-brand-500">{u.email}</span>
                  </td>
                  <td className="px-6 py-4">
                     <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        u.rol === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800'
                     }`}>
                        {u.rol === 'admin' ? 'Administrador' : 'Empleado'}
                     </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-brand-700">{u.telefono || '-'}</td>
                  <td className="px-6 py-4 font-medium text-brand-500 text-xs truncate max-w-[150px]">{u.direccion || '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => openEditModal(u)}
                        className="p-2 rounded transition-colors text-blue-500 hover:bg-blue-50"
                        title="Editar Perfil"
                      >
                         <Pencil size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id, u.nombre)}
                        disabled={u.rol === 'admin'}
                        title={u.rol === 'admin' ? "No se puede eliminar a un administrador" : "Eliminar Empleado"}
                        className={`p-2 rounded transition-colors ${u.rol === 'admin' ? 'text-gray-300' : 'text-red-500 hover:bg-red-50'}`}
                      >
                         <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                           <option value="user">Usuario (Empleado)</option>
                           <option value="admin">Administrador (Control Total)</option>
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
                         <label className="block text-xs font-semibold text-brand-900 mb-1.5">Correo Electrónico <span className="text-red-500">*</span></label>
                         <input 
                           required
                           disabled={!!editingUserId}
                           type="email"
                           value={formData.email}
                           onChange={(e) => setFormData({...formData, email: e.target.value})}
                           className={`w-full border border-brand-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-900 font-medium text-sm text-brand-900 ${editingUserId ? 'bg-gray-100 cursor-not-allowed text-brand-500' : ''}`} 
                           placeholder="correo@vindex.com" 
                         />
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

    </div>
  );
}
