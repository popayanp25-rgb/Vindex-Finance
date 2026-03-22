import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Briefcase, Activity, Calendar, FileText, CheckCircle2, AlertCircle, Clock, PieChart as PieChartIcon, TrendingUp, CheckSquare, Database, Users, Archive, FileSearch, FileDown, X, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Reusable CSS Bar Chart for the Modal
const CSSBarChart = ({ data, labels, colorClass }) => {
  if (!data || data.length === 0) {
     return <div className="flex items-center justify-center h-40 mt-6 bg-brand-50/50 dark:bg-slate-900/50 rounded-xl border border-brand-100 dark:border-slate-800 text-brand-500 dark:text-gray-400 font-bold text-sm">No hay datos suficientes para graficar.</div>;
  }
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-2 h-40 mt-6 p-4 bg-brand-50/50 dark:bg-slate-900/50 rounded-xl border border-brand-100 dark:border-slate-800">
      {data.map((val, i) => {
        const heightPct = (val / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full">
             <div className="text-xs font-black text-brand-700 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">{val}</div>
             <div className="w-full relative h-full flex items-end justify-center bg-brand-200/30 dark:bg-slate-800/40 rounded-t-md overflow-hidden">
                <div className={`w-full max-w-[40px] rounded-t-sm ${colorClass} transition-all duration-700`} style={{ height: `${Math.max(heightPct, 2)}%` }}></div>
             </div>
             <div className="text-[9px] font-bold text-brand-500 dark:text-gray-400 text-center uppercase tracking-wider h-6 flex items-center justify-center break-words leading-tight">{labels[i]}</div>
          </div>
        )
      })}
    </div>
  );
}

