import React, { useState, useEffect } from 'react';
import { X, Plus, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const STAGES = [
  { id: '1', title: 'Preparación' },
  { id: '2', title: 'Ingreso Demanda' },
  { id: '3', title: 'Calificación' },
  { id: '4', title: 'Subsanación' },
  { id: '5', title: 'En Trámite' },
  { id: '6', title: 'Sentencia 1°' },
  { id: '7', title: 'Apelación' },
  { id: '8', title: 'Sentencia 2°' },
  { id: '9', title: 'Casación' },
  { id: '10', title: 'Ejecución' },
  { id: '11', title: 'Concluido' },
  { id: '12', title: 'Archivado' }
];

export function PrincipalModal({ isOpen, onClose, onSave, onDelete, initialData }) {
  const { register, handleSubmit, reset, setValue } = useForm();
  const [entidades, setEntidades] = useState([]);
  const [abogados, setAbogados] = useState([]);
  const [materias, setMaterias] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    
    const unsubEntities = onSnapshot(collection(db, 'entidades'), snap => {
      setEntidades(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubLawyers = onSnapshot(collection(db, 'abogados'), snap => {
      setAbogados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubMaterias = onSnapshot(collection(db, 'materias'), snap => {
      setMaterias(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubEntities();
      unsubLawyers();
      unsubMaterias();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset(initialData);
      } else {
        reset({ title: '', clientName: '', clientRuc: '', phone: '', email: '', address: '', matter: '', entity: '', juzgado: '', corte: '', lawyer: '', stageId: '' });
      }
    }
  }, [isOpen, initialData, reset]);

  if (!isOpen) return null;

  const handleQuickAddContraparte = async () => {
    const name = window.prompt("Ingrese el nombre de la nueva contraparte:");
    if (!name?.trim()) return;
    try {
      await addDoc(collection(db, 'entidades'), { name: name.trim(), type: '', location: '' });
      setValue('entity', name.trim());
    } catch (e) { console.error(e); }
  };

  const handleQuickAddLawyer = async () => {
    const name = window.prompt("Ingrese el nombre completo del abogado:");
    if (!name?.trim()) return;
    try {
      await addDoc(collection(db, 'abogados'), { name: name.trim(), role: '', email: '' });
      setValue('lawyer', name.trim());
    } catch (e) { console.error(e); }
  };

  const handleQuickAddMateria = async () => {
    const name = window.prompt("Ingrese el nombre de la nueva materia:");
    if (!name?.trim()) return;
    try {
      await addDoc(collection(db, 'materias'), { name: name.trim(), description: '' });
      setValue('matter', name.trim());
    } catch (e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-brand-200">
        <div className="p-6 border-b border-brand-200 flex justify-between items-center bg-brand-50 shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-brand-900 text-white p-2 rounded-lg shadow-sm"><Plus size={20} strokeWidth={3}/></div>
             <h2 className="text-xl font-black text-brand-900">{initialData ? 'Editar Expediente Principal' : 'Crear Expediente Principal'}</h2>
          </div>
          <button onClick={onClose} type="button" className="text-brand-400 hover:text-brand-900 p-1.5 bg-brand-100 hover:bg-brand-200 rounded-full transition-colors bg-white shadow-sm border border-brand-200"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="principalForm" onSubmit={handleSubmit((data) => onSave({ ...data, type: 'principal' }))} className="space-y-8">
            {/* Sección Cliente */}
            <div>
              <h3 className="text-[11px] font-bold text-brand-600 uppercase tracking-widest mb-4 border-b border-brand-100 pb-2">1. Información del Cliente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-brand-700 mb-1">Nombres / Razón Social <span className="text-red-500">*</span></label>
                  <input {...register('clientName')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow" placeholder="Ej. Empresa SAC o Juan Pérez" required/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1">DNI / RUC</label>
                  <input {...register('clientRuc')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow" placeholder="Opcional" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1">Celular</label>
                  <input {...register('phone')} type="tel" className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow" placeholder="Opcional" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1">Correo Electrónico</label>
                  <input {...register('email')} type="email" className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow" placeholder="Opcional" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-brand-700 mb-1">Dirección Local/Legal</label>
                  <input {...register('address')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow" placeholder="Opcional" />
                </div>
              </div>
            </div>

            {/* Sección Proceso */}
            <div>
              <h3 className="text-[11px] font-bold text-brand-600 uppercase tracking-widest mb-4 border-b border-brand-100 pb-2">2. Datos Judiciales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-brand-700 mb-1">N° de Expediente Judicial Único <span className="text-red-500">*</span></label>
                  <input {...register('title')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2.5 font-mono text-brand-900 bg-brand-50 focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow" placeholder="00000-2026-0-0000-JR-CI-00" required/>
                </div>
                <div>
                   <label className="block text-xs font-bold text-brand-700 mb-1">Etapa Actual <span className="text-red-500">*</span></label>
                   <select {...register('stageId')} required className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow bg-white font-medium text-brand-900">
                     <option value="">Seleccionar Etapa...</option>
                     {STAGES.map(s => <option key={s.id} value={s.id}>{s.id}. {s.title}</option>)}
                   </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1 flex justify-between">
                    <span>Materia <span className="text-red-500">*</span></span>
                    <button type="button" onClick={handleQuickAddMateria} className="text-brand-600 hover:text-brand-900 flex items-center gap-1 font-bold text-[10px] uppercase"><Plus size={12} strokeWidth={3}/> Rápido</button>
                  </label>
                  <select {...register('matter')} required className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow bg-white">
                    <option value="">Seleccionar Materia...</option>
                    {materias.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1 flex justify-between">
                    <span>Contraparte <span className="text-red-500">*</span></span>
                    <button type="button" onClick={handleQuickAddContraparte} className="text-brand-600 hover:text-brand-900 flex items-center gap-1 font-bold text-[10px] uppercase"><Plus size={12} strokeWidth={3}/> Rápido</button>
                  </label>
                  <select {...register('entity')} required className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow bg-white">
                    <option value="">Seleccionar Contraparte...</option>
                    {entidades.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1">Juzgado</label>
                  <input {...register('juzgado')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow" placeholder="Opcional. Ej. 2° Juzgado"/>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-brand-700 mb-1">Corte</label>
                  <input {...register('corte')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow" placeholder="Opcional. Ej. Corte de Lima"/>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-brand-700 mb-1 flex justify-between">
                     <span>Abogado Asignado (Lista Blanca) <span className="text-red-500">*</span></span>
                     <button type="button" onClick={handleQuickAddLawyer} className="text-brand-600 hover:text-brand-900 flex items-center gap-1 font-bold text-[10px] uppercase"><Plus size={12} strokeWidth={3}/> Rápido</button>
                  </label>
                  <select {...register('lawyer')} required className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow bg-white text-brand-900 font-medium">
                    <option value="">Seleccionar Abogado de Firma...</option>
                    {abogados.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-5 border-t border-brand-200 bg-brand-50 flex justify-between items-center shrink-0">
          <div>
            {initialData && (
              <button type="button" onClick={() => onDelete(initialData.id)} className="flex items-center gap-1.5 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg font-bold transition-colors text-xs uppercase tracking-wider">
                <Trash2 size={16} /> Eliminar
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white border border-brand-300 rounded-lg text-brand-700 hover:bg-brand-200 font-bold transition-colors text-xs uppercase tracking-wider bg-white">Cancelar</button>
            <button type="submit" form="principalForm" className="px-6 py-2.5 bg-brand-900 hover:bg-brand-800 text-white rounded-lg font-bold transition-all shadow-md shadow-brand-900/20 text-xs uppercase tracking-wider">{initialData ? 'Guardar Cambios' : 'Crear Principal'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CautelarModal({ isOpen, onClose, onSave, onDelete, initialData, principals = [] }) {
  const { register, handleSubmit, reset, watch, setValue } = useForm();
  const [abogados, setAbogados] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const selectedParentId = watch('parentId');
  const selectedParent = principals.find(p => p.id === selectedParentId) || null;

  useEffect(() => {
    if (!isOpen) return;
    const unsubLawyers = onSnapshot(collection(db, 'abogados'), snap => {
      setAbogados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubLawyers();
  }, [isOpen]);

  useEffect(() => {
    // Update search term when parent changes programmatically (e.g. edition mode load)
    if (selectedParent) {
       setSearchTerm(`${selectedParent.title} - ${selectedParent.clientName}`);
    } else {
       setSearchTerm('');
    }
  }, [selectedParentId, selectedParent]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset(initialData);
      } else {
        reset({ title: '', parentId: '', lawyer: '', stageId: '' });
        setSearchTerm('');
      }
    }
  }, [isOpen, initialData, reset]);

  if (!isOpen) return null;

  const handleQuickAddLawyer = async () => {
    const name = window.prompt("Ingrese el nombre completo del abogado:");
    if (!name?.trim()) return;
    try {
      await addDoc(collection(db, 'abogados'), { name: name.trim(), role: '', email: '' });
      setValue('lawyer', name.trim());
    } catch (e) { console.error(e); }
  };

  const filteredPrincipals = principals.filter(p => 
      `${p.title} ${p.clientName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectParent = (p) => {
      setValue('parentId', p.id);
      setSearchTerm(`${p.title} - ${p.clientName}`);
      setIsDropdownOpen(false);
  };

  const onFinalSave = (data) => {
    onSave({ 
      ...data, 
      type: 'cautelar', 
      clientName: selectedParent.clientName, 
      clientRuc: selectedParent.clientRuc, 
      address: selectedParent.address,
      matter: selectedParent.matter || '',
      entity: selectedParent.entity || '',
      juzgado: selectedParent.juzgado || '',
      corte: selectedParent.corte || ''
    });
  };

  return (
    <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-brand-300">
        <div className="p-6 border-b border-brand-200 flex justify-between items-center bg-brand-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white border border-brand-300 text-brand-900 p-2 rounded-lg shadow-sm"><Plus size={20} strokeWidth={3}/></div>
            <div>
               <h2 className="text-xl font-black text-brand-900">{initialData ? 'Editar Cuaderno Cautelar' : 'Crear Cuaderno Cautelar'}</h2>
               <p className="text-xs text-brand-600 mt-0.5 font-bold uppercase tracking-wider">Copia Vinculante de Principal</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-brand-400 hover:bg-brand-100 hover:text-brand-900 p-1.5 rounded-full transition-colors"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="cautelarForm" onSubmit={handleSubmit(onFinalSave)} className="space-y-6">
            
            {/* Buscador de Padre con Autocomplete */}
            <div className="bg-white border-2 border-brand-300 p-5 rounded-xl shadow-sm relative">
              <label className="block text-sm font-black text-brand-900 mb-2 flex items-center gap-2">
                 <Search size={16} className="text-brand-600"/> 1. Buscar y Seleccionar Principal <span className="text-red-500">*</span>
              </label>
              
              <div className="relative">
                <input 
                  type="text"
                  value={searchTerm}
                  disabled={!!initialData}
                  placeholder="Ej. 00000-2026 o Nombre del Cliente..."
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (selectedParentId) setValue('parentId', ''); 
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                  className="w-full border-2 border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-900 focus:border-brand-900 font-bold text-brand-800 transition-all bg-brand-50 disabled:opacity-50"
                  required={!selectedParentId}
                />
                
                {isDropdownOpen && !initialData && (
                  <div className="absolute top-12 left-0 w-full bg-white border border-brand-300 shadow-xl rounded-lg max-h-48 overflow-y-auto z-[100]">
                    {filteredPrincipals.length > 0 ? (
                      filteredPrincipals.map(p => (
                        <div 
                          key={p.id}
                          className="px-4 py-3 hover:bg-brand-50 cursor-pointer border-b border-brand-100 last:border-0"
                          onClick={() => handleSelectParent(p)}
                          onMouseDown={(e) => { e.preventDefault(); handleSelectParent(p); }}
                        >
                          <div className="font-bold text-brand-900 text-sm">{p.title}</div>
                          <div className="text-xs text-brand-600 font-medium">{p.clientName}</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-brand-500 text-center font-bold">No se encontraron expedientes.</div>
                    )}
                  </div>
                )}
                {/* Hidden input to store true ID for react-hook-form */}
                <input type="hidden" {...register('parentId')} required />
              </div>

              {/* Resumen del Principal Seleccionado (Solo Lectura) */}
              {selectedParent && (
                <div className="bg-brand-50 border border-brand-200 p-5 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 mt-4">
                  <div className="flex items-center justify-between border-b border-brand-200 pb-3">
                    <h3 className="text-[11px] font-bold text-brand-700 uppercase tracking-widest flex items-center gap-2">
                       <ShieldAlert size={16} className="text-brand-500"/> Datos Heredados del Principal 
                    </h3>
                    <span className="text-[9px] bg-brand-200 border border-brand-300 text-brand-800 px-2 py-1 rounded font-black uppercase tracking-widest">Solo Lectura</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-wider mb-0.5">Cliente</label>
                      <p className="text-sm font-bold text-brand-900">{selectedParent.clientName}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-wider mb-0.5">N° Expediente Principal</label>
                      <p className="text-sm font-bold text-brand-900">{selectedParent.title}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-wider mb-0.5">Materia</label>
                      <p className="text-sm font-bold text-brand-900">{selectedParent.matter || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-wider mb-0.5">Contraparte</label>
                      <p className="text-sm font-bold text-brand-900">{selectedParent.entity || '-'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-wider mb-0.5">Tribunal / Sede</label>
                      <p className="text-sm font-bold text-brand-900">
                        {selectedParent.juzgado || selectedParent.corte 
                          ? `${selectedParent.juzgado || ''} ${selectedParent.corte ? `- ${selectedParent.corte}` : ''}`
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Datos Únicos de Cautelar */}
            <div className={`transition-opacity duration-300 ${!selectedParent ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              <h3 className="text-[11px] font-bold text-brand-600 uppercase tracking-widest mb-4 border-b border-brand-200 pb-2">2. Datos de este Cuaderno Cautelar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-brand-700 mb-1">N° de Expediente Cautelar Independiente <span className="text-red-500">*</span></label>
                  <input {...register('title')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2.5 font-mono text-brand-900 bg-brand-50 focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow" placeholder="Ej. 00000-2026-10-0000-JR-CI-00" required disabled={!selectedParent}/>
                </div>
                
                <div>
                   <label className="block text-xs font-bold text-brand-700 mb-1">Etapa Actual <span className="text-red-500">*</span></label>
                   <select {...register('stageId')} required className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow bg-white font-medium text-brand-900" disabled={!selectedParent}>
                     <option value="">Seleccionar Etapa...</option>
                     {STAGES.map(s => <option key={s.id} value={s.id}>{s.id}. {s.title}</option>)}
                   </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1 flex justify-between">
                     <span>Abogado Asignado <span className="text-red-500">*</span></span>
                     <button type="button" onClick={handleQuickAddLawyer} disabled={!selectedParent} className="text-brand-600 hover:text-brand-900 flex items-center gap-1 font-bold text-[10px] uppercase cursor-pointer disabled:opacity-50"><Plus size={12} strokeWidth={3}/> Rápido</button>
                  </label>
                  <select {...register('lawyer')} required className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-shadow bg-white" disabled={!selectedParent}>
                    <option value="">Seleccionar Abogado...</option>
                    {abogados.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
          </form>
        </div>
        
        <div className="p-5 border-t border-brand-200 bg-brand-50 flex justify-between items-center shrink-0">
          <div>
            {initialData && (
              <button type="button" onClick={() => onDelete(initialData.id)} className="flex items-center gap-1.5 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg font-bold transition-colors text-xs uppercase tracking-wider">
                <Trash2 size={16} /> Eliminar
              </button>
            )}
          </div>
          <div className="flex gap-3">
             <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white border border-brand-300 rounded-lg text-brand-800 hover:bg-brand-100 font-bold transition-colors text-xs uppercase tracking-wider">Cancelar</button>
             <button type="submit" form="cautelarForm" disabled={!selectedParent} className="px-6 py-2.5 bg-white text-brand-900 border border-brand-900 hover:bg-brand-900 hover:text-white disabled:bg-brand-100 disabled:text-brand-400 disabled:border-brand-200 disabled:cursor-not-allowed rounded-lg font-black transition-all shadow-sm text-xs uppercase tracking-wider">{initialData ? 'Guardar Cambios' : 'Generar Cautelar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
