import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Briefcase, Activity, Calendar, FileText, CheckCircle2, AlertCircle, Clock, PieChart as PieChartIcon, TrendingUp, CheckSquare, Database, Users, Archive, FileSearch } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HomeDashboard() {
  const { userData } = useAuth();
  const userId = userData?.uid || userData?.id;

  const [metrics, setMetrics] = useState({
    activeCases: 0,
    executionCases: 0,
    inactiveCases: 0,
    totalCases: 0,
    myPendingTasks: 0,
    upcomingEvents: 0,
    casesByMatter: {},
    casesByEntity: {}
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    // Suscripciones en tiempo real
    const unsubCasos = onSnapshot(collection(db, 'casos'), (snapshot) => {
      let active = 0;
      let inExecution = 0;
      let inactive = 0;
      let total = snapshot.size;
      const byMatter = {};
      const byEntity = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        const stageNum = parseInt(data.stageId, 10);
        
        // Contabilizar activos (Fase 1 a 10 inclusive)
        if (stageNum >= 1 && stageNum <= 10) {
          active++;
        }
        // Contabilizar en ejecución exclusiva (Fase 10)
        if (stageNum === 10) {
          inExecution++;
        }
        // Contabilizar inactivos (Fase 11 y 12)
        if (stageNum === 11 || stageNum === 12) {
          inactive++;
        }
        
        if (data.type === 'principal') {
          if (data.matter) byMatter[data.matter] = (byMatter[data.matter] || 0) + 1;
          if (data.entity) byEntity[data.entity] = (byEntity[data.entity] || 0) + 1;
        }
      });

      setMetrics(prev => ({ 
         ...prev, 
         activeCases: active, 
         executionCases: inExecution,
         inactiveCases: inactive,
         totalCases: total, 
         casesByMatter: byMatter,
         casesByEntity: byEntity
      }));
    });

    const qTareas = query(collection(db, 'tareas'), where('assigneeId', '==', userId), where('status', '==', 'pending'));
    const unsubTareas = onSnapshot(qTareas, (snapshot) => {
      setMetrics(prev => ({ ...prev, myPendingTasks: snapshot.size }));
    });

    const unsubAgenda = onSnapshot(collection(db, 'agenda'), (snapshot) => {
      const hoy = new Date();
      hoy.setHours(0,0,0,0);
      const en7Dias = new Date();
      en7Dias.setDate(hoy.getDate() + 7);
      
      let proyeccion = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.date) {
           const [y, m, d] = data.date.split('-');
           const evDate = new Date(y, m-1, d);
           if (evDate >= hoy && evDate <= en7Dias) {
             proyeccion++;
           }
        }
      });
      setMetrics(prev => ({ ...prev, upcomingEvents: proyeccion }));
      setIsLoading(false);
    });

    return () => {
      unsubCasos();
      unsubTareas();
      unsubAgenda();
    };
  }, [userId]);

  const matterEntries = Object.entries(metrics.casesByMatter).sort((a,b) => b[1] - a[1]);
  const entityEntries = Object.entries(metrics.casesByEntity).sort((a,b) => b[1] - a[1]);
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500', 'bg-indigo-500'];

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between border-b border-brand-200 pb-5 shrink-0 gap-4">
        <div>
           <div className="flex items-center gap-2 text-brand-500 text-xs font-bold uppercase tracking-wider mb-1">
             <Activity size={14} className="text-brand-400"/> Resumen Ejecutivo
           </div>
           <h1 className="text-3xl font-black text-brand-900 tracking-tight">Hola, {userData?.nombre?.split(' ')[0] || 'Usuario'}</h1>
           <p className="text-brand-600 font-medium text-sm mt-1">Aquí está la situación legal y operativa actual de la firma.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6 space-y-6">
        
        {/* TOP CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5">
           
          <div className="glass-panel p-5 rounded-2xl flex flex-col relative overflow-hidden group">
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
             <div className="relative z-10">
               <div className="flex justify-between items-start mb-4">
                 <div className="bg-blue-100 text-blue-700 p-2.5 rounded-xl"><Briefcase size={22} strokeWidth={2.5}/></div>
               </div>
               <h3 className="text-3xl font-black text-brand-900 mb-1">{metrics.activeCases}</h3>
               <p className="text-[11px] font-bold text-brand-500 uppercase tracking-wide">Fase Inicial a Ejecución</p>
               <div className="mt-3 pt-3 border-t border-brand-100 flex items-center justify-between text-[11px] font-bold">
                 <span className="text-brand-400">Total históricos: {metrics.totalCases}</span>
                 <Link to="/expedientes" className="text-blue-600 hover:text-blue-800 transition-colors">Abrir &#8594;</Link>
               </div>
             </div>
           </div>

          <div className="glass-panel p-5 rounded-2xl flex flex-col relative overflow-hidden group">
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
             <div className="relative z-10">
               <div className="flex justify-between items-start mb-4">
                 <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-xl"><FileSearch size={22} strokeWidth={2.5}/></div>
               </div>
               <h3 className="text-3xl font-black text-brand-900 mb-1">{metrics.executionCases}</h3>
               <p className="text-[11px] font-bold text-brand-500 uppercase tracking-wide">Procesos en Ejecución</p>
               <div className="mt-3 pt-3 border-t border-brand-100 flex items-center justify-between text-[11px] font-bold">
                 <span className="text-emerald-600">Exclusivo Fase 10</span>
                 <Link to="/expedientes" className="text-emerald-600 hover:text-emerald-800 transition-colors">Revisar &#8594;</Link>
               </div>
             </div>
           </div>

          <div className="glass-panel p-5 rounded-2xl flex flex-col relative overflow-hidden group">
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-slate-100 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
             <div className="relative z-10">
               <div className="flex justify-between items-start mb-4">
                 <div className="bg-slate-100 text-slate-700 p-2.5 rounded-xl"><Archive size={22} strokeWidth={2.5}/></div>
               </div>
               <h3 className="text-3xl font-black text-brand-900 mb-1">{metrics.inactiveCases}</h3>
               <p className="text-[11px] font-bold text-brand-500 uppercase tracking-wide">Expedientes Inactivos</p>
               <div className="mt-3 pt-3 border-t border-brand-100 flex items-center justify-between text-[11px] font-bold">
                 <span className="text-slate-500">Concluidos/Archivados</span>
                 <Link to="/expedientes" className="text-slate-600 hover:text-slate-800 transition-colors">Explorar &#8594;</Link>
               </div>
             </div>
           </div>

          <div className="glass-panel p-5 rounded-2xl flex flex-col relative overflow-hidden group">
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-rose-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
             <div className="relative z-10">
               <div className="flex justify-between items-start mb-4">
                 <div className="bg-rose-100 text-rose-700 p-2.5 rounded-xl"><AlertCircle size={22} strokeWidth={2.5}/></div>
               </div>
               <h3 className="text-3xl font-black text-brand-900 mb-1">{metrics.myPendingTasks}</h3>
               <p className="text-[11px] font-bold text-brand-500 uppercase tracking-wide">Mis Tareas Pendientes</p>
               <div className="mt-3 pt-3 border-t border-brand-100 flex items-center justify-between text-[11px] font-bold">
                 <span className="text-rose-600 flex items-center gap-1"><Clock size={12}/> Requiere atención</span>
                 <Link to="/mis-tareas" className="text-rose-600 hover:text-rose-800 transition-colors">Resolver &#8594;</Link>
               </div>
             </div>
           </div>

          <div className="glass-panel p-5 rounded-2xl flex flex-col relative overflow-hidden group">
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
             <div className="relative z-10">
               <div className="flex justify-between items-start mb-4">
                 <div className="bg-amber-100 text-amber-700 p-2.5 rounded-xl"><Calendar size={22} strokeWidth={2.5}/></div>
               </div>
               <h3 className="text-3xl font-black text-brand-900 mb-1">{metrics.upcomingEvents}</h3>
               <p className="text-[11px] font-bold text-brand-500 uppercase tracking-wide">Audiencias Próximos 7d</p>
               <div className="mt-3 pt-3 border-t border-brand-100 flex items-center justify-between text-[11px] font-bold">
                 <span className="text-amber-600">En toda la firma</span>
                 <Link to="/agenda" className="text-amber-600 hover:text-amber-800 transition-colors">Ver Agenda &#8594;</Link>
               </div>
             </div>
           </div>

        </div>

        {/* BOTTOM SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
           
           {/* CHARTS / DATA VISUALIZATION */}
           <div className="glass-panel rounded-2xl flex flex-col h-[400px]">
             <div className="p-5 border-b border-brand-100 flex items-center gap-3">
               <PieChartIcon size={20} className="text-brand-500"/>
               <h3 className="font-bold text-brand-900 tracking-tight">Expedientes por Materia</h3>
             </div>
             <div className="p-6 flex-1 flex flex-col justify-center gap-4 overflow-y-auto">
               {matterEntries.length > 0 ? (
                 <div className="space-y-4">
                   {matterEntries.map(([matter, count], idx) => {
                     const totalP = matterEntries.reduce((acc, curr) => acc + curr[1], 0);
                     const percentage = ((count / totalP) * 100).toFixed(0);
                     const colorClass = colors[idx % colors.length];
                     return (
                       <div key={matter}>
                         <div className="flex justify-between text-xs font-bold text-brand-700 mb-1.5">
                           <span>{matter}</span>
                           <span>{count} Casos ({percentage}%)</span>
                         </div>
                         <div className="w-full bg-brand-100 rounded-full h-2.5 overflow-hidden">
                           <div className={`h-2.5 rounded-full ${colorClass} transition-all duration-1000 ease-out`} style={{width: `${percentage}%`}}></div>
                         </div>
                       </div>
                     )
                   })}
                 </div>
               ) : (
                 <div className="text-center text-brand-400 font-bold text-sm">
                    No hay casos registrados aún.
                 </div>
               )}
             </div>
           </div>

           {/* CHART 2: Contrapartes */}
           <div className="glass-panel rounded-2xl flex flex-col h-[400px]">
             <div className="p-5 border-b border-brand-100 flex items-center gap-3">
               <PieChartIcon size={20} className="text-brand-500"/>
               <h3 className="font-bold text-brand-900 tracking-tight">Frecuencia por Contraparte</h3>
             </div>
             <div className="p-6 flex-1 flex flex-col justify-center gap-4 overflow-y-auto">
                {entityEntries.length > 0 ? (
                 <div className="space-y-4">
                   {entityEntries.map(([ent, count], idx) => {
                     const totalP = entityEntries.reduce((acc, curr) => acc + curr[1], 0);
                     const percentage = ((count / totalP) * 100).toFixed(0);
                     const colorClass = colors[idx % colors.length];
                     return (
                       <div key={ent}>
                         <div className="flex justify-between text-xs font-bold text-brand-700 mb-1.5">
                           <span>{ent}</span>
                           <span>{count} Litigios ({percentage}%)</span>
                         </div>
                         <div className="w-full bg-brand-100 rounded-full h-2.5 overflow-hidden">
                           <div className={`h-2.5 rounded-full ${colorClass} transition-all duration-1000 ease-out`} style={{width: `${percentage}%`}}></div>
                         </div>
                       </div>
                     )
                   })}
                 </div>
               ) : (
                 <div className="text-center text-brand-400 font-bold text-sm">No hay contrapartes registradas.</div>
               )}
             </div>
           </div>

           {/* ACCESOS RÁPIDOS */}
           <div className="bg-white rounded-2xl shadow-sm border border-brand-200 flex flex-col h-[400px]">
             <div className="p-5 border-b border-brand-100 flex items-center gap-3">
               <FileText size={20} className="text-brand-500"/>
               <h3 className="font-bold text-brand-900 tracking-tight">Oportunidades y Herramientas</h3>
             </div>
             <div className="p-2 flex-1 flex flex-col justify-center">
                
                <Link to="/crm" className="p-4 flex gap-4 hover:bg-brand-50 rounded-xl transition-colors cursor-pointer group mb-2 border border-transparent hover:border-brand-200">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-sm">
                    <Users size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-brand-900 text-sm mb-0.5 group-hover:text-purple-700 transition-colors">Directorio de Clientes (CRM)</h4>
                    <p className="text-xs text-brand-500 font-medium leading-relaxed">Administra contactos, vincula cuentas y visualiza expedientes rápida y asociativamente.</p>
                  </div>
                </Link>

                <Link to="/mis-tareas" className="p-4 flex gap-4 hover:bg-brand-50 rounded-xl transition-colors cursor-pointer group border border-transparent hover:border-brand-200">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                    <CheckSquare size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-brand-900 text-sm mb-0.5 group-hover:text-blue-700 transition-colors">Asignar Tarea Urgente</h4>
                    <p className="text-xs text-brand-500 font-medium leading-relaxed">Delega obligaciones procesales precisas. El sistema documentará y notificará automáticamente.</p>
                  </div>
                </Link>

             </div>
           </div>

        </div>

      </div>
    </div>
  );
}
