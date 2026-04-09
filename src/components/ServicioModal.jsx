import React, { useState, useEffect } from 'react';
import { Briefcase, X } from 'lucide-react';

export default function ServicioModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    nombre: '', descripcion: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) setFormData(initialData);
      else setFormData({ nombre: '', descripcion: '' });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

  return (
    <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-brand-200 dark:border-slate-700 flex flex-col">
        <div className="p-6 border-b border-brand-200 dark:border-slate-700 flex justify-between items-center bg-brand-50 dark:bg-slate-800/50 shrink-0">
           <div className="flex items-center gap-3">
             <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 p-2 rounded-lg shadow-sm"><Briefcase size={20} strokeWidth={2.5}/></div>
             <h2 className="text-xl font-black text-brand-900 dark:text-white">{initialData ? 'Editar Servicio' : 'Nuevo Servicio'}</h2>
           </div>
           <button type="button" onClick={onClose} className="text-brand-400 dark:text-slate-300 hover:text-brand-900 dark:hover:text-white p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors border border-transparent hover:border-brand-200 dark:hover:border-slate-700"><X size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="servicioForm" onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">Categoría <span className="text-red-500">*</span></label>
              <input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white" required placeholder="Ej. Trámite Administrativo" autoFocus/>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">Descripción Breve</label>
              <textarea rows={3} value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} className="w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white resize-none" placeholder="Opcional. Detalles del alcance."/>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-brand-200 dark:border-slate-700 flex justify-end gap-3 bg-brand-50 dark:bg-slate-800/50 shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-brand-700 dark:text-slate-300 font-bold hover:bg-brand-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
          <button type="submit" form="servicioForm" className="px-5 py-2.5 bg-brand-900 hover:bg-brand-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold rounded-lg shadow-md transition-all">Guardar</button>
        </div>
      </div>
    </div>
  );
}
