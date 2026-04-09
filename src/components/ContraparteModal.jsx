import React, { useState, useEffect } from 'react';
import { Building, X } from 'lucide-react';

export default function ContraparteModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    nombre: '', ruc: '', tipo: 'Entidad Pública', telefono: '', direccion: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) setFormData(initialData);
      else setFormData({ nombre: '', ruc: '', tipo: 'Entidad Pública', telefono: '', direccion: '' });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

  return (
    <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-[2px] flex items-center justify-center z-[110] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-brand-200 dark:border-slate-700 flex flex-col">
        <div className="p-6 border-b border-brand-200 dark:border-slate-700 flex justify-between items-center bg-brand-50 dark:bg-slate-800/50 shrink-0">
           <div className="flex items-center gap-3">
             <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 p-2 rounded-lg shadow-sm"><Building size={20} strokeWidth={2.5}/></div>
             <h2 className="text-xl font-black text-brand-900 dark:text-white">{initialData ? 'Editar Contraparte' : 'Nueva Contraparte'}</h2>
           </div>
           <button onClick={onClose} className="text-brand-400 dark:text-slate-300 hover:text-brand-900 dark:hover:text-white p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors border border-transparent hover:border-brand-200 dark:hover:border-slate-700"><X size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="contraparteForm" onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">Tipo de Entidad</label>
              <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className="w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white" required>
                <option value="Entidad Pública">Entidad Pública</option>
                <option value="Empresa Privada">Empresa Privada</option>
                <option value="Juzgado / Tribunal">Juzgado / Tribunal</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">Nombre de la Institución / Contraparte <span className="text-red-500">*</span></label>
              <input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white" required placeholder="Ej. Municipalidad de Lima"/>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">RUC</label>
                <input type="text" value={formData.ruc} onChange={e => setFormData({...formData, ruc: e.target.value})} className="w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white" placeholder="Opcional"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">Teléfono</label>
                <input type="tel" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} className="w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white" placeholder="Opcional"/>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-700 dark:text-slate-300 mb-1">Dirección / Sede</label>
              <input type="text" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} className="w-full border border-brand-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 dark:focus:ring-brand-500 bg-white dark:bg-slate-800 text-brand-900 dark:text-white" placeholder="Ej. Palacio Municipal"/>
            </div>

          </form>
        </div>

        <div className="p-5 border-t border-brand-200 dark:border-slate-700 bg-brand-50 dark:bg-slate-800/50 flex justify-end gap-3 rounded-b-2xl">
           <button type="button" onClick={onClose} className="px-5 py-2.5 border border-brand-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-700 font-bold transition-colors text-xs uppercase tracking-wider">Cancelar</button>
           <button type="submit" form="contraparteForm" className="px-6 py-2.5 bg-brand-900 hover:bg-brand-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg font-bold transition-all shadow-md text-xs uppercase tracking-wider">
             {initialData ? 'Guardar Cambios' : 'Registrar Contraparte'}
           </button>
        </div>
      </div>
    </div>
  );
}
