import React, { useState, useEffect } from 'react';
import { 
  Building2, UserCircle, Search, Plus, MapPin, 
  Briefcase, Mail, Loader2, Edit2, Trash2, 
  BookOpen, Pencil, X, Database, ShieldCheck, Landmark
} from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useForm } from 'react-hook-form';

function CatalogModal({ isOpen, onClose, type, onSave, initialData }) {
  const { register, handleSubmit, reset } = useForm();
  
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset(initialData);
      } else {
        if (type === 'abogados') reset({ name: '', colegiatura: '', phone: '', email: '' });
        else if (type === 'entidades') reset({ name: '', type: '', location: '' });
        else reset({ name: '', description: '' });
      }
    }
  }, [isOpen, initialData, reset, type]);

  if (!isOpen) return null;

  const titles = {
    abogados: initialData ? 'Editar Abogado' : 'Nuevo Abogado',
    entidades: initialData ? 'Editar Contraparte' : 'Nueva Contraparte',
    materias: initialData ? 'Editar Materia' : 'Nueva Materia'
  };

  return (
    <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col border border-brand-200">
        <div className="p-5 border-b border-brand-200 flex justify-between items-center bg-brand-50">
          <h2 className="text-lg font-black text-brand-900 flex items-center gap-2">
            {initialData ? <Pencil size={18}/> : <Plus size={18}/>} 
            {titles[type]}
          </h2>
          <button type="button" onClick={onClose} className="text-brand-400 hover:text-brand-900 p-1.5 bg-brand-100 hover:bg-brand-200 rounded-full transition-colors"><X size={18}/></button>
        </div>
        
        <div className="p-6">
          <form id="catalogForm" onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div>
               <label className="block text-xs font-bold text-brand-700 mb-1">Nombre {type === 'abogados' ? 'Completo' : type === 'entidades' ? 'de la Contraparte' : 'de la Materia'} <span className="text-red-500">*</span></label>
               <input {...register('name')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 transition-shadow" required/>
            </div>
            
            {type === 'abogados' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1 flex items-center gap-1">Número de Colegiatura <span className="text-[10px] text-brand-400 font-normal">(CAL, etc.)</span></label>
                  <input {...register('colegiatura')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900" placeholder="Opcional. Ej. 12345"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1">Número de Celular</label>
                  <input {...register('phone')} type="tel" className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900" placeholder="Opcional. Ej. 999 999 999"/>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-brand-700 mb-1">Correo Electrónico</label>
                  <input {...register('email')} type="email" className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900" placeholder="Opcional"/>
                </div>
              </div>
            )}

            {type === 'entidades' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1">Casilla (Física o Electrónica)</label>
                  <input {...register('location')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900" placeholder="Opcional. Ej. 135"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1">Tipo</label>
                  <select {...register('type')} className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900">
                    <option value="">Seleccionar (Opcional)...</option>
                    <option>Público</option>
                    <option>Privado</option>
                  </select>
                </div>
              </div>
            )}

            <div className="hidden"></div>
          </form>
        </div>
        
        <div className="p-5 border-t border-brand-200 bg-brand-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2 border border-brand-300 rounded-lg text-brand-700 hover:bg-brand-200 font-bold transition-colors text-xs uppercase tracking-wider bg-white">Cancelar</button>
          <button type="submit" form="catalogForm" className="px-6 py-2 bg-brand-900 hover:bg-brand-800 text-white rounded-lg font-bold transition-all shadow-md shadow-brand-900/20 text-xs uppercase tracking-wider">{initialData ? 'Guardar Cambios' : 'Generar'}</button>
        </div>
      </div>
    </div>
  );
}

