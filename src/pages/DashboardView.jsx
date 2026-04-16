import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, Users, Scale, Building2, 
  PieChart, Activity, Wallet, Award, ArrowUpRight, BarChart3, Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function DashboardView() {
  const [ingresos, setIngresos] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [filterMode, setFilterMode] = useState('historico'); // historico, mensual, semestral, anual
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString()); // YYYY

  const isDateInFilter = (dateStr) => {
    if (filterMode === 'historico') return true;
    if (!dateStr) return false;
    if (filterMode === 'mensual') return dateStr.startsWith(filterMonth);
    if (filterMode === 'anual') return dateStr.startsWith(filterYear);
    if (filterMode === 'semestral') {
        const d = new Date(dateStr);
        const refDate = new Date(filterMonth + '-01');
        refDate.setMonth(refDate.getMonth() + 1); // final del mes base
        const start = new Date(refDate);
        start.setMonth(start.getMonth() - 6);
        return d >= start && d < refDate;
    }
    return true;
  };
  useEffect(() => {
    const unsubIngresos = onSnapshot(query(collection(db, 'ingresos')), (snapshot) => {
      setIngresos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubEgresos = onSnapshot(query(collection(db, 'egresos')), (snapshot) => {
      setEgresos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubClientes = onSnapshot(query(collection(db, 'clientes')), (snapshot) => {
      setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubServicios = onSnapshot(query(collection(db, 'servicios')), (snapshot) => {
      setServicios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const timer = setTimeout(() => setIsLoading(false), 800);

    return () => {
      unsubIngresos(); unsubEgresos(); unsubClientes(); unsubServicios(); clearTimeout(timer);
    };
  }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val);

  // Business Intelligence Calculations
  const metrics = useMemo(() => {
    let rawTotalIngresos = 0;
    let rawTotalEgresos = 0;

    const clienteRev = {};
    const contraparteRev = {};
    const materiaRev = {};
    const tipoHonorarioRev = {};
    const categoriaGasto = {};
    const proveedorGasto = {};

    const clientesDict = clientes.reduce((acc, c) => {
      acc[c.documento] = c;
      return acc;
    }, {});

    const serviciosDict = servicios.reduce((acc, s) => {
       acc[s.nombre] = s.materia || 'General';
       return acc;
    }, {});

    // Procesamiento
    const processPago = (montoBruto, ing, fechaPagoVal) => {
       if (!isDateInFilter(fechaPagoVal)) return;
       const m = Number(String(montoBruto).replace(/,/g, '')) || 0;
       rawTotalIngresos += m;

       let DNI = null;
       if (ing.expedienteId) {
          DNI = ing.expedienteId.split(' - ')[0];
       }

       // Cliente Revenue
       if (DNI && clientesDict[DNI]) {
          const nombreCliente = clientesDict[DNI].nombre;
          clienteRev[nombreCliente] = (clienteRev[nombreCliente] || 0) + m;

          const contraparte = ing.contraparte || clientesDict[DNI].contraparte;
          if (contraparte) {
             contraparteRev[contraparte] = (contraparteRev[contraparte] || 0) + m;
          }
       } else if (DNI) {
          clienteRev[`Desconocido (${DNI})`] = (clienteRev[`Desconocido (${DNI})`] || 0) + m;
       }

       // Materia Revenue -> Ahora es el Servicio
       const materiaStr = ing.servicio || 'Servicio o Categoría General';
       materiaRev[materiaStr] = (materiaRev[materiaStr] || 0) + m;

       // Tipo Honorario
       const th = ing.tipo || 'No deifnido';
       tipoHonorarioRev[th] = (tipoHonorarioRev[th] || 0) + m;
    };

    // Procesando Ingresos (Fijos y Variables)
    ingresos.forEach(ing => {
      if (ing.cronograma && ing.cronograma.length > 0) {
        ing.cronograma.forEach(c => {
          if (c.estado === 'Pagado') {
             processPago(c.monto, ing, c.fechaPago);
          }
        });
      } else {
        if (ing.estado === 'Pagado') {
           processPago(ing.montoTotal, ing, ing.fechaPago);
        }
      }
    });

    // Procesando Egresos
    egresos.forEach(eg => {
       if (eg.estado === 'Pagado') {
          if (!isDateInFilter(eg.fechaPago)) return;
          const m = Number(String(eg.montoTotal).replace(/,/g, '')) || 0;
          rawTotalEgresos += m;

          const cat = eg.categoriaGasto || 'No clasificado';
          categoriaGasto[cat] = (categoriaGasto[cat] || 0) + m;

          const prov = eg.proveedorNombre || 'Desconocido';
          proveedorGasto[prov] = (proveedorGasto[prov] || 0) + m;
       }
    });

    const sortByMax = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
       totalIngresos: rawTotalIngresos,
       totalEgresos: rawTotalEgresos,
       utilidadNeta: rawTotalIngresos - rawTotalEgresos,
       topClientes: sortByMax(clienteRev),
       topContrapartes: sortByMax(contraparteRev),
       topMaterias: sortByMax(materiaRev),
       topCategoriasGasto: sortByMax(categoriaGasto),
       topProveedores: sortByMax(proveedorGasto),
       tipoHonorario: sortByMax(tipoHonorarioRev)
    }
  }, [ingresos, egresos, clientes, servicios, filterMode, filterMonth, filterYear]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-900"></div>
      </div>
    );
  }

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Banner corporativo
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("VINDEX", 14, 25);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("LEGAL GROUP", 46, 25);
    
    doc.setTextColor(212, 175, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("REPORTE ANALÍTICO", pageWidth - 14, 25, { align: "right" });
    
    // Detalles del informe
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    
    let periodoTxt = "HISTÓRICO COMPLETO";
    if (filterMode === 'mensual') periodoTxt = `MES: ${filterMonth}`;
    if (filterMode === 'semestral') periodoTxt = `ÚLTIMOS 6 MESES (Ref: ${filterMonth})`;
    if (filterMode === 'anual') periodoTxt = `AÑO FISCAL: ${filterYear}`;
    
    doc.text(`PERÍODO: ${periodoTxt}`, 14, 55);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - 60, 55);
    
    // Tarjetas Globales
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 65, pageWidth - 28, 40, 'F');
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("INDICADORES GLOBALES", 20, 75);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Ingresos Totales Cobrados:`, 20, 85);
    doc.text(formatCurrency(metrics.totalIngresos), 90, 85);
    
    doc.text(`Gastos Operativos:`, 20, 93);
    doc.text(formatCurrency(metrics.totalEgresos), 90, 93);
    
    doc.setFont("helvetica", "bold");
    doc.text(`UTILIDAD NETA RESULTANTE:`, 20, 101);
    doc.setTextColor(21, 128, 61);
    doc.text(formatCurrency(metrics.utilidadNeta), 90, 101);
    doc.setTextColor(30, 41, 59);
    
    let startY = 115;
    
    const drawTable = (title, data) => {
       if (startY > 250) {
          doc.addPage();
          startY = 20;
       }
       autoTable(doc, {
         startY: startY,
         head: [[title, 'Monto (S/)']],
         body: data.length > 0 ? data.map(item => [item[0], formatCurrency(item[1])]) : [['Sin datos', '-']],
         theme: 'grid',
         headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
         bodyStyles: { textColor: [30, 41, 59], fontSize: 8 },
         alternateRowStyles: { fillColor: [248, 250, 252] }
       });
       startY = doc.lastAutoTable.finalY + 15;
    };
    
    drawTable('Top Clientes por Rentabilidad', metrics.topClientes);
    drawTable('Top Contrapartes Rentables', metrics.topContrapartes);
    drawTable('Top Servicios / Categorías de Ingreso', metrics.topMaterias);
    drawTable('Top Categorías de Gasto', metrics.topCategoriasGasto);
    drawTable('Top Proveedores', metrics.topProveedores);
    
    doc.save(`Dashboard_Analitico_${filterMode}.pdf`);
  };

  // Componente de Barras reutilizable
  const RankedList = ({ title, icon: Icon, data, colorClass, barColorClass }) => {
     let maxVal = data.length > 0 ? data[0][1] : 0;
     return (
       <div className="bg-white dark:bg-slate-900 border border-brand-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
          <h3 className={`flex items-center gap-2 text-sm font-black uppercase tracking-widest mb-6 ${colorClass}`}>
            <Icon size={18} /> {title}
          </h3>
          <div className="flex-1 space-y-5">
             {data.length === 0 && <p className="text-sm font-bold text-brand-400">Sin datos registrados.</p>}
             {data.map((item, idx) => {
                const percentage = maxVal > 0 ? (item[1] / maxVal) * 100 : 0;
                return (
                   <div key={idx} className="group">
                      <div className="flex justify-between items-end mb-1.5">
                         <span className="text-xs font-bold text-brand-900 dark:text-gray-200 line-clamp-1 pr-4">{idx+1}. {item[0]}</span>
                         <span className="text-xs font-black text-brand-700 dark:text-brand-400 whitespace-nowrap">{formatCurrency(item[1])}</span>
                      </div>
                      <div className="w-full bg-brand-50 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                         <div 
                           className={`h-full rounded-full transition-all duration-1000 ease-out ${barColorClass}`}
                           style={{ width: `${percentage}%` }}
                         ></div>
                      </div>
                   </div>
                )
             })}
          </div>
       </div>
     );
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-6 overflow-y-auto pb-20 custom-scrollbar pr-2">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col xl:flex-row items-start xl:items-end justify-between border-b border-brand-200 dark:border-slate-800 pb-4 shrink-0 gap-4">
        <div>
           <h1 className="text-3xl font-black text-brand-900 dark:text-white tracking-tight flex items-center gap-3">
              <PieChart className="text-brand-500" size={32} />
              Dashboard Analítico
           </h1>
           <p className="text-brand-500 dark:text-gray-400 font-medium text-sm mt-1 uppercase tracking-widest">
              Inteligencia de Negocios y Retorno de Inversión {filterMode === 'historico' ? 'Histórico' : filterMode === 'anual' ? `Año ${filterYear}` : filterMode === 'mensual' ? `Mensual (${filterMonth})` : 'Semestral'}
           </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full xl:w-auto">
           {/* FILTER CONTROLS */}
           <div className="flex items-center gap-2 bg-white dark:bg-slate-900 py-1.5 px-3 rounded-xl border border-brand-200 dark:border-slate-700 shadow-sm w-full sm:w-auto">
             <select 
               value={filterMode} 
               onChange={(e) => setFilterMode(e.target.value)}
               className="bg-transparent border-none text-sm font-bold text-brand-900 dark:text-gray-200 focus:ring-0 cursor-pointer"
             >
                <option value="historico">Histórico</option>
                <option value="mensual">Mensual</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
             </select>
             
             {(filterMode === 'mensual' || filterMode === 'semestral') && (
                <input 
                  type="month" 
                  value={filterMonth} 
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="bg-brand-50 dark:bg-slate-800 border-none rounded-lg text-sm font-bold text-brand-900 dark:text-gray-200 focus:ring-2 focus:ring-brand-500 px-3 py-1 cursor-pointer"
                />
             )}
             
             {filterMode === 'anual' && (
                <input 
                  type="number" 
                  value={filterYear} 
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="bg-brand-50 dark:bg-slate-800 border-none rounded-lg text-sm font-bold text-brand-900 dark:text-gray-200 focus:ring-2 focus:ring-brand-500 w-24 px-3 py-1 cursor-pointer"
                />
             )}
           </div>

           <button 
             onClick={handleDownloadPDF}
             className="w-full sm:w-auto bg-brand-900 hover:bg-brand-800 text-white px-5 py-2 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shrink-0"
           >
             <Download size={16} /> Exportar
           </button>
        </div>
      </div>

      {/* TARJETAS GLOBALES */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="bg-gradient-to-br from-indigo-900 to-brand-900 rounded-3xl p-6 shadow-xl border border-indigo-800 text-white relative overflow-hidden group">
           <div className="absolute -right-6 -top-6 opacity-20 group-hover:scale-110 transition-transform"><TrendingUp size={120} strokeWidth={1} /></div>
           <p className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-2">Ingresos Históricos Cobrados</p>
           <h2 className="text-3xl lg:text-4xl font-black drop-shadow-sm">{formatCurrency(metrics.totalIngresos)}</h2>
           <p className="text-xs font-medium text-indigo-100 mt-2 flex items-center gap-1 opacity-80"><Activity size={12} /> Dinero neto ingresado</p>
        </div>

        <div className="bg-gradient-to-br from-rose-900 to-rose-700 rounded-3xl p-6 shadow-xl border border-rose-800 text-white relative overflow-hidden group">
           <div className="absolute -right-6 -top-6 opacity-20 group-hover:scale-110 transition-transform"><TrendingDown size={120} strokeWidth={1} /></div>
           <p className="text-xs font-bold uppercase tracking-widest text-rose-200 mb-2">Gastos Históricos Desembolsados</p>
           <h2 className="text-3xl lg:text-4xl font-black drop-shadow-sm">{formatCurrency(metrics.totalEgresos)}</h2>
           <p className="text-xs font-medium text-rose-100 mt-2 flex items-center gap-1 opacity-80"><Activity size={12} /> Dinero quemado u operativo</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-800 to-emerald-600 rounded-3xl p-6 shadow-xl border border-emerald-700 text-white relative overflow-hidden group">
           <div className="absolute -right-6 -top-6 opacity-20 group-hover:scale-110 transition-transform"><Wallet size={120} strokeWidth={1} /></div>
           <p className="text-xs font-bold uppercase tracking-widest text-emerald-200 mb-2">Utilidad Bruta Histórica</p>
           <h2 className="text-3xl lg:text-4xl font-black drop-shadow-sm">{formatCurrency(metrics.utilidadNeta)}</h2>
           <p className="text-xs font-medium text-emerald-100 mt-2 flex items-center gap-1 opacity-80"><Activity size={12} /> Rentabilidad generada</p>
        </div>
      </motion.div>

      {/* METRICAS DE RENTABILIDAD */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <RankedList 
          title="Top Clientes por Rentabilidad" 
          icon={Award} 
          data={metrics.topClientes} 
          colorClass="text-brand-700 dark:text-brand-400"
          barColorClass="bg-brand-500 shadow-[0_0_10px_rgba(14,165,233,0.8)]"
        />
        <RankedList 
          title="Top Contrapartes Rentables" 
          icon={Building2} 
          data={metrics.topContrapartes} 
          colorClass="text-indigo-600 dark:text-indigo-400"
          barColorClass="bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]"
        />
        <RankedList 
          title="Top Servicios / Categorías de Ingreso" 
          icon={Scale} 
          data={metrics.topMaterias} 
          colorClass="text-emerald-600 dark:text-emerald-400"
          barColorClass="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
        />
      </motion.div>

      {/* METRICAS SECUNDARIAS */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <RankedList 
          title="Top Categorías de Gasto" 
          icon={BarChart3} 
          data={metrics.topCategoriasGasto} 
          colorClass="text-rose-600 dark:text-rose-400"
          barColorClass="bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"
        />
        <RankedList 
          title="Top Proveedores" 
          icon={Users} 
          data={metrics.topProveedores} 
          colorClass="text-amber-600 dark:text-amber-400"
          barColorClass="bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]"
        />
      </motion.div>

    </div>
  );
}
