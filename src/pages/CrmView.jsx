/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { Search, Plus, Phone, Mail, MapPin, Building, Briefcase, Edit2, Trash2, X, Users, AlertCircle, ExternalLink, Database, FileText } from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import ContraparteModal from '../components/ContraparteModal';
import ServicioModal from '../components/ServicioModal';

function ClientModal({ isOpen, onClose, onSave, initialData, onOpenContraparte }) {
  const [formData, setFormData] = useState({
    nombre: '', tipo: 'Natural', documento: '', telefono: '', correo: '', contraparte: ''
  });
  const [contrapartesList, setContrapartesList] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'contrapartes'), (snapshot) => {
      setContrapartesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({ ...initialData, contraparte: initialData.contraparte || initialData.direccion || '' });
      } else {
        setFormData({ nombre: '', tipo: 'Natural', documento: '', telefono: '', correo: '', contraparte: '' });
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

  return (
    <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-brand-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-brand-200 dark:border-slate-700 flex justify-between items-center bg-brand-50 dark:bg-slate-800/50 shrink-0">
           <div className="flex items-center gap-3">
             <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 p-2 rounded-lg shadow-sm"><Users size={20} strokeWidth={2.5}/></div>
             <h2 className="text-xl font-black text-brand-900 dark:text-white">{initialData ? 'Editar Cliente' : 'Nuevo Contratante'}</h2>
           </div>
           <button onClick={onClose} className="text-brand-400 dark:text-slate-300 hover:text-brand-900 dark:hover:text-white p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors border border-transparent hover:border-brand-200 dark:hover:border-slate-700"><X size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          <form id="crmForm" onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">Tipo de Cliente</label>
              <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className="w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white" required>
                <option value="Natural">Persona Natural</option>
                <option value="Jurídica">Persona Jurídica (Empresa)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">Nombres / Razón Social <span className="text-red-500">*</span></label>
              <input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white" required placeholder="Ej. Empresa SAC o Juan Pérez"/>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">DNI / RUC <span className="text-red-500">*</span></label>
                <input type="text" value={formData.documento} onChange={e => setFormData({...formData, documento: e.target.value})} className="w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white" required placeholder="Obligatorio"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">Celular / Teléfono <span className="text-red-500">*</span></label>
                <input type="tel" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} className="w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white" required placeholder="Obligatorio"/>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">Correo Electrónico</label>
              <input type="email" value={formData.correo} onChange={e => setFormData({...formData, correo: e.target.value})} className="w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white" placeholder="cliente@correo.com"/>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">Contraparte <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select value={formData.contraparte} onChange={e => setFormData({...formData, contraparte: e.target.value})} className="flex-1 w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white" required>
                  <option value="">Selecciona una contraparte...</option>
                  {contrapartesList.map(c => (
                     <option key={c.id} value={c.nombre}>{c.nombre} {c.ruc ? `(${c.ruc})` : ''}</option>
                  ))}
                </select>
                <button type="button" onClick={onOpenContraparte} className="flex items-center gap-1 bg-brand-100 hover:bg-brand-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-brand-800 dark:text-brand-300 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors shadow-sm" title="Nueva Contraparte">
                  <Plus size={14}/> Nueva
                </button>
              </div>
            </div>

          </form>
        </div>

        <div className="p-5 border-t border-brand-200 dark:border-slate-700 bg-brand-50 dark:bg-slate-800/50 flex justify-end gap-3 rounded-b-2xl shrink-0">
           <button type="button" onClick={onClose} className="px-5 py-2.5 border border-brand-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-700 font-bold transition-colors text-xs uppercase tracking-wider">Cancelar</button>
           <button type="submit" form="crmForm" className="px-6 py-2.5 bg-brand-900 hover:bg-brand-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg font-bold transition-all shadow-md text-xs uppercase tracking-wider">
             {initialData ? 'Guardar Cambios' : 'Registrar Cliente'}
           </button>
        </div>
      </div>
    </div>
  );
}