export default function CatalogsView() {
  const [activeTab, setActiveTab] = useState('abogados');
  const [abogados, setAbogados] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    const unsubAbogados = onSnapshot(collection(db, 'abogados'), snap => {
      setAbogados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    const unsubEntidades = onSnapshot(collection(db, 'entidades'), snap => {
      setEntidades(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubMaterias = onSnapshot(collection(db, 'materias'), snap => {
      setMaterias(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubAbogados();
      unsubEntidades();
      unsubMaterias();
    };
  }, []);

  const TABS = [
    { id: 'abogados', icon: ShieldCheck, label: 'Abogados y Personal', desc: 'Gestión de firmas e intervinientes' },
    { id: 'entidades', icon: Landmark, label: 'Directorio de Contrapartes', desc: 'Gestión de Contrapartes' },
    { id: 'materias', icon: BookOpen, label: 'Materias Judiciales', desc: 'Tipos de procesos judiciales' }
  ];

  const currentData = activeTab === 'abogados' ? abogados : activeTab === 'entidades' ? entidades : materias;
  const filteredData = currentData.filter(i => i.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleSave = async (data) => {
    setIsModalOpen(false);
    try {
      if (editingItem) {
        await updateDoc(doc(db, activeTab, editingItem.id), data);
      } else {
        await addDoc(collection(db, activeTab), data);
      }
    } catch(err) {
      console.error(err);
    }
    setEditingItem(null);
  };

  const handleDelete = async (id) => {
    if(!window.confirm('¿Seguro que deseas eliminar este registro?')) return;
    try {
      await deleteDoc(doc(db, activeTab, id));
    } catch (e) {
      console.error(e);
      alert('Error eliminando.');
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-brand-200 overflow-hidden">
      <div className="p-6 border-b border-brand-200 bg-brand-50 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-brand-900 tracking-tight flex items-center gap-2">
               <Database size={24} className="text-brand-700" />
               Mantenimiento de Catálogos
               {isLoading && <Loader2 size={18} className="animate-spin text-brand-500" />}
            </h1>
            <p className="text-brand-600 text-xs mt-0.5 font-bold uppercase tracking-wider">Gestión central de Listas Blancas</p>
          </div>
          <div className="flex gap-3">
             <div className="relative">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
               <input 
                 type="text" 
                 placeholder={`Buscar...`}
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-9 pr-4 py-2.5 bg-white border border-brand-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 w-full md:w-64 transition-all"
               />
             </div>
             <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-brand-900 hover:bg-brand-800 text-white px-5 py-2.5 rounded-lg font-bold shadow-md shadow-brand-900/20 transition-all text-xs tracking-wide uppercase whitespace-nowrap">
               <Plus size={16} strokeWidth={3} />
               Nuevo
             </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 mt-6 border-b border-brand-200">
           {TABS.map(t => (
             <button 
               key={t.id}
               onClick={() => { setActiveTab(t.id); setSearchTerm(''); }}
               className={`pb-3 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === t.id ? 'border-brand-900 text-brand-900' : 'border-transparent text-brand-500 hover:text-brand-800'}`}
             >
                <t.icon size={18} />
                {t.label}
             </button>
           ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
           {filteredData.map(item => (
             <div key={item.id} className="bg-white border border-brand-200 rounded-xl p-5 hover:border-brand-400 hover:shadow-md transition-all group relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-brand-900/10 group-hover:bg-brand-900 transition-colors" />
               <div className="flex justify-between items-start mb-3 pl-3">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-black text-brand-800 border border-brand-200 uppercase">
                     {item.name?.charAt(0) || '?'}
                   </div>
                   <div>
                     <h3 className="font-bold text-brand-900">{item.name}</h3>
                     <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider">
                       {activeTab === 'abogados' 
                          ? (item.colegiatura ? `CAL ${item.colegiatura}` : 'ABOGADO') 
                          : item.role || item.type || item.description || '-'
                       }
                     </p>
                   </div>
                 </div>
               </div>
               
               <div className="mt-4 pt-4 border-t border-brand-100 pl-3">
                 <div className="text-sm text-slate-600 font-medium flex flex-col gap-0.5">
                   {activeTab === 'abogados' ? (
                     <>
                        <span>{item.phone || 'Sin número de celular'}</span>
                        <span className="text-[11px] text-brand-400 font-normal">{item.email || 'Sin correo electrónico'}</span>
                     </>
                   ) : activeTab === 'entidades' ? <span>{item.location ? `Casilla: ${item.location}` : 'Sin casilla electrónica/física'}</span> : <span></span>}
                 </div>
               </div>

               <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                 <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"><Pencil size={16} /></button>
                 <button onClick={() => handleDelete(item.id)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 size={16} /></button>
               </div>
             </div>
           ))}
        </div>
        
        {!isLoading && filteredData.length === 0 && (
           <div className="text-center py-16">
             <Database size={48} className="mx-auto text-brand-200 mb-4" />
             <p className="text-brand-500 font-bold">No se encontraron registros en el catálogo.</p>
           </div>
        )}
      </div>

      <CatalogModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} type={activeTab} onSave={handleSave} initialData={editingItem} />
    </div>
  );
}