const Sparkline = ({ data, colorClass }) => {
  return (
    <div className="flex items-end gap-1 h-10 mt-4 opacity-80 pt-2 border-t border-brand-100 dark:border-slate-800 transition-colors">
      {data.map((h, i) => (
         <div key={i} className={`flex-1 rounded-t-sm ${colorClass} transition-all duration-700`} style={{ height: `${h}%` }}></div>
      ))}
    </div>
  );
};

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
    casesByEntity: {},
    activeList: [],
    execList: [],
    inactiveList: []
  });
  const [_isLoading, setIsLoading] = useState(true);
  
  const [chartModal, setChartModal] = useState(null);

  useEffect(() => {
    if (!userId) return;

    const unsubCasos = onSnapshot(collection(db, 'casos'), (snapshot) => {
      let activeList = [];
      let execList = [];
      let inactiveList = [];
      let total = snapshot.size;
      const byMatter = {};
      const byEntity = {};

      snapshot.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        const stageNum = parseInt(data.stageId, 10);
        
        if (stageNum >= 1 && stageNum <= 10) activeList.push(data);
        if (stageNum === 10) execList.push(data);
        if (stageNum === 11 || stageNum === 12) inactiveList.push(data);
        
        if (data.type === 'principal') {
          if (data.matter) byMatter[data.matter] = (byMatter[data.matter] || 0) + 1;
          if (data.entity) byEntity[data.entity] = (byEntity[data.entity] || 0) + 1;
        }
      });

      setMetrics(prev => ({ 
         ...prev, 
         activeCases: activeList.length, 
         executionCases: execList.length,
         inactiveCases: inactiveList.length, 
         totalCases: total, 
         casesByMatter: byMatter, 
         casesByEntity: byEntity,
         activeList,
         execList,
         inactiveList
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
           if (evDate >= hoy && evDate <= en7Dias) proyeccion++;
        }
      });
      setMetrics(prev => ({ ...prev, upcomingEvents: proyeccion }));
      setIsLoading(false);
    });

    return () => { unsubCasos(); unsubTareas(); unsubAgenda(); };
  }, [userId]);

  // Helper para agrupar fechas por mes
  const groupByMonth = (list) => {
    const map = {};
    list.forEach(c => {
      if (c.createdAt) {
         try {
           const d = new Date(c.createdAt);
           const m = d.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
           map[m] = (map[m] || 0) + 1;
         } catch { map['Sin Fecha'] = (map['Sin Fecha'] || 0) + 1; }
      } else {
         map['Sin Fecha'] = (map['Sin Fecha'] || 0) + 1;
      }
    });
    return map;
  };

  const drawGraphInPDF = (doc, title, labels, values) => {
    const maxVal = Math.max(...values, 1);
    const startX = 14;
    const startY = 40; 
    const chartWidth = 180;
    const chartHeight = 50;
    const itemsCount = values.length || 1;
    const barWidth = Math.min(20, (chartWidth / itemsCount) - 4);
    
    // Axes
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(startX, startY + chartHeight, startX + chartWidth, startY + chartHeight);
    
    doc.setFontSize(8);
    values.forEach((val, i) => {
       const barH = (val / maxVal) * chartHeight;
       const x = startX + 5 + (i * ((chartWidth - 10) / itemsCount));
       const y = startY + chartHeight - barH;
       
       if (barH > 0) {
          doc.setFillColor(59, 130, 246); 
          doc.rect(x, y, barWidth, barH, 'F');
          doc.setTextColor(50);
          doc.text(val.toString(), x + (barWidth/2) - 1, y - 2);
       }
       // label
       const label = labels[i]?.toString() || '';
       doc.text(label.substring(0, 10), x, startY + chartHeight + 5);
    });
    return startY + chartHeight + 15; 
  }

  const generatePDF = (e, type) => {
    e.stopPropagation();
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42); 
    
    let title = "";
    let list = [];
    let labels = [];
    let values = [];

    if (type === 'active') {
      title = "Fase Inicial a Ejecución";
      list = metrics.activeList;
      const countByPhase = Array(10).fill(0);
      list.forEach(c => { if(c.stageId <= 10) countByPhase[c.stageId - 1]++; });
      labels = Array(10).fill(0).map((_,i) => `F${i+1}`);
      values = countByPhase;
    } else if (type === 'exec') {
      title = "Procesos en Ejecución";
      list = metrics.execList;
      const byMonth = groupByMonth(list);
      labels = Object.keys(byMonth);
      values = Object.values(byMonth);
    } else if (type === 'inactive') {
      title = "Expedientes Inactivos";
      list = metrics.inactiveList;
      const byStageAndMonth = {};
      list.forEach(c => {
         let m = "Sin Fecha";
         if (c.createdAt) {
            try { m = new Date(c.createdAt).toLocaleString('es-ES', { month: 'short' }); } catch { /* ignore */ }
         }
         const key = `F${c.stageId}-${m}`;
         byStageAndMonth[key] = (byStageAndMonth[key] || 0) + 1;
      });
      labels = Object.keys(byStageAndMonth);
      values = Object.values(byStageAndMonth);
    }

    doc.text(`Reporte VINDEX: ${title}`, 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Total de registros: ${list.length} expedientes | Generado: ${new Date().toLocaleString()}`, 14, 28);

    // Dibujar grafico PDF
    let tableStartY = 35;
    if (list.length > 0 && values.length > 0) {
       tableStartY = drawGraphInPDF(doc, title, labels, values);
    }

    const tableData = list.map(item => [
      item.title || 'S/N', 
      item.clientName || 'Sin Cliente', 
      item.matter || '-', 
      item.stageId ? `Etapa ${item.stageId}` : '-'
    ]);

    autoTable(doc, {
      startY: tableStartY,
      head: [['Expediente (N°)', 'Cliente / Razón Social', 'Materia', 'Fase Actual']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`VINDEX_${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const getModalChartData = () => {
     if (chartModal === 'active') {
       const counts = Array(10).fill(0);
       metrics.activeList.forEach(c => { if(c.stageId <= 10) counts[c.stageId - 1]++; });
       return { labels: Array(10).fill(0).map((_,i) => `Fase ${i+1}`), data: counts, colorClass: 'bg-blue-500 dark:bg-blue-400' };
     }
     if (chartModal === 'exec') {
       const byMonth = groupByMonth(metrics.execList);
       return { labels: Object.keys(byMonth), data: Object.values(byMonth), colorClass: 'bg-emerald-500 dark:bg-emerald-400' };
     }
     if (chartModal === 'inactive') {
       // Por fase
       const map = {};
       metrics.inactiveList.forEach(c => {
          let m = "N/A";
          if (c.createdAt) {
             try { m = new Date(c.createdAt).toLocaleString('es-ES', { month: 'short' }); } catch { /* ignore */ }
          }
          const key = `F${c.stageId} ${m}`;
          map[key] = (map[key] || 0) + 1;
       });
       return { labels: Object.keys(map), data: Object.values(map), colorClass: 'bg-slate-500 dark:bg-slate-400' };
     }
     return {labels:[], data:[], colorClass:''};
  }

  const matterEntries = Object.entries(metrics.casesByMatter).sort((a,b) => b[1] - a[1]);
  const entityEntries = Object.entries(metrics.casesByEntity).sort((a,b) => b[1] - a[1]);
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500', 'bg-indigo-500'];

  const cardClass = "bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border border-brand-200 dark:border-slate-700/80 rounded-2xl shadow-sm flex flex-col relative overflow-hidden group transition-colors duration-500 cursor-pointer hover:border-brand-400 dark:hover:border-slate-500";
  const cardNoHoverClass = "bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border border-brand-200 dark:border-slate-700/80 rounded-2xl shadow-sm flex flex-col relative overflow-hidden group transition-colors duration-500";
  const numText = "text-3xl font-black text-brand-900 dark:text-gray-100 mb-1 transition-colors duration-500";
  const labelText = "text-[11px] font-bold text-brand-500 dark:text-gray-300 uppercase tracking-wide transition-colors duration-500";

  // Mock array just for the visual card preview below the number
  const previewData1 = [4,2,5,3,6,4,7,5];
  const previewData2 = [1,3,2,5,4,2,3,4];
  const previewData3 = [2,1,2,1,3,1,2,1];

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-6">
      
      {/* Chart Modal */}
      {chartModal && (
        <div className="fixed inset-0 bg-brand-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col border border-brand-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-brand-50 dark:bg-slate-900 border-b border-brand-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <BarChart3 className="text-brand-500 dark:text-gray-400" />
                    <h3 className="text-lg font-black text-brand-900 dark:text-gray-100 tracking-tight">
                       Análisis: {chartModal === 'active' ? 'Fase Inicial' : chartModal === 'exec' ? 'Ejecución' : 'Inactivos'}
                    </h3>
                 </div>
                 <button onClick={() => setChartModal(null)} className="text-brand-400 dark:text-gray-500 hover:text-brand-900 dark:hover:text-white transition-colors p-1"><X size={20} /></button>
              </div>
              <div className="p-6">
                 <p className="text-sm font-medium text-brand-600 dark:text-gray-400 mb-2">Desglose gráfico de la cantidad de expedientes según sus características temporales y de estado.</p>
                 <CSSBarChart {...getModalChartData()} />
                 
                 <div className="mt-8 flex justify-end gap-3">
                    <button onClick={(e) => generatePDF(e, chartModal)} className="flex items-center gap-2 bg-brand-900 hover:bg-brand-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors">
                       <FileDown size={14} /> Descargar Reporte y Gráfico PDF
                    </button>
                    <button onClick={() => setChartModal(null)} className="px-5 py-2.5 bg-brand-50 hover:bg-brand-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-brand-700 dark:text-gray-300 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors">Cerrar</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-end justify-between border-b border-brand-200 dark:border-slate-700 pb-5 shrink-0 gap-4 transition-colors duration-500">
        <div>
           <div className="flex items-center gap-2 text-brand-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1 transition-colors duration-500">
             <Activity size={14} className="text-brand-400 dark:text-gray-400"/> Resumen Ejecutivo
           </div>
           <h1 className="text-3xl font-black text-brand-900 dark:text-white tracking-tight transition-colors duration-500">Hola, {userData?.nombre?.split(' ')[0] || 'Usuario'}</h1>
           <p className="text-brand-600 dark:text-gray-400 font-medium text-sm mt-1 transition-colors duration-500">Aquí está la situación legal y operativa actual de la firma.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6 space-y-6">
        
        {/* TOP CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5">
           
          {/* Card 1: Activos */}
          <div className={`${cardClass} p-5`} onClick={() => setChartModal('active')}>
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-50 dark:bg-blue-900/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
             <div className="relative z-10 flex flex-col h-full">
               <div className="flex justify-between items-start mb-4">
                 <div className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 p-2.5 rounded-xl"><Briefcase size={22} strokeWidth={2.5}/></div>
                 <button onClick={(e) => generatePDF(e, 'active')} className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Descargar Reporte PDF">
                    <FileDown size={18} />
                 </button>
               </div>
               <h3 className={numText}>{metrics.activeCases}</h3>
               <p className={labelText}>Fase Inicial a Ejecución</p>
               
               <div className="flex-1"></div>
               <Sparkline data={previewData1} colorClass="bg-blue-500 dark:bg-blue-400/80" />
               <div className="mt-2 text-center text-[10px] text-brand-400 dark:text-gray-500 uppercase font-black uppercase tracking-wider">Ver Gráfica Completa</div>
             </div>
           </div>

          {/* Card 2: Ejecución */}
          <div className={`${cardClass} p-5`} onClick={() => setChartModal('exec')}>
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-50 dark:bg-emerald-900/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
             <div className="relative z-10 flex flex-col h-full">
               <div className="flex justify-between items-start mb-4">
                 <div className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-2.5 rounded-xl"><FileSearch size={22} strokeWidth={2.5}/></div>
                 <button onClick={(e) => generatePDF(e, 'exec')} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30 rounded-lg transition-colors" title="Descargar Reporte PDF">
                    <FileDown size={18} />
                 </button>
               </div>
               <h3 className={numText}>{metrics.executionCases}</h3>
               <p className={labelText}>Procesos en Ejecución</p>
               
               <div className="flex-1"></div>
               <Sparkline data={previewData2} colorClass="bg-emerald-500 dark:bg-emerald-400/80" />
               <div className="mt-2 text-center text-[10px] text-brand-400 dark:text-gray-500 uppercase font-black uppercase tracking-wider">Análisis por Mes</div>
             </div>
           </div>

          {/* Card 3: Inactivos */}
          <div className={`${cardClass} p-5`} onClick={() => setChartModal('inactive')}>
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-slate-100 dark:bg-slate-800/50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
             <div className="relative z-10 flex flex-col h-full">
               <div className="flex justify-between items-start mb-4">
                 <div className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 p-2.5 rounded-xl"><Archive size={22} strokeWidth={2.5}/></div>
                 <button onClick={(e) => generatePDF(e, 'inactive')} className="p-2 text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Descargar Reporte PDF">
                    <FileDown size={18} />
                 </button>
               </div>
               <h3 className={numText}>{metrics.inactiveCases}</h3>
               <p className={labelText}>Expedientes Inactivos</p>

               <div className="flex-1"></div>
               <Sparkline data={previewData3} colorClass="bg-slate-400 dark:bg-slate-500" />
               <div className="mt-2 text-center text-[10px] text-brand-400 dark:text-gray-500 uppercase font-black uppercase tracking-wider">Ver Etapas</div>
             </div>
           </div>

          {/* Tareas */}
          <div className={`${cardNoHoverClass} p-5`}>
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-rose-50 dark:bg-rose-900/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
             <div className="relative z-10 flex flex-col h-full">
               <div className="flex justify-between items-start mb-4">
                 <div className="bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 p-2.5 rounded-xl"><AlertCircle size={22} strokeWidth={2.5}/></div>
               </div>
               <h3 className={numText}>{metrics.myPendingTasks}</h3>
               <p className={labelText}>Mis Tareas Pendientes</p>
               <div className="flex-1"></div>
               <div className="mt-6 pt-3 border-t border-brand-100 dark:border-slate-800 flex items-center justify-between transition-colors duration-500">
                 <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1"><Clock size={12}/> Requiere atención</span>
                 <Link to="/mis-tareas" className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 transition-colors">Resolver &#8594;</Link>
               </div>
             </div>
           </div>

          {/* Calendario */}
          <div className={`${cardNoHoverClass} p-5`}>
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-50 dark:bg-amber-900/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
             <div className="relative z-10 flex flex-col h-full">
               <div className="flex justify-between items-start mb-4">
                 <div className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 p-2.5 rounded-xl"><Calendar size={22} strokeWidth={2.5}/></div>
               </div>
               <h3 className={numText}>{metrics.upcomingEvents}</h3>
               <p className={labelText}>Audiencias Próximos 7d</p>
               <div className="flex-1"></div>
               <div className="mt-6 pt-3 border-t border-brand-100 dark:border-slate-800 flex items-center justify-between transition-colors duration-500">
                 <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">En toda la firma</span>
                 <Link to="/agenda" className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors">Ver Agenda &#8594;</Link>
               </div>
             </div>
           </div>

        </div>

        {/* BOTTOM SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
           
           {/* CHARTS / DATA VISUALIZATION */}
           <div className={`${cardNoHoverClass} h-[400px]`}>
             <div className="p-5 border-b border-brand-100 dark:border-slate-800 flex items-center gap-3 transition-colors duration-500">
               <PieChartIcon size={20} className="text-brand-500 dark:text-gray-400"/>
               <h3 className="font-bold text-brand-900 dark:text-white tracking-tight">Expedientes por Materia</h3>
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
                         <div className="flex justify-between text-xs font-bold text-brand-700 dark:text-gray-300 mb-1.5 transition-colors duration-500">
                           <span>{matter}</span>
                           <span>{count} Casos ({percentage}%)</span>
                         </div>
                         <div className="w-full bg-brand-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden transition-colors duration-500">
                           <div className={`h-2.5 rounded-full ${colorClass} transition-all duration-1000 ease-out`} style={{width: `${percentage}%`}}></div>
                         </div>
                       </div>
                     )
                   })}
                 </div>
               ) : (
                 <div className="text-center text-brand-400 dark:text-gray-500 font-bold text-sm">
                    No hay casos registrados aún.
                 </div>
               )}
             </div>
           </div>

           {/* CHART 2: Contrapartes */}
           <div className={`${cardNoHoverClass} h-[400px]`}>
             <div className="p-5 border-b border-brand-100 dark:border-slate-800 flex items-center gap-3 transition-colors duration-500">
               <PieChartIcon size={20} className="text-brand-500 dark:text-gray-400"/>
               <h3 className="font-bold text-brand-900 dark:text-white tracking-tight">Frecuencia por Contraparte</h3>
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
                         <div className="flex justify-between text-xs font-bold text-brand-700 dark:text-gray-300 mb-1.5 transition-colors duration-500">
                           <span>{ent}</span>
                           <span>{count} Litigios ({percentage}%)</span>
                         </div>
                         <div className="w-full bg-brand-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden transition-colors duration-500">
                           <div className={`h-2.5 rounded-full ${colorClass} transition-all duration-1000 ease-out`} style={{width: `${percentage}%`}}></div>
                         </div>
                       </div>
                     )
                   })}
                 </div>
               ) : (
                 <div className="text-center text-brand-400 dark:text-gray-500 font-bold text-sm">No hay contrapartes registradas.</div>
               )}
             </div>
           </div>

           {/* ACCESOS RÁPIDOS */}
           <div className={`${cardNoHoverClass} h-[400px]`}>
             <div className="p-5 border-b border-brand-100 dark:border-slate-800 flex items-center gap-3 transition-colors duration-500">
               <FileText size={20} className="text-brand-500 dark:text-gray-400"/>
               <h3 className="font-bold text-brand-900 dark:text-white tracking-tight">Oportunidades y Herramientas</h3>
             </div>
             <div className="p-2 flex-1 flex flex-col justify-center">
                
                <Link to="/crm" className="p-4 flex gap-4 hover:bg-brand-50 dark:hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer group mb-2 border border-transparent hover:border-brand-200 dark:hover:border-slate-700">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-sm">
                    <Users size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-brand-900 dark:text-white text-sm mb-0.5 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">Directorio de Clientes (CRM)</h4>
                    <p className="text-xs text-brand-500 dark:text-gray-400 font-medium leading-relaxed">Administra contactos, vincula cuentas y visualiza expedientes rápida y asociativamente.</p>
                  </div>
                </Link>

                <Link to="/mis-tareas" className="p-4 flex gap-4 hover:bg-brand-50 dark:hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer group border border-transparent hover:border-brand-200 dark:hover:border-slate-700">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                    <CheckSquare size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-brand-900 dark:text-white text-sm mb-0.5 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">Asignar Tarea Urgente</h4>
                    <p className="text-xs text-brand-500 dark:text-gray-400 font-medium leading-relaxed">Delega obligaciones procesales precisas. El sistema documentará y notificará.</p>
                  </div>
                </Link>

             </div>
           </div>

        </div>

      </div>
    </div>
  );
}