function CasesModal({ isOpen, onClose, clientName }) {
  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !clientName) return;
    setIsLoading(true);
    const fetchCases = async () => {
       try {
         const q = query(collection(db, 'casos'), where('clientName', '==', clientName));
         const snap = await getDocs(q);
         setCases(snap.docs.map(d => ({id: d.id, ...d.data()})));
       } catch (err) { console.error(err); }
       setIsLoading(false);
    };
    fetchCases();
  }, [isOpen, clientName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-brand-200 dark:border-slate-700 flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-brand-200 dark:border-slate-700 flex justify-between items-center bg-brand-50 dark:bg-slate-800/50 shrink-0">
           <div className="flex items-center gap-3">
             <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 p-2 rounded-lg shadow-sm"><Briefcase size={20} strokeWidth={2.5}/></div>
             <div>
               <h2 className="text-xl font-black text-brand-900 dark:text-white">Cuadernos de Cobranza Asociados</h2>
               <p className="text-xs text-brand-500 dark:text-slate-200 font-bold uppercase tracking-wider">{clientName}</p>
             </div>
           </div>
           <button onClick={onClose} className="text-brand-400 dark:text-slate-300 hover:text-brand-900 dark:hover:text-white p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors border border-transparent hover:border-brand-200 dark:hover:border-slate-700"><X size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 flex-1 custom-scrollbar">
          {isLoading ? (
             <div className="flex justify-center py-10"><AlertCircle size={32} className="text-brand-300 dark:text-slate-600 animate-pulse"/></div>
          ) : cases.length > 0 ? (
             <div className="space-y-3">
               {cases.map(c => (
                  <div key={c.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-brand-200 dark:border-slate-700 flex justify-between items-center group">
                     <div>
                       <h4 className="font-mono text-sm font-bold text-brand-900 dark:text-white">{c.title}</h4>
                       <div className="flex items-center gap-3 mt-1.5 text-xs text-brand-600 dark:text-slate-200 font-medium font-sans">
                         <span className="bg-brand-50 dark:bg-slate-700 px-2 py-0.5 rounded border border-brand-100 dark:border-slate-600 text-brand-700 dark:text-slate-300">{c.type === 'principal' ? 'Principal' : 'Cautelar'}</span>
                         <span>Materia: {c.matter || 'N/A'}</span>
                         <span>Fase actual: {c.stageId}</span>
                       </div>
                     </div>
                     <Link to="/expedientes" className="w-10 h-10 bg-brand-50 dark:bg-slate-700 text-brand-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-brand-900 dark:hover:bg-blue-600 hover:text-white shadow-sm border border-brand-200 dark:border-slate-600">
                        <ExternalLink size={16} />
                     </Link>
                  </div>
               ))}
             </div>
          ) : (
             <div className="text-center py-12">
               <Briefcase size={48} className="mx-auto text-brand-200 dark:text-slate-700 mb-4" />
               <p className="text-brand-900 dark:text-white font-bold text-lg mb-1">Sin Cuadernos de Cobranza</p>
               <p className="text-brand-500 dark:text-slate-200 text-sm">Este cliente aún no tiene casos registrados con coincidencia exacta de nombre.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}



export default function CrmView() {
  const [activeTab, setActiveTab] = useState('clientes');

  const [clientes, setClientes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const [casesModalClient, setCasesModalClient] = useState(null);

  // Contrapartes State
  const [contrapartes, setContrapartes] = useState([]);
  const [isContraparteModalOpen, setIsContraparteModalOpen] = useState(false);
  const [editingContraparte, setEditingContraparte] = useState(null);
  const [searchContraparteTerm, setSearchContraparteTerm] = useState('');

  // Servicios State
  const [servicios, setServicios] = useState([]);
  const [isServicioModalOpen, setIsServicioModalOpen] = useState(false);
  const [editingServicio, setEditingServicio] = useState(null);
  const [searchServicioTerm, setSearchServicioTerm] = useState('');

  // Sincronización general
  useEffect(() => {
    const unsubClientes = onSnapshot(collection(db, 'clientes'), (snapshot) => {
      setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });
    const unsubContra = onSnapshot(collection(db, 'contrapartes'), (snapshot) => {
      setContrapartes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubServi = onSnapshot(collection(db, 'servicios'), (snapshot) => {
      setServicios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubClientes(); unsubContra(); unsubServi(); };
  }, []);

  // AUTO-IMPORTADOR
  useEffect(() => {
    const autoImportClients = async () => {
      try {
         const qCasos = query(collection(db, 'casos'), where('type', '==', 'principal'));
         const snapCasos = await getDocs(qCasos);
         
         const snapClientes = await getDocs(collection(db, 'clientes'));
         const existingNames = snapClientes.docs.map(d => d.data().nombre?.toLowerCase() || '');
         
         const newClients = {};
         snapCasos.forEach(doc => {
            const data = doc.data();
            if (data.clientName) {
               const nameLower = data.clientName.toLowerCase();
               if (!existingNames.includes(nameLower) && !newClients[nameLower]) {
                  newClients[nameLower] = {
                     nombre: data.clientName,
                     tipo: data.clientRuc ? 'Jurídica' : 'Natural',
                     documento: data.clientRuc || '',
                     telefono: data.phone || '',
                     correo: data.email || '',
                     contraparte: '',
                     createdAt: new Date().toISOString()
                  };
               }
            }
         });
         
         const keys = Object.keys(newClients);
         if (keys.length > 0) {
            for (const k of keys) await addDoc(collection(db, 'clientes'), newClients[k]);
         }
      } catch (err) { console.error("Error al sincronizar clientes:", err); }
    };
    setTimeout(autoImportClients, 1000);
  }, []);

  const handleSaveClient = async (data) => {
    try {
      if (editingClient) await updateDoc(doc(db, 'clientes', editingClient.id), data);
      else await addDoc(collection(db, 'clientes'), { ...data, createdAt: new Date().toISOString() });
      setIsModalOpen(false);
      setEditingClient(null);
    } catch (err) {
      console.error(err);
      alert("Error guardando cliente.");
    }
  };

  const handleDeleteClient = async (id, nombre) => {
    if (confirm(`¿Seguro que deseas eliminar el registro de ${nombre}?`)) {
      try { await deleteDoc(doc(db, 'clientes', id)); } catch (err) { console.error(err); }
    }
  };

  const handleSaveContraparte = async (data) => {
    try {
      if (editingContraparte) await updateDoc(doc(db, 'contrapartes', editingContraparte.id), data);
      else await addDoc(collection(db, 'contrapartes'), { ...data, createdAt: new Date().toISOString() });
      setIsContraparteModalOpen(false);
      setEditingContraparte(null);
    } catch (err) { console.error(err); alert("Error guardando contraparte."); }
  };
  
  const handleDeleteContraparte = async (id, nombre) => {
    if (confirm(`¿Seguro que deseas eliminar a ${nombre}?`)) {
      try { await deleteDoc(doc(db, 'contrapartes', id)); } catch (err) { console.error(err); }
    }
  };

  const handleSaveServicio = async (data) => {
    try {
      if (editingServicio) await updateDoc(doc(db, 'servicios', editingServicio.id), data);
      else await addDoc(collection(db, 'servicios'), { ...data, createdAt: new Date().toISOString() });
      setIsServicioModalOpen(false);
      setEditingServicio(null);
    } catch (err) { console.error(err); alert("Error guardando servicio."); }
  };

  const handleDeleteServicio = async (id, nombre) => {
    if (confirm(`¿Seguro que deseas eliminar el servicio ${nombre}?`)) {
      try { await deleteDoc(doc(db, 'servicios', id)); } catch (err) { console.error(err); }
    }
  };


  const filteredClientes = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.documento && c.documento.includes(searchTerm))
  );

  const filteredContrapartes = contrapartes.filter(c => 
    c.nombre.toLowerCase().includes(searchContraparteTerm.toLowerCase()) || 
    (c.ruc && c.ruc.includes(searchContraparteTerm))
  );

  const filteredServicios = servicios.filter(s => 
    s.nombre.toLowerCase().includes(searchServicioTerm.toLowerCase())
  );

  const cardClass = "bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-brand-200 dark:border-slate-700 shadow-sm transition-all duration-300 hover:shadow-md hover:border-brand-300 dark:hover:border-slate-600 group";

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-3">
      
      {/* HEADER & TABS */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between border-b border-brand-200 dark:border-slate-700 pb-3 shrink-0 gap-4 transition-colors duration-500">
        <div>
           <div className="flex items-center gap-2 text-brand-500 dark:text-slate-200 text-xs font-bold uppercase tracking-wider mb-2 transition-colors duration-500">
             <Database size={14} className="text-brand-400 dark:text-slate-300"/> Directorio General
           </div>
           
           <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-2">
             <button onClick={() => setActiveTab('clientes')} className={`text-lg md:text-xl font-black tracking-tight transition-all duration-300 ${activeTab === 'clientes' ? 'text-brand-900 dark:text-white border-b-2 border-brand-900 dark:border-white pb-1' : 'text-brand-300 dark:text-slate-500 hover:text-brand-500 dark:hover:text-slate-400'}`}>
               Clientes
             </button>
             <button onClick={() => setActiveTab('contrapartes')} className={`text-lg md:text-xl font-black tracking-tight transition-all duration-300 ${activeTab === 'contrapartes' ? 'text-brand-900 dark:text-white border-b-2 border-brand-900 dark:border-white pb-1' : 'text-brand-300 dark:text-slate-500 hover:text-brand-500 dark:hover:text-slate-400'}`}>
               Contrapartes
             </button>
             <button onClick={() => setActiveTab('servicios')} className={`text-lg md:text-xl font-black tracking-tight transition-all duration-300 ${activeTab === 'servicios' ? 'text-brand-900 dark:text-white border-b-2 border-brand-900 dark:border-white pb-1' : 'text-brand-300 dark:text-slate-500 hover:text-brand-500 dark:hover:text-slate-400'}`}>
               Servicios
             </button>
           </div>
           
           <p className="text-brand-600 dark:text-slate-300 font-medium text-sm mt-3 transition-colors duration-500">
             {activeTab === 'clientes' ? 'Gestión centralizada de contactos y cuadernos de cobranza.' : activeTab === 'contrapartes' ? 'Registro de entidades públicas, juzgados y empresas contrarias.' : 'Administra el catálogo de servicios jurídicos y financieros.'}
           </p>
        </div>

        <button 
          onClick={() => { 
            if (activeTab === 'clientes') { setEditingClient(null); setIsModalOpen(true); }
            else if (activeTab === 'contrapartes') { setEditingContraparte(null); setIsContraparteModalOpen(true); }
            else { setEditingServicio(null); setIsServicioModalOpen(true); }
          }}
          className="flex items-center gap-2 bg-brand-900 hover:bg-brand-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-bold transition-all shadow-md text-sm uppercase tracking-wider whitespace-nowrap"
        >
          <Plus size={18} strokeWidth={2.5}/> {activeTab === 'clientes' ? 'Nuevo Cliente' : activeTab === 'contrapartes' ? 'Nueva Contraparte' : 'Nuevo Servicio'}
        </button>
      </div>

      <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
        
        {/* Búsqueda Dinámica */}
        <div className="relative shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-400 dark:text-slate-300 z-10" size={20} />
          <input
            type="text"
            placeholder={activeTab === 'clientes' ? "Buscar por Nombre, Razón Social, o DNI/RUC..." : activeTab === 'contrapartes' ? "Buscar por Nombre de la Institución o RUC..." : "Buscar por Nombre del Servicio o Categoría..."}
            value={activeTab === 'clientes' ? searchTerm : activeTab === 'contrapartes' ? searchContraparteTerm : searchServicioTerm}
            onChange={(e) => {
              if (activeTab === 'clientes') setSearchTerm(e.target.value);
              else if (activeTab === 'contrapartes') setSearchContraparteTerm(e.target.value);
              else setSearchServicioTerm(e.target.value);
            }}
            className="w-full pl-12 pr-4 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-brand-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-900 dark:focus:ring-blue-500 font-bold text-brand-900 dark:text-white shadow-sm transition-all placeholder:text-brand-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Grillas Dinámicas */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6">
          {isLoading ? (
             <div className="flex justify-center items-center h-48"><AlertCircle size={40} className="text-brand-200 dark:text-slate-700 animate-pulse"/></div>
          ) : activeTab === 'clientes' ? (
             filteredClientes.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                 {filteredClientes.map(cliente => (
                    <div key={cliente.id} className={`${cardClass} p-5 flex flex-col rounded-2xl`}>
                       
                       <div className="flex justify-between items-start mb-4">
                         <div>
                            <span className="inline-block px-2 py-0.5 bg-brand-50 dark:bg-slate-800 text-brand-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded mb-2 border border-brand-100 dark:border-slate-700 transition-colors">
                              {cliente.tipo}
                            </span>
                            <h3 className="text-lg font-black text-brand-900 dark:text-white leading-tight transition-colors">{cliente.nombre}</h3>
                            {cliente.documento && <p className="text-xs text-brand-500 dark:text-slate-200 font-medium mt-1 uppercase tracking-wider transition-colors">DOC: {cliente.documento}</p>}
                         </div>
                         
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => { setEditingClient(cliente); setIsModalOpen(true); }} className="p-1.5 text-brand-400 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-md transition-colors"><Edit2 size={16}/></button>
                           <button onClick={() => handleDeleteClient(cliente.id, cliente.nombre)} className="p-1.5 text-brand-400 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-md transition-colors"><Trash2 size={16}/></button>
                         </div>
                       </div>

                       <div className="space-y-2.5 flex-1 mt-2 border-t border-brand-100 dark:border-slate-700 pt-4 transition-colors">
                         {cliente.telefono && (
                           <div className="flex items-center gap-2.5 text-sm text-brand-700 dark:text-slate-300 transition-colors">
                             <Phone size={14} className="text-brand-400 dark:text-slate-300"/> <span className="font-medium">{cliente.telefono}</span>
                           </div>
                         )}
                         {cliente.correo && (
                           <div className="flex items-center gap-2.5 text-sm text-brand-700 dark:text-slate-300 transition-colors">
                             <Mail size={14} className="text-brand-400 dark:text-slate-300"/> <span className="font-medium truncate">{cliente.correo}</span>
                           </div>
                         )}
                         {(cliente.contraparte || cliente.direccion) && (
                           <div className="flex items-center gap-2.5 text-sm text-brand-700 dark:text-slate-300 transition-colors">
                             <Building size={14} className="text-brand-400 dark:text-slate-300 shrink-0"/> <span className="font-medium truncate text-emerald-600 dark:text-emerald-400">{cliente.contraparte || cliente.direccion}</span>
                           </div>
                         )}
                       </div>

                       <div className="mt-5 pt-3 flex items-center justify-between border-t border-brand-50 dark:border-slate-700/50 transition-colors">
                          <button 
                            onClick={() => setCasesModalClient(cliente.nombre)}
                            className="flex items-center gap-2 text-brand-600 dark:text-slate-300 hover:text-brand-900 dark:hover:text-white font-black text-xs uppercase tracking-wider transition-colors w-full justify-center bg-brand-50 dark:bg-slate-800 hover:bg-brand-100 dark:hover:bg-slate-700 py-2.5 rounded-lg"
                          >
                             <Briefcase size={14} strokeWidth={2.5}/> Ver Cuadernos 
                          </button>
                       </div>
                    </div>
                 ))}
               </div>
             ) : (
                <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 border-2 border-dashed border-brand-200 dark:border-slate-700 rounded-3xl transition-colors">
                  <Users size={64} className="mx-auto text-brand-200 dark:text-slate-700 mb-5" />
                  <p className="text-brand-900 dark:text-white font-bold text-xl mb-2">Sin registros encontrados</p>
                  <p className="text-brand-500 dark:text-slate-200 font-medium text-sm max-w-sm mx-auto">No existen clientes en el directorio que coincidan con tu búsqueda actual.</p>
                </div>
             )
          ) : activeTab === 'contrapartes' ? (
             filteredContrapartes.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                 {filteredContrapartes.map(contraparte => (
                    <div key={contraparte.id} className={`${cardClass} p-5 flex flex-col rounded-2xl`}>
                       <div className="flex justify-between items-start mb-4">
                         <div>
                            <span className="inline-block px-2 py-0.5 bg-brand-50 dark:bg-slate-800 text-brand-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded mb-2 border border-brand-100 dark:border-slate-700 transition-colors">
                              {contraparte.tipo}
                            </span>
                            <h3 className="text-lg font-black text-brand-900 dark:text-white leading-tight transition-colors">{contraparte.nombre}</h3>
                            {contraparte.ruc && <p className="text-xs text-brand-500 dark:text-slate-200 font-medium mt-1 uppercase tracking-wider transition-colors">RUC: {contraparte.ruc}</p>}
                         </div>
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => { setEditingContraparte(contraparte); setIsContraparteModalOpen(true); }} className="p-1.5 text-brand-400 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-md transition-colors"><Edit2 size={16}/></button>
                           <button onClick={() => handleDeleteContraparte(contraparte.id, contraparte.nombre)} className="p-1.5 text-brand-400 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-md transition-colors"><Trash2 size={16}/></button>
                         </div>
                       </div>
                       <div className="space-y-2.5 flex-1 mt-2 border-t border-brand-100 dark:border-slate-700 pt-4 transition-colors">
                         {contraparte.telefono && (
                           <div className="flex items-center gap-2.5 text-sm text-brand-700 dark:text-slate-300 transition-colors">
                             <Phone size={14} className="text-brand-400 dark:text-slate-300"/> <span className="font-medium">{contraparte.telefono}</span>
                           </div>
                         )}
                         {contraparte.direccion && (
                           <div className="flex items-center gap-2.5 text-sm text-brand-700 dark:text-slate-300 transition-colors">
                             <MapPin size={14} className="text-brand-400 dark:text-slate-300 shrink-0"/> <span className="font-medium truncate">{contraparte.direccion}</span>
                           </div>
                         )}
                       </div>
                    </div>
                 ))}
               </div>
             ) : (
                <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 border-2 border-dashed border-brand-200 dark:border-slate-700 rounded-3xl transition-colors">
                  <Building size={64} className="mx-auto text-brand-200 dark:text-slate-700 mb-5" />
                  <p className="text-brand-900 dark:text-white font-bold text-xl mb-2">Sin registros encontrados</p>
                  <p className="text-brand-500 dark:text-slate-200 font-medium text-sm max-w-sm mx-auto">No existen contrapartes en este directorio que coincidan con tu búsqueda actual.</p>
                </div>
             )

          ) : (
             filteredServicios.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                 {filteredServicios.map(servicio => (
                    <div key={servicio.id} className={`${cardClass} p-5 flex flex-col rounded-2xl`}>
                       <div className="flex justify-between items-start mb-4">
                         <div>
                            <h3 className="text-lg font-black text-brand-900 dark:text-white leading-tight transition-colors">{servicio.nombre}</h3>
                         </div>
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                           <button onClick={() => { setEditingServicio(servicio); setIsServicioModalOpen(true); }} className="p-1.5 text-brand-400 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-md transition-colors"><Edit2 size={16}/></button>
                           <button onClick={() => handleDeleteServicio(servicio.id, servicio.nombre)} className="p-1.5 text-brand-400 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-md transition-colors"><Trash2 size={16}/></button>
                         </div>
                       </div>
                       <div className="space-y-2.5 flex-1 mt-2 border-t border-brand-100 dark:border-slate-700 pt-4 transition-colors">
                         {servicio.descripcion ? (
                           <div className="flex items-start gap-2.5 text-sm text-brand-700 dark:text-slate-300 transition-colors">
                             <FileText size={14} className="text-brand-400 dark:text-slate-300 shrink-0 mt-0.5"/> <span className="font-medium text-xs leading-relaxed">{servicio.descripcion}</span>
                           </div>
                         ) : (
                           <p className="text-xs text-brand-400 italic">Sin descripción.</p>
                         )}
                       </div>
                    </div>
                 ))}
               </div>
             ) : (
                <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 border-2 border-dashed border-brand-200 dark:border-slate-700 rounded-3xl transition-colors">
                  <Briefcase size={64} className="mx-auto text-brand-200 dark:text-slate-700 mb-5" />
                  <p className="text-brand-900 dark:text-white font-bold text-xl mb-2">Aún no hay servicios</p>
                  <p className="text-brand-500 dark:text-slate-200 font-medium text-sm max-w-sm mx-auto">Registra los tipos de servicios legales o financieros que ofreces para asignarlos a tus cobros.</p>
                </div>
             )
          )}
        </div>
      </div>

      <ClientModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingClient(null); }} 
        onSave={handleSaveClient} 
        initialData={editingClient} 
        onOpenContraparte={() => setIsContraparteModalOpen(true)}
      />

      <CasesModal 
        isOpen={!!casesModalClient} 
        onClose={() => setCasesModalClient(null)} 
        clientName={casesModalClient} 
      />

      <ContraparteModal 
        isOpen={isContraparteModalOpen} 
        onClose={() => { setIsContraparteModalOpen(false); setEditingContraparte(null); }} 
        onSave={handleSaveContraparte} 
        initialData={editingContraparte} 
      />

      <ServicioModal 
        isOpen={isServicioModalOpen} 
        onClose={() => { setIsServicioModalOpen(false); setEditingServicio(null); }} 
        onSave={handleSaveServicio} 
        initialData={editingServicio} 
      />


    </div>
  );
}
