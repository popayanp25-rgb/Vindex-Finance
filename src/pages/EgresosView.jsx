import React, { useState, useEffect, useMemo } from 'react';
import { subscribeToEgresos, addEgreso, updateEgreso, deleteEgreso } from '../utils/financeStorage';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, DollarSign, Calendar, CheckCircle, Clock, Trash2, Building, ScanLine, FileText, AlertTriangle, CloudUpload, User, HandCoins, Edit2, Download, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function EgresosView() {
  const [egresos, setEgresos] = useState([]);
  const [socios, setSocios] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedIds, setSelectedIds] = useState([]); // <-- MULTISELECT
  
  // Estado base para crear o editar
  const initialFormState = {
    proveedorRuc: '',
    proveedorNombre: '',
    comprobanteTipo: 'Factura',
    comprobanteSerie: '',
    montoTotal: '',
    metodoPago: 'Transferencia bancaria',
    categoriaGasto: 'Causales (Operativos)',
    descripcion: '',
    archivoAdjunto: false,
    estado: 'Pendiente',
    fechaPago: new Date().toISOString().split('T')[0],
    fechaVencimiento: new Date().toISOString().split('T')[0],
    socioVinculado: ''
  };
  
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);

  // IGV Dinámico
  const [igvRate, setIgvRate] = useState(() => Number(localStorage.getItem('vindex_igv')) || 18);
  const [isEditingIgv, setIsEditingIgv] = useState(false);

  const handleIgvChange = (e) => {
     const val = Number(e.target.value);
     setIgvRate(val);
     localStorage.setItem('vindex_igv', val);
  };

  // Creación rápida Socio
  const handleQuickAddSocio = async () => {
     const nombre = window.prompt("Ingresa el nombre del nuevo Socio / Director:");
     if (nombre && nombre.trim()) {
         try {
             await addSocio({ nombre: nombre.trim() });
             setFormData(prev => ({...prev, socioVinculado: nombre.trim()}));
         } catch (e) {
             alert("Error guardando socio: " + e.message);
         }
     }
  };

  // Cálculos SUNAT (Límite 6% Boletas)
  const statsSUNAT = useMemo(() => {
     const currentYear = new Date().getFullYear().toString();
     const egresosDelYear = egresos.filter(eg => eg.fechaVencimiento?.startsWith(currentYear));
     
     const totalFacturas = egresosDelYear.filter(e => e.comprobanteTipo === 'Factura').reduce((sum, e) => sum + Number(e.montoTotal || 0), 0);
     let totalBoletas = egresosDelYear.filter(e => ['Boleta de Venta', 'Otro / Ticket'].includes(e.comprobanteTipo)).reduce((sum, e) => sum + Number(e.montoTotal || 0), 0);
     
     // Si estamos editando una boleta, restamos su valor actual del total acumulado para no "doble contar" al evaluar el límite.
     if (editingId) {
        const oldEgreso = egresos.find(e => e.id === editingId);
        if (oldEgreso && ['Boleta de Venta', 'Otro / Ticket'].includes(oldEgreso.comprobanteTipo)) {
           totalBoletas -= Number(oldEgreso.montoTotal || 0);
        }
     }

     const limitePermitido = totalFacturas * 0.06;
     const disponible = limitePermitido - totalBoletas;
     
     return { totalFacturas, totalBoletas, limitePermitido, disponible };
  }, [egresos, editingId]);

  useEffect(() => {
    const unsubEgresos = subscribeToEgresos((data) => {
      setEgresos(data);
    });
    const unsubSocios = onSnapshot(collection(db, 'users'), (snapshot) => {
      setSocios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubEgresos(); unsubSocios(); }
  }, []);

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!formData.proveedorNombre || !formData.montoTotal || !formData.comprobanteSerie) return;
    
    // SUNAT Alerta Efectivo > 2000
    const mTotal = Number(String(formData.montoTotal).replace(/,/g, '')) || 0;
    if (formData.metodoPago === 'Efectivo' && mTotal > 2000) {
       alert("Alerta Tributaria SUNAT: Los pagos en efectivo superiores a S/ 2,000 deben ser obligatoriamente BANCARIZADOS. Por favor cambia el método de pago o la SUNAT te reparará este gasto.");
       return;
    }

    try {
      const payload = {
        proveedorRuc: formData.proveedorRuc,
        proveedorNombre: formData.proveedorNombre,
        comprobanteTipo: formData.comprobanteTipo,
        comprobanteSerie: formData.comprobanteSerie,
        montoTotal: mTotal,
        metodoPago: formData.metodoPago,
        categoriaGasto: formData.categoriaGasto,
        descripcion: formData.descripcion,
        archivoAdjunto: formData.archivoAdjunto,
        estado: formData.estado,
        fechaPago: formData.estado === 'Pagado' ? formData.fechaPago : null,
        fechaVencimiento: formData.fechaVencimiento,
        socioVinculado: formData.socioVinculado
      };

      if (editingId) {
         await updateEgreso(editingId, payload);
      } else {
         await addEgreso(payload);
      }
      
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(initialFormState);
    } catch (error) {
      alert("Error al guardar: " + error.message);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    await updateEgreso(id, { estado: newStatus });
  };

  const handleToggleDigitalizado = async (id, currentVal) => {
     await updateEgreso(id, { archivoAdjunto: !currentVal });
  };

  const [isDesembolsoModalOpen, setIsDesembolsoModalOpen] = useState(false);
  const [selectedEgresoDesembolso, setSelectedEgresoDesembolso] = useState(null);
  const [fechaDesembolsoConfirm, setFechaDesembolsoConfirm] = useState('');

  const handleOpenDesembolsoModal = (eg) => {
    setSelectedEgresoDesembolso(eg);
    setFechaDesembolsoConfirm(new Date().toISOString().slice(0, 10));
    setIsDesembolsoModalOpen(true);
  };

  const handleConfirmDesembolso = async (e) => {
    e.preventDefault();
    if (!selectedEgresoDesembolso || !fechaDesembolsoConfirm) return;
    
    try {
      await updateEgreso(selectedEgresoDesembolso.id, {
        estado: 'Pagado',
        fechaPago: fechaDesembolsoConfirm
      });
      setIsDesembolsoModalOpen(false);
      setSelectedEgresoDesembolso(null);
      setFechaDesembolsoConfirm('');
    } catch (e) {
      alert("Error al desembolsar: " + e.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este gasto?")) {
      await deleteEgreso(id);
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`¿Seguro que deseas ELIMINAR PERMANENTEMENTE los ${selectedIds.length} egresos seleccionados?`)) {
       try {
         await Promise.all(selectedIds.map(id => deleteEgreso(id)));
         setSelectedIds([]);
       } catch (error) {
         alert("Error al eliminar múltiples registros.");
       }
    }
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const [expandedYears, setExpandedYears] = useState({});
  const toggleYear = (year) => {
    setExpandedYears(prev => ({...prev, [year]: !prev[year]}));
  };

  const filteredEgresos = egresos.filter(e => 
    (e.proveedorNombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.proveedorRuc || '').includes(searchTerm)
  );

  const groupedEgresos = filteredEgresos.reduce((acc, eg) => {
    let dateObj;
    if (eg.estado === 'Pagado' && eg.fechaPago) {
      dateObj = new Date(`${eg.fechaPago}T12:00:00`);
    } else {
      dateObj = new Date(`${eg.fechaVencimiento || new Date().toISOString().slice(0,10)}T12:00:00`);
    }
    const year = dateObj.getFullYear().toString();
    const month = dateObj.toLocaleDateString('es-PE', { month: 'long' });
    const monthCapitalized = month.charAt(0).toUpperCase() + month.slice(1);
    
    if (!acc[year]) acc[year] = {};
    if (!acc[year][monthCapitalized]) acc[year][monthCapitalized] = [];
    
    acc[year][monthCapitalized].push(eg);
    return acc;
  }, {});
  
  const sortedYears = Object.keys(groupedEgresos).sort((a,b) => Number(b) - Number(a));

  const handleDownloadMonthReport = (year, month, monthItems) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
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
      doc.text("REPORTE DE EGRESOS", pageWidth - 14, 25, { align: "right" });
      
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`PERÍODO: ${month.toUpperCase()} ${year}`, 14, 55);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generado el: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - 60, 55);
      
      let totalDesembolsado = 0;
      let totalSustentado = 0;
      let desglose = { 'Factura': 0, 'Recibo por Honorarios': 0, 'Boleta de Venta': 0, 'Otro / Ticket': 0 };
      let rows = [];
      
      monthItems.forEach(eg => {
         if (eg.estado === 'Pagado') {
            const montoNum = Number(eg.montoTotal) || 0;
            totalDesembolsado += montoNum;
            if (eg.comprobanteTipo === 'Factura' || eg.comprobanteTipo === 'Recibo por Honorarios') {
               totalSustentado += montoNum;
            }
            if (desglose[eg.comprobanteTipo] !== undefined) {
               desglose[eg.comprobanteTipo] += montoNum;
            } else {
               desglose['Otro / Ticket'] += montoNum;
            }
            rows.push([
              eg.fechaPago || '-', eg.proveedorNombre || '-', eg.comprobanteTipo, eg.categoriaGasto, formatCurrency(montoNum)
            ]);
         }
      });
      
      if (rows.length === 0) {
         alert("No hay egresos confirmados como 'Pagados' este mes para el reporte.");
         return;
      }
      
      autoTable(doc, {
        startY: 65,
        head: [['F. Pago', 'Proveedor', 'Comprobante', 'Categoría', 'Monto Pagado']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { textColor: [30, 41, 59], fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      
      let finalY = doc.lastAutoTable.finalY + 15;
      if (finalY > 200) { doc.addPage(); finalY = 20; }
      
      doc.setFillColor(248, 250, 252);
      doc.rect(14, finalY, pageWidth - 28, 55, 'F');
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("DESGLOSE DE EGRESOS DEL MES", 20, finalY + 8);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      doc.text(`En Facturas:`, 20, finalY + 17); doc.text(formatCurrency(desglose['Factura']), 95, finalY + 17);
      doc.text(`En Recibos por Honorarios:`, 20, finalY + 25); doc.text(formatCurrency(desglose['Recibo por Honorarios']), 95, finalY + 25);
      doc.text(`En Boletas de Venta:`, 20, finalY + 33); doc.text(formatCurrency(desglose['Boleta de Venta']), 95, finalY + 33);
      doc.text(`En Tickets u Otros:`, 20, finalY + 41); doc.text(formatCurrency(desglose['Otro / Ticket']), 95, finalY + 41);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Total Legalmente Sustentable:`, 125, finalY + 17); doc.text(formatCurrency(totalSustentado), 180, finalY + 17);
      doc.text(`Gasto Efectivo de Caja:`, 125, finalY + 25); doc.text(formatCurrency(totalDesembolsado), 180, finalY + 25);
      
      doc.setFillColor(15, 23, 42);
      doc.rect(14, finalY + 62, pageWidth - 28, 15, 'F');
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("TOTAL LÍQUIDO GASTADO:", 20, finalY + 72);
      doc.setTextColor(251, 113, 133);
      doc.text(formatCurrency(totalDesembolsado), pageWidth - 70, finalY + 72);
      
      doc.save(`Egresos_${month}_${year}.pdf`);
    } catch(err) {
      alert("Error: " + err.message);
    }
  };

  const [cierreParams, setCierreParams] = useState(null);

  const handleCloseYear = (year, yearData) => {
    setCierreParams({ year, yearData });
  };

  const executeCierre = async (shouldPurge) => {
    const { year, yearData } = cierreParams;
    setCierreParams(null);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFillColor(15, 23, 42); doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("VINDEX", 14, 25);
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("LEGAL GROUP", 46, 25);
      doc.setTextColor(212, 175, 55); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("CIERRE FISCAL EGRESOS", pageWidth - 14, 25, { align: "right" });
      
      doc.setTextColor(30, 41, 59); doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text(`AÑO FISCAL: ${year}`, 14, 55);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Generado el: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - 60, 55);
      
      let totalAnual = 0; let totalSustAnual = 0; let startY = 65;
      let desgloseTotal = { 'Factura': 0, 'Recibo por Honorarios': 0, 'Boleta de Venta': 0, 'Otro / Ticket': 0 };

      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      
      monthNames.forEach((m) => {
         const items = yearData[m] || [];
         let rows = []; let pagadoMes = 0;
         items.forEach(eg => {
             if (eg.estado === 'Pagado') {
                const monto = Number(eg.montoTotal) || 0;
                pagadoMes += monto; totalAnual += monto;
                if (eg.comprobanteTipo === 'Factura' || eg.comprobanteTipo === 'Recibo por Honorarios') totalSustAnual += monto;
                if (desgloseTotal[eg.comprobanteTipo] !== undefined) {
                   desgloseTotal[eg.comprobanteTipo] += monto;
                } else {
                   desgloseTotal['Otro / Ticket'] += monto;
                }
                rows.push([eg.fechaPago || '-', eg.proveedorNombre || '-', eg.comprobanteTipo, formatCurrency(monto)]);
             }
         });
         
         if (rows.length > 0) {
            doc.setFillColor(248, 250, 252); doc.rect(14, startY - 6, pageWidth - 28, 10, 'F');
            doc.setTextColor(30, 41, 59); doc.setFontSize(11); doc.setFont("helvetica", "bold");
            doc.text(`MES: ${m.toUpperCase()} - DESEMBOLSADO: ${formatCurrency(pagadoMes)}`, 16, startY);
            
            autoTable(doc, {
              startY: startY + 5, head: [['F. Pago', 'Proveedor', 'Comprobante', 'Monto Pagado']], body: rows,
              theme: 'grid', headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
              bodyStyles: { textColor: [30, 41, 59], fontSize: 8 }, alternateRowStyles: { fillColor: [248, 250, 252] }
            });
            startY = doc.lastAutoTable.finalY + 15;
            if (startY > 250) { doc.addPage(); startY = 20; }
         }
      });
      
      doc.setFillColor(248, 250, 252); doc.rect(14, startY, pageWidth - 28, 55, 'F');
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59); doc.text("RESUMEN FISCAL GASTO ANUAL", 20, startY + 8);
      
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); 
      doc.text(`En Facturas:`, 20, startY + 17); doc.text(formatCurrency(desgloseTotal['Factura']), 95, startY + 17);
      doc.text(`En Recibos por Honorarios:`, 20, startY + 25); doc.text(formatCurrency(desgloseTotal['Recibo por Honorarios']), 95, startY + 25);
      doc.text(`En Boletas de Venta:`, 20, startY + 33); doc.text(formatCurrency(desgloseTotal['Boleta de Venta']), 95, startY + 33);
      doc.text(`En Tickets u Otros:`, 20, startY + 41); doc.text(formatCurrency(desgloseTotal['Otro / Ticket']), 95, startY + 41);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Total Legalmente Sustentable:`, 125, startY + 17); doc.text(formatCurrency(totalSustAnual), 180, startY + 17);
      doc.text(`Total Salidas Efectivas Caja:`, 125, startY + 25); doc.text(formatCurrency(totalAnual), 180, startY + 25);
      
      doc.setFillColor(15, 23, 42); doc.rect(14, startY + 62, pageWidth - 28, 15, 'F');
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255); doc.text("GASTO ANUAL TOTAL:", 20, startY + 72);
      doc.setTextColor(251, 113, 133); doc.text(formatCurrency(totalAnual), pageWidth - 70, startY + 72);
      
      doc.save(`Egresos_Anual_${year}.pdf`);
      
      if (shouldPurge) {
         const allIds = Object.values(yearData).flat().map(eg => eg.id);
         for (const id of allIds) if(id) await deleteEgreso(id);
         alert(`Año Fiscal ${year} cerrado. Registros purgados.`);
      } else {
         alert("Operación completada. Se conservaron los registros de egresos en el sistema.");
      }
    } catch(err) { alert("Error: " + err.message); }
  };

  const getTipoColor = (t) => {
      if (t === 'Factura') return 'bg-blue-100 text-blue-700 border-blue-200';
      if (t === 'Recibo por Honorarios') return 'bg-amber-100 text-amber-700 border-amber-200';
      return 'bg-slate-100 text-slate-700 border-slate-200';
  };
  
  const getCatColor = (c) => {
      if (c === 'Activos Fijos') return 'text-purple-600 bg-purple-50 border-purple-200';
      if (c === 'Causales (Operativos)') return 'text-indigo-600 bg-indigo-50 border-indigo-200';
      return 'text-brand-600 bg-brand-50 border-brand-200';
  };

  const formatCurrency = (val) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val);

  const formatNumberInput = (val) => {
    if (!val) return '';
    let num = String(val).replace(/[^0-9.]/g, '');
    const parts = num.split('.');
    if (parts.length > 2) {
      parts.pop();
      num = parts.join('.');
    }
    // Strict 2 decimal limitation
    if (parts.length === 2 && parts[1].length > 2) {
      parts[1] = parts[1].substring(0, 2);
    }
    if (parts[0]) {
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return parts.join('.');
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-3 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between border-b border-brand-200 dark:border-slate-800 pb-3 shrink-0 gap-4">
        <div>
           <h1 className="text-xl font-black text-brand-900 dark:text-white tracking-tight">Egresos y Cuentas por Pagar</h1>
           <p className="text-brand-600 dark:text-gray-400 font-medium text-xs mt-0.5">Control de gastos fijos, variables y pagos a proveedores o terceros.</p>
        </div>
        <button 
           onClick={() => setIsModalOpen(true)}
           className="bg-brand-900 hover:bg-brand-800 text-white px-5 py-2 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
        >
          <Plus size={16} /> Registrar Gasto
        </button>
      </div>

      {/* FILTERS */}
      <div className="flex flex-col sm:flex-row gap-4 mb-2 justify-between">
        <div className="relative flex-1 max-w-md">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" size={18} />
           <input 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             placeholder="Buscar por Descripción o Proveedor..." 
             className="w-full pl-10 pr-4 py-2 rounded-xl border border-brand-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-brand-900 dark:text-white focus:ring-2 focus:ring-brand-500 transition-all font-medium text-sm shadow-sm"
           />
        </div>
        <button
           onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
           className="bg-white dark:bg-slate-900 border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-4 py-2 rounded-xl font-bold transition-all shadow-sm text-xs flex items-center justify-center gap-2 uppercase tracking-wider shrink-0"
        >
           {sortOrder === 'desc' ? '⬇ Diciembre a Enero' : '⬆ Enero a Diciembre'}
        </button>
      </div>

      {/* FLOATING ACTION BUTTON PARA ELIMINACIÓN MASIVA */}
      {selectedIds.length > 0 && (
         <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-5">
            <button 
              onClick={handleBulkDelete} 
              className="bg-red-600 hover:bg-red-500 text-white shadow-[0_10px_40px_rgba(220,38,38,0.5)] px-6 py-4 rounded-full font-black tracking-widest uppercase flex items-center gap-3 border-2 border-red-400/50 transition-all hover:scale-105"
            >
               <Trash2 size={20} /> Eliminar {selectedIds.length} Egresos
            </button>
         </div>
      )}

      {/* RENDER AGRUPADO POR AÑO Y MES */}
      <div className="flex-1 overflow-y-auto pr-2 pb-20 space-y-8">
        {sortedYears.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-brand-200 dark:border-slate-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
             <div className="w-16 h-16 bg-brand-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <Search size={32} className="text-brand-300 dark:text-gray-600" />
             </div>
             <h3 className="text-lg font-black text-brand-900 dark:text-gray-100 mb-1">No hay egresos que mostrar</h3>
             <p className="text-brand-500 text-sm max-w-sm">No se encontraron gastos bajo los filtros actuales.</p>
          </div>
        ) : (
          sortedYears.map(year => {
            const monthsData = groupedEgresos[year];
            const sortedMonths = Object.keys(monthsData).sort((a, b) => {
              const monthOrder = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
              return sortOrder === 'desc' 
                ? monthOrder.indexOf(b) - monthOrder.indexOf(a)
                : monthOrder.indexOf(a) - monthOrder.indexOf(b);
            });
            const isExpanded = expandedYears[year] !== false;
            
            return (
              <div key={year} className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                 <div 
                   className="bg-white dark:bg-slate-950 px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer sticky top-0 z-10"
                   onClick={() => toggleYear(year)}
                 >
                    <div className="flex items-center gap-3">
                       <Calendar size={24} className="text-brand-500" />
                       <h2 className="text-2xl font-black text-brand-900 dark:text-white tracking-tight">Año Fiscal {year}</h2>
                       {isExpanded ? <ChevronUp size={20} className="text-brand-400 ml-2"/> : <ChevronDown size={20} className="text-brand-400 ml-2"/>}
                    </div>
                    <div className="flex items-center gap-4">
                       <button
                         onClick={(e) => { e.stopPropagation(); handleCloseYear(year, monthsData); }}
                         className="bg-red-50 text-red-600 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-xs font-bold uppercase transition-colors shadow-sm flex items-center gap-1.5"
                         title="Cierra el Año y Borra la Data"
                       >
                         <AlertCircle size={14}/> <span className="hidden sm:inline">Cierre Contable</span>
                       </button>
                    </div>
                 </div>

                 {isExpanded && (
                   <div className="p-4 sm:p-6 space-y-8">
                     {sortedMonths.map(month => (
                       <div key={`${year}-${month}`} className="bg-white dark:bg-slate-900 rounded-3xl border border-brand-100 dark:border-slate-700 shadow-sm overflow-hidden">
                          <div className="bg-brand-50 dark:bg-slate-800/50 px-5 py-4 border-b border-brand-100 dark:border-slate-700 flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm">
                                   <Calendar size={14} className="text-brand-600 dark:text-brand-400" />
                                </div>
                                <h3 className="text-lg font-black text-brand-800 dark:text-gray-200 capitalize tracking-tight">{month}</h3>
                             </div>
                             
                             <button 
                                onClick={() => handleDownloadMonthReport(year, month, monthsData[month])}
                                className="bg-white text-brand-700 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors flex items-center gap-1 shadow-sm"
                             >
                                <Download size={14} /> Reporte
                             </button>
                          </div>
                          
                          <div className="overflow-x-auto">
                           <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-5 py-3 w-10"></th>
                                <th className="px-5 py-3 text-[10px] font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">Identificación Proveedor</th>
                                <th className="px-5 py-3 text-[10px] font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">Sustento Fiscal</th>
                                <th className="px-5 py-3 text-[10px] font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">Clasificación Gasto</th>
                                <th className="px-5 py-3 text-[10px] font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">Monto Total</th>
                                <th className="px-5 py-3 text-[10px] font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest text-center">Desembolso</th>
                                <th className="px-5 py-3 text-[10px] font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest text-right">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                              {monthsData[month].map(eg => {
                                const hoy = new Date().toISOString().slice(0,10);
                                const isOverdue = eg.fechaVencimiento < hoy && eg.estado === 'Pendiente';
                                
                                return (
                                 <tr key={eg.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group ${selectedIds.includes(eg.id) ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                  <td className="px-5 py-4 w-10">
                                     <input 
                                        type="checkbox" 
                                        checked={selectedIds.includes(eg.id)} 
                                        onChange={() => toggleSelection(eg.id)} 
                                        className="w-4 h-4 rounded border-2 border-brand-300 text-red-500 focus:ring-red-500/20 bg-white cursor-pointer shadow-sm transition-all"
                                     />
                                  </td>
                                  <td className="px-5 py-4 min-w-[150px]">
                                    <div className="font-bold text-sm text-brand-900 dark:text-white leading-tight mb-0.5">{eg.proveedorNombre}</div>
                                    <div className="text-[10px] text-brand-500 dark:text-slate-400 font-mono">RUC: {eg.proveedorRuc || 'S/N'}</div>
                                    {eg.socioVinculado && <div className="text-[9px] uppercase font-bold text-indigo-500 mt-1 flex items-center gap-1"><User size={9}/> {eg.socioVinculado}</div>}
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border rounded whitespace-nowrap mb-1 inline-block ${getTipoColor(eg.comprobanteTipo)}`}>
                                      {eg.comprobanteTipo}
                                    </span>
                                    <div className="font-mono text-[10px] font-medium text-brand-700 dark:text-slate-300">{eg.comprobanteSerie}</div>
                                    {eg.archivoAdjunto ? (
                                       <div className="flex items-center gap-1 mt-1.5 text-[9px] text-emerald-600 font-bold uppercase tracking-widest"><CloudUpload size={10}/> Drive Subido</div>
                                    ) : (
                                       <div className="flex items-center gap-2 mt-1.5">
                                          <div className="flex items-center gap-1 text-[9px] text-rose-500 font-bold uppercase tracking-widest">
                                            <AlertTriangle size={10}/> Falta Digitalizar
                                          </div>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleToggleDigitalizado(eg.id, eg.archivoAdjunto); }}
                                            className="px-1.5 py-0.5 bg-brand-50 text-brand-700 hover:bg-brand-200 border border-brand-200 rounded text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                                            title="Marcar como digitalizado en sistema"
                                          >
                                            <CheckCircle size={8}/> Marcar Done
                                          </button>
                                       </div>
                                    )}
                                  </td>
                                  <td className="px-5 py-3 max-w-[180px]">
                                    <span className={`px-2 py-0.5 text-[9px] font-bold border rounded mb-1 inline-block ${getCatColor(eg.categoriaGasto)}`}>
                                      {eg.categoriaGasto}
                                    </span>
                                    <div className="text-[11px] text-brand-600 dark:text-slate-400 leading-snug truncate mt-1" title={eg.descripcion}>{eg.descripcion}</div>
                                  </td>
                                  <td className="px-5 py-3">
                                    <div className="font-black text-sm text-rose-600 dark:text-rose-400 mb-0.5">
                                      - {formatCurrency(eg.montoTotal)}
                                    </div>
                                    <div className="text-[9px] text-slate-500 flex items-center gap-1 uppercase font-bold tracking-wider"><HandCoins size={10}/> {eg.metodoPago}</div>
                                  </td>
                                  <td className="px-5 py-3 text-center">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider shadow-sm border ${
                                      eg.estado === 'Pagado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                      isOverdue ? 'bg-red-50 text-red-700 border-red-200' :
                                      'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                      {eg.estado === 'Pagado' && <CheckCircle size={10}/>}
                                      {eg.estado === 'Pendiente' && !isOverdue && <Clock size={10}/>}
                                      {eg.estado === 'Pagado' ? 'Desembolsado' : (isOverdue ? 'Vencido' : 'Pendiente')}
                                    </span>
                                    <div className="text-[10px] text-slate-500 font-medium mt-1">
                                      {eg.estado === 'Pagado' ? (
                                         <span className="text-emerald-600 font-bold whitespace-nowrap">Fecha: {eg.fechaPago}</span>
                                      ) : (
                                         <span className="whitespace-nowrap">Vence: {eg.fechaVencimiento}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex flex-col items-end gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                      {eg.estado !== 'Pagado' ? (
                                        <button 
                                          onClick={() => handleOpenDesembolsoModal(eg)}
                                          title="Registrar Fecha Efectiva"
                                          className="p-1.5 px-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded transition-colors border border-emerald-200 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap w-full"
                                        >
                                          <CheckCircle size={12} /> Desembolsar
                                        </button>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                           <button 
                                             onClick={() => handleUpdateStatus(eg.id, 'Pendiente')}
                                             className="px-2 py-1 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded text-[9px] font-bold uppercase transition-colors border border-gray-200 whitespace-nowrap"
                                           >
                                             Revertir
                                           </button>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1.5">
                                          <button 
                                            onClick={() => { setFormData({...eg, estado: eg.estado}); setEditingId(eg.id); setIsModalOpen(true); }}
                                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white rounded transition-colors border border-blue-200 flex-1 flex justify-center"
                                          >
                                            <Edit2 size={13} />
                                          </button>
                                          <button 
                                            onClick={() => handleDelete(eg.id)}
                                            className="p-1.5 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded transition-colors border border-rose-200 flex-1 flex justify-center"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                      </div>
                                    </div>
                                  </td>
                                 </tr>
                                )
                              })}
                            </tbody>
                           </table>
                          </div>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
            );
          })
        )}
      </div>

      {/* Creation Modal Escudo Fiscal SUNAT */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white dark:bg-slate-950 rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col border border-brand-200 dark:border-slate-800 max-h-[90vh] overflow-hidden">
              <div className="bg-brand-50 dark:bg-slate-900 border-b border-brand-200 dark:border-slate-800 px-6 py-5 flex items-center justify-between rounded-t-3xl shrink-0">
                 <div>
                    <h3 className="text-xl font-black text-brand-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
                      {editingId ? 'Editar Gasto' : 'Registro de Gasto'}
                    </h3>
                    <p className="text-brand-500 text-xs uppercase font-bold tracking-widest mt-1">Cumplimiento Tributario</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm text-brand-500 hover:text-brand-900 transition-colors">
                    <Trash2 size={20} className="opacity-0" /> X
                 </button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="flex flex-col flex-1 overflow-hidden">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 md:p-8 overflow-y-auto">
                    
                    {/* COLUMNA IZQUIERDA: Identidad y Economía */}
                    <div className="space-y-8">
                       
                       {/* Bloque 1: Identificación */}
                       <section>
                          <h4 className="flex items-center gap-2 text-sm font-black text-brand-800 mb-4 border-b border-brand-100 pb-2 uppercase tracking-widest"><Building size={16}/> 1. Datos de Identificación</h4>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                             <div>
                                <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">RUC del Proveedor</label>
                                <input 
                                   value={formData.proveedorRuc} 
                                   onChange={e => setFormData({...formData, proveedorRuc: e.target.value})} 
                                   placeholder="Ej: 20123456789"
                                   maxLength={11}
                                   className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 bg-brand-50/30 font-medium" 
                                />
                             </div>
                             <div>
                                <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">N° Comprobante/Serie <span className="text-red-500">*</span></label>
                                <input 
                                   required
                                   value={formData.comprobanteSerie} 
                                   onChange={e => setFormData({...formData, comprobanteSerie: e.target.value.toUpperCase()})} 
                                   placeholder="Ej: F001-000123"
                                   className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 font-mono font-bold" 
                                />
                             </div>
                          </div>
                          <div className="mb-4">
                             <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Razón Social o Nombre <span className="text-red-500">*</span></label>
                             <input 
                                required
                                value={formData.proveedorNombre} 
                                onChange={e => setFormData({...formData, proveedorNombre: e.target.value})} 
                                placeholder="Ej: Importaciones SAC"
                                className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 font-bold" 
                             />
                          </div>
                          <div>
                             <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Tipo de Comprobante Fiscal <span className="text-red-500">*</span></label>
                             <select 
                                required 
                                value={formData.comprobanteTipo} 
                                onChange={e => setFormData({...formData, comprobanteTipo: e.target.value})} 
                                className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 bg-white font-bold" 
                             >
                                <option>Factura</option>
                                <option>Recibo por Honorarios</option>
                                <option>Boleta de Venta</option>
                                <option>Otro / Ticket</option>
                             </select>
                          </div>
                       </section>

                       {/* Bloque 2: Economía y Bancarización */}
                       <section>
                          <h4 className="flex items-center gap-2 text-sm font-black text-brand-800 mb-4 border-b border-brand-100 pb-2 uppercase tracking-widest"><DollarSign size={16}/> 2. Datos Económicos y Bancarización</h4>
                          <div className="bg-brand-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-brand-100 mb-4">
                              <label className="block text-xs font-black text-brand-900 uppercase tracking-widest mb-2">Monto Total a Cancelar (S/) <span className="text-red-500">*</span></label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-brand-400">S/</span>
                                <input 
                                   required 
                                   type="text"
                                   value={formData.montoTotal} 
                                   onChange={e => setFormData({...formData, montoTotal: formatNumberInput(e.target.value)})} 
                                   placeholder="Ej: 1,500.00"
                                   className="w-full border-none ring-1 ring-brand-300 rounded-xl pl-9 pr-4 py-3 text-lg focus:ring-2 focus:ring-brand-500 font-black text-rose-600 bg-white shadow-inner" 
                                />
                              </div>
                              
                              {/* Magia IGV UI Reactivo */}
                              {formData.comprobanteTipo === 'Factura' && formData.montoTotal && (
                                <div className="mt-3 grid grid-cols-2 gap-3 text-center border-t border-brand-200 pt-3">
                                   <div>
                                      <p className="text-[10px] uppercase font-bold text-brand-500">Valor Base (Sin IGV)</p>
                                      <p className="font-mono text-xs font-bold text-brand-800">S/ {formatCurrency(Number(String(formData.montoTotal).replace(/,/g, '')) / (1 + (igvRate/100))).replace('PEN ','')}</p>
                                   </div>
                                   <div>
                                      <div className="flex items-center justify-center gap-1 mb-0.5">
                                         <p className="text-[10px] uppercase font-bold text-indigo-500">Impuesto IGV ({igvRate}%)</p>
                                         <button type="button" onClick={() => setIsEditingIgv(!isEditingIgv)} className="text-indigo-400 hover:text-indigo-700 bg-indigo-50 p-0.5 rounded" title="Editar Tasa IGV"><Edit2 size={10} /></button>
                                      </div>
                                      {isEditingIgv ? (
                                         <input type="number" value={igvRate} onChange={handleIgvChange} onBlur={() => setIsEditingIgv(false)} className="w-16 mx-auto text-center border border-indigo-200 rounded text-xs font-bold text-indigo-600 focus:ring-1 focus:ring-indigo-500 bg-white py-0.5 shadow-sm" autoFocus />
                                      ) : (
                                         <p className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 rounded" >S/ {formatCurrency((Number(String(formData.montoTotal).replace(/,/g, '')) / (1 + (igvRate/100))) * (igvRate/100)).replace('PEN ','')}</p>
                                      )}
                                   </div>
                                </div>
                              )}

                              {/* Alertas Límite 6% Boletas */}
                              {['Boleta de Venta', 'Otro / Ticket'].includes(formData.comprobanteTipo) && (
                                 <div className="mt-4 border-t border-amber-200 pt-3">
                                    <div className="flex justify-between items-end mb-2">
                                       <span className="text-[10px] uppercase font-bold text-amber-700">Límite Anual 6% Boletas/Tickets</span>
                                       <span className="font-mono text-xs font-bold text-amber-700">Disp: {formatCurrency(statsSUNAT.disponible > 0 ? statsSUNAT.disponible : 0)}</span>
                                    </div>
                                    
                                    {(Number(String(formData.montoTotal || 0).replace(/,/g, '')) > statsSUNAT.disponible) ? (
                                       <div className="bg-red-50 border border-red-200 p-2.5 rounded-lg">
                                          <p className="text-[10px] text-red-700 font-bold leading-tight flex items-start gap-1.5 whitespace-pre-line">
                                             <AlertTriangle size={14} className="shrink-0 text-red-500 mt-0.5"/>
                                             <span>
                                                ¡CUIDADO! Este gasto ya no descuenta impuestos, el monto excede tu límite legal. Saldrá directamente de tu ganancia neta. Intenta conseguir FACTURA.
                                                {formData.comprobanteTipo === 'Otro / Ticket' && <strong className="block mt-1">Además, ten en cuenta que los tickets u otros comprobantes informales NO SON DEDUCIBLES de manera tributaria.</strong>}
                                             </span>
                                          </p>
                                       </div>
                                    ) : (
                                       <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                                          <p className="text-[10px] text-amber-700 font-bold leading-tight flex items-start gap-1.5 whitespace-pre-line">
                                             <AlertTriangle size={14} className="shrink-0 text-amber-500 mt-0.5"/>
                                             <span>
                                                Dentro del margen. Tienes permitido un máximo de {formatCurrency(statsSUNAT.limitePermitido)} en boletas este año. Intenta pedir factura para comida rápida u otros gastos de representación.
                                                {formData.comprobanteTipo === 'Otro / Ticket' && <strong className="block mt-1 text-red-600">Sin embargo, recuerda que los tickets u otros comprobantes informales NO SON DEDUCIBLES de manera tributaria.</strong>}
                                             </span>
                                          </p>
                                       </div>
                                    )}
                                 </div>
                              )}

                              {/* Alerta de Suministros con Boleta */}
                              {formData.comprobanteTipo === 'Boleta de Venta' && formData.categoriaGasto === 'Suministros Oficina' && (
                                 <div className="mt-3 bg-red-100 border border-red-300 p-3 rounded-xl shadow-inner">
                                    <p className="text-[11px] text-red-800 font-black leading-snug flex items-start gap-2 uppercase tracking-wide">
                                       <AlertTriangle size={24} className="shrink-0 text-red-600"/>
                                       COMPRAS DE OFICINA: NUNCA aceptes boleta por un tóner, resmas de papel o útiles. Exige SIEMPRE Factura. Esta compra no será deducible de impuestos de manera óptima.
                                    </p>
                                 </div>
                              )}
                          </div>

                          <div>
                             <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Método de Pago <span className="text-red-500">*</span></label>
                             <select 
                                required 
                                value={formData.metodoPago} 
                                onChange={e => setFormData({...formData, metodoPago: e.target.value})} 
                                className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 bg-white dark:bg-slate-800 font-bold" 
                             >
                                <option>Transferencia bancaria</option>
                                <option>Yape / Plin</option>
                                <option>Tarjeta Débito/Crédito</option>
                                <option>Efectivo</option>
                             </select>
                             {(formData.metodoPago === 'Efectivo' && Number(String(formData.montoTotal).replace(/,/g, '')) > 2000) && (
                                <p className="text-xs text-red-600 bg-red-50 mt-2 p-2 rounded-lg font-bold flex gap-2 items-start"><AlertTriangle size={14} className="shrink-0 mt-0.5"/> Por normas de la SUNAT, este gasto DEBE ser bancarizado. Reconsidere el método de pago.</p>
                             )}
                          </div>
                       </section>

                    </div>

                    {/* COLUMNA DERECHA: Clasificación y Sustento */}
                    <div className="space-y-8">
                       
                       {/* Bloque 3: Clasificación */}
                       <section>
                          <h4 className="flex items-center gap-2 text-sm font-black text-brand-800 mb-4 border-b border-brand-100 pb-2 uppercase tracking-widest"><FileText size={16}/> 3. Clasificación de Utilidad (Gasto)</h4>
                          <div className="mb-4">
                             <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Categoría de Deducción Fiscal <span className="text-red-500">*</span></label>
                             <select 
                                required 
                                value={formData.categoriaGasto} 
                                onChange={e => setFormData({...formData, categoriaGasto: e.target.value})} 
                                className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 bg-white font-bold" 
                             >
                                <option>Causales (Operativos)</option>
                                <option>Activos Fijos</option>
                                <option>Honorarios de Terceros</option>
                                <option>Gastos de Representación</option>
                                <option>Asesoría / Consultoría</option>
                                <option>Suministros Oficina</option>
                             </select>
                          </div>
                          <div>
                             <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Descripción Específica</label>
                             <textarea 
                                rows={2}
                                value={formData.descripcion} 
                                onChange={e => setFormData({...formData, descripcion: e.target.value})} 
                                placeholder="Ej: Compra de tóner y resmas de hojas..."
                                className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 bg-white resize-none" 
                             />
                          </div>
                       </section>

                       {/* Bloque 4: Control Interno */}
                       <section>
                          <h4 className="flex items-center gap-2 text-sm font-black text-brand-800 mb-4 border-b border-brand-100 pb-2 uppercase tracking-widest"><CheckCircle size={16}/> 4. Sustento y Control Gubernamental</h4>
                          
                          <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 mb-4 flex justify-between items-center transition-all cursor-pointer" onClick={() => setFormData({...formData, archivoAdjunto: !formData.archivoAdjunto})}>
                             <div>
                                <label className="block text-xs font-black text-emerald-900 uppercase">Respaldo Digital Adjunto</label>
                                <p className="text-[10px] text-emerald-700 mt-0.5 max-w-[200px]">¿Fotografía o PDF del recibo subido al Drive mensual local de Egresos?</p>
                             </div>
                             <div className={`w-12 h-6 rounded-full relative transition-colors ${formData.archivoAdjunto ? 'bg-emerald-500' : 'bg-brand-200'}`}>
                                <div className={`absolute w-4 h-4 rounded-full bg-white shadow-sm top-1 transition-all ${formData.archivoAdjunto ? 'left-7' : 'left-1'}`}></div>
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-4">
                             <div>
                                <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Estado del Desembolso <span className="text-red-500">*</span></label>
                                <select 
                                   required 
                                   value={formData.estado} 
                                   onChange={e => setFormData({...formData, estado: e.target.value})} 
                                   className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 bg-white font-bold" 
                                >
                                   <option>Pagado</option>
                                   <option>Pendiente</option>
                                </select>
                             </div>
                             {formData.estado === 'Pagado' ? (
                               <div>
                                  <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">Fecha de Desembolso <span className="text-red-500">*</span></label>
                                  <input 
                                     required 
                                     type="date"
                                     value={formData.fechaPago} 
                                     onChange={e => setFormData({...formData, fechaPago: e.target.value})} 
                                     className="w-full border border-emerald-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 bg-white font-bold text-emerald-900" 
                                  />
                               </div>
                             ) : (
                               <div>
                                  <label className="block text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">Fecha de Desembolso <span className="text-red-500">*</span></label>
                                  <input 
                                     required 
                                     type="date"
                                     value={formData.fechaVencimiento} 
                                     onChange={e => setFormData({...formData, fechaVencimiento: e.target.value})} 
                                     className="w-full border border-amber-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 bg-white font-bold text-amber-900" 
                                  />
                               </div>
                             )}
                          </div>

                          <div>
                             <div className="flex justify-between items-end mb-1.5">
                                <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest">Colaborador / Responsable (Opcional)</label>
                             </div>
                             <select 
                                value={formData.socioVinculado} 
                                onChange={e => setFormData({...formData, socioVinculado: e.target.value})} 
                                className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 bg-white font-medium" 
                             >
                                <option value="">-- Sin asignar / Estudio --</option>
                                {socios.map(soc => (
                                   <option key={soc.id} value={soc.nombre}>{soc.nombre} {soc.rol === 'admin' ? '(Admin)' : ''}</option>
                                ))}
                             </select>
                          </div>

                       </section>

                    </div>

                 </div>

                 <div className="mt-auto bg-brand-50 dark:bg-slate-900 border-t border-brand-200 dark:border-slate-800 p-6 flex justify-end gap-3 rounded-b-3xl shrink-0">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-brand-600 dark:text-gray-400 font-bold text-xs uppercase cursor-pointer hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors tracking-wide shadow-sm border border-brand-200">Cancelar</button>
                    <button type="submit" className="bg-brand-900 hover:bg-brand-800 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider">
                       {editingId ? 'Actualizar Gasto' : 'Generar Gasto'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
      {/* Modal Desembolso Especial */}
      {isDesembolsoModalOpen && (
        <div className="fixed inset-0 bg-brand-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             
             {/* Header Verde */}
             <div className="bg-emerald-100 flex flex-col items-center justify-center pt-8 pb-6 px-6 text-center">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                  <CheckCircle size={28} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-black text-emerald-900 tracking-tight mb-1">Confirmar Desembolso</h3>
                <p className="text-sm font-medium text-emerald-700">Registra la fecha efectiva en la que se desembolsó este gasto.</p>
             </div>

             {/* Formulario */}
             <form onSubmit={handleConfirmDesembolso} className="p-6 bg-white dark:bg-slate-900">
                <div className="mb-8">
                   <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Fecha del Desembolso</label>
                   <input 
                      required
                      type="date"
                      value={fechaDesembolsoConfirm}
                      onChange={e => setFechaDesembolsoConfirm(e.target.value)}
                      className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-lg font-black focus:ring-0 focus:border-emerald-500 bg-slate-50 dark:bg-slate-800 text-center text-slate-800 dark:text-white font-mono"
                   />
                </div>
                <div className="flex items-center gap-3">
                   <button type="button" onClick={() => setIsDesembolsoModalOpen(false)} className="flex-1 py-3 text-slate-600 font-black text-xs uppercase cursor-pointer hover:bg-slate-100 rounded-xl transition-colors tracking-widest text-center">
                     Cancelar
                   </button>
                   <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-black shadow-md transition-colors text-xs uppercase tracking-widest text-center">
                     Confirmar
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}
      
      {/* Modal Cierre Anual Egresos */}
      {cierreParams && (
        <div className="fixed inset-0 bg-brand-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-2xl font-black text-brand-900 mb-2">Cierre Anual {cierreParams.year}</h3>
              <p className="text-sm font-medium text-brand-600 mb-6 flex flex-col gap-1">
                <span>¿Qué deseas hacer con el cierre fiscal de <strong>Egresos</strong> de este año?</span>
              </p>
              
              <div className="space-y-4 mb-6">
                 <button 
                   onClick={() => executeCierre(false)}
                   className="w-full text-left p-4 border-2 border-brand-200 hover:border-brand-500 rounded-2xl transition-all bg-brand-50 hover:bg-brand-100 hover:shadow-md cursor-pointer"
                 >
                    <h4 className="font-black text-brand-900 flex items-center gap-2"><FileText size={18} className="text-brand-500"/> Solo Reporte PDF</h4>
                    <p className="text-[11px] font-bold text-brand-500 mt-1 uppercase tracking-wider">Descarga el reporte contable pero mantiene todo el historial de egresos intacto en el sistema.</p>
                 </button>
                 
                 <button 
                   onClick={() => executeCierre(true)}
                   className="w-full text-left p-4 border-2 border-rose-200 hover:border-rose-500 rounded-2xl transition-all bg-rose-50 hover:bg-rose-100/50 hover:shadow-md cursor-pointer group"
                 >
                    <h4 className="font-black text-rose-700 flex items-center gap-2"><Trash2 size={18} className="text-rose-500 group-hover:scale-110 transition-transform"/> PDF + Purga Segura</h4>
                    <p className="text-[11px] font-bold text-rose-500 mt-1 uppercase tracking-wider">Descarga el reporte detallado y ELIMINA todos los egresos del {cierreParams.year} para limpiar la base de datos.</p>
                 </button>
              </div>
              
              <button onClick={() => setCierreParams(null)} className="w-full py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar Operación</button>
           </div>
        </div>
      )}

    </div>
  );
}
