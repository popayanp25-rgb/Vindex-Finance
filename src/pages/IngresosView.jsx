import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToIngresos, addIngreso, updateIngreso, deleteIngreso, addServicio } from '../utils/financeStorage';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, DollarSign, Calendar, CheckCircle, AlertCircle, Clock, Trash2, ChevronDown, ChevronUp, Download, Edit3, MessageCircle, FileText, Copy, X, Calculator, Edit2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addMonths, addWeeks, addDays, parseISO, format } from 'date-fns';
import ServicioModal from '../components/ServicioModal';

export default function IngresosView() {
  const [ingresos, setIngresos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [selectedClientPreview, setSelectedClientPreview] = useState(null);
  const [isClientReportModalOpen, setIsClientReportModalOpen] = useState(false);
  const [reportSelectedClient, setReportSelectedClient] = useState('');
  const [isServicioModalOpen, setIsServicioModalOpen] = useState(false);
  const [selectedCuotasToRemove, setSelectedCuotasToRemove] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]); // <-- MULTISELECT
  
  const [facturaModalOpen, setFacturaModalOpen] = useState(false);
  const [selectedCuotaContext, setSelectedCuotaContext] = useState(null);
  const [fechaFactura, setFechaFactura] = useState('');
  const [pagoModalOpen, setPagoModalOpen] = useState(false);
  const [selectedCuotaContextPago, setSelectedCuotaContextPago] = useState(null);
  const [fechaPagoConfirm, setFechaPagoConfirm] = useState('');
  const [mesReporteModalOpen, setMesReporteModalOpen] = useState(false);
  const [mesReporteSeleccionado, setMesReporteSeleccionado] = useState(new Date().toISOString().slice(0, 7));
  const [anoReporteModalOpen, setAnoReporteModalOpen] = useState(false);
  const [anoReporteSeleccionado, setAnoReporteSeleccionado] = useState(new Date().getFullYear().toString());
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [servicios, setServicios] = useState([]);

  useEffect(() => {
    const unsubClientes = onSnapshot(query(collection(db, 'clientes')), (snapshot) => {
      setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubServicios = onSnapshot(query(collection(db, 'servicios')), (snapshot) => {
      setServicios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubClientes(); unsubServicios(); };
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    expedienteId: '',
    tipo: 'Honorarios Fijos',
    servicio: '',
    descripcion: '',
    moneda: 'PEN',
    montoTotalEjecucion: '',
    porcentajeGlobalEjecucion: '10', // Default 10%
    igvRate: 18
  });

  const [isEditingIgv, setIsEditingIgv] = useState(false);

  const handleIgvChange = (e) => {
     let val = parseFloat(e.target.value);
     if (isNaN(val) || val < 0) val = 0;
     if (val > 100) val = 100;
     setFormData(prev => ({ ...prev, igvRate: val }));
  };

  const hoyStr = new Date().toISOString().slice(0, 10);
  const [cronograma, setCronograma] = useState([{ cuota: 1, monto: '', vencimiento: hoyStr }]);
  const [autoCrono, setAutoCrono] = useState({ total: '', cuota: '', freq: 'Mensual', inicio: hoyStr });

  useEffect(() => {
    if (!formData.expedienteId) {
      setSelectedClientPreview(null);
      return;
    }
    const docInput = formData.expedienteId.split(' - ')[0];
    const found = clientes.find(c => c.documento === docInput);
    if (found) {
      setSelectedClientPreview(found);
    } else {
      setSelectedClientPreview(null);
    }
  }, [formData.expedienteId, clientes]);

  useEffect(() => {
    const unsubscribe = subscribeToIngresos((data) => {
      // Ordenar por fecha de creación descendente
      setIngresos(data
        .filter(ing => ing.tipo === 'Honorarios Fijos' || ing.tipo === 'Porcentaje de ejecución')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    });
    return () => unsubscribe();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.expedienteId) return;

    // Validar cronograma y calcular monto total
    let montoTotal = 0;
    const cleanCronograma = cronograma.map((c, index) => {
      const parsedMonto = Number(String(c.monto).replace(/,/g, '')) || 0;
      montoTotal += parsedMonto;
      return {
        cuota: index + 1,
        monto: parsedMonto,
        ...(c.montoBase !== undefined && c.montoBase !== '' && { montoBase: Number(String(c.montoBase).replace(/,/g, '')) }),
        ...(c.porcentaje !== undefined && c.porcentaje !== '' && { porcentaje: Number(String(c.porcentaje).replace(/,/g, '')) }),
        vencimiento: c.vencimiento,
        estado: c.estado || 'Pendiente',
        fechaPago: c.fechaPago || '',
        facturado: c.facturado || false,
        fechaFacturacion: c.fechaFacturacion || ''
      };
    });

    try {
      if (editingId) {
        // En lugar de sobreescribir el estado general, recalculamos al guardar
        const totalCuotas = cleanCronograma.length;
        const pagadas = cleanCronograma.filter(c => c.estado === 'Pagado').length;
        let nuevoEstadoGeneral = 'Pendiente';
        if (totalCuotas === 0) nuevoEstadoGeneral = 'Por Definir';
        else if (pagadas === totalCuotas) nuevoEstadoGeneral = 'Pagado';
        else if (pagadas > 0) nuevoEstadoGeneral = 'Parcial';

        await updateIngreso(editingId, {
          expedienteId: formData.expedienteId,
          tipo: formData.tipo,
          servicio: formData.servicio,
          descripcion: formData.descripcion || '',
          moneda: formData.moneda,
          montoTotalEjecucion: formData.montoTotalEjecucion ? Number(formData.montoTotalEjecucion) : 0,
          montoTotal: montoTotal,
          estado: nuevoEstadoGeneral,
          cronograma: cleanCronograma,
          igvRate: formData.igvRate ?? 18
        });
      } else {
        await addIngreso({
          expedienteId: formData.expedienteId,
          tipo: formData.tipo,
          servicio: formData.servicio,
          descripcion: formData.descripcion || '',
          moneda: formData.moneda,
          montoTotalEjecucion: formData.montoTotalEjecucion ? Number(formData.montoTotalEjecucion) : 0,
          montoTotal: montoTotal,
          estado: 'Pendiente',
          cronograma: cleanCronograma,
          igvRate: formData.igvRate ?? 18
        });
      }
      
      handleCloseModal();
    } catch (error) {
      alert("Error al guardar el cuaderno: " + error.message);
    }
  };

  const handleEdit = (ingreso) => {
    setFormData({
      expedienteId: ingreso.expedienteId,
      tipo: ingreso.tipo,
      servicio: ingreso.servicio || '',
      descripcion: ingreso.descripcion || '',
      moneda: ingreso.moneda || 'PEN',
      montoTotalEjecucion: ingreso.montoTotalEjecucion || '',
      porcentajeGlobalEjecucion: '10', // Puedes extraerlo de la BD si quisieras
      igvRate: ingreso.igvRate ?? 18
    });
    setCronograma(ingreso.cronograma || []);
    setEditingId(ingreso.id);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setSelectedCuotasToRemove([]);
    setFormData({ expedienteId: '', tipo: 'Honorarios Fijos', servicio: '', descripcion: '', moneda: 'PEN', montoTotalEjecucion: '', porcentajeGlobalEjecucion: '10', igvRate: 18 });
    setCronograma([{ cuota: 1, monto: '', vencimiento: new Date().toISOString().slice(0, 10) }]);
  };

  const handleSaveServicio = async (data) => {
    await addServicio(data);
    setIsServicioModalOpen(false);
  };

  const handleOpenPagoModal = (ingreso, cuota, cuotaIndex) => {
    setSelectedCuotaContextPago({ ingresoId: ingreso.id, cuotaIndex, ingresoObj: ingreso });
    setFechaPagoConfirm(new Date().toISOString().slice(0, 10)); // Default today
    setPagoModalOpen(true);
  };

  const handleConfirmPago = async (e) => {
    e.preventDefault();
    if (!selectedCuotaContextPago || !fechaPagoConfirm) return;
    const { ingresoId, cuotaIndex, ingresoObj } = selectedCuotaContextPago;
    const updatedCronograma = [...ingresoObj.cronograma];
    updatedCronograma[cuotaIndex].estado = 'Pagado';
    updatedCronograma[cuotaIndex].fechaPago = fechaPagoConfirm;

    const totalCuotas = updatedCronograma.length;
    const pagadas = updatedCronograma.filter(c => c.estado === 'Pagado').length;
    let nuevoEstadoGeneral = 'Pendiente';
    if (totalCuotas === 0) nuevoEstadoGeneral = 'Por Definir';
    else if (pagadas === totalCuotas) nuevoEstadoGeneral = 'Pagado';
    else if (pagadas > 0) nuevoEstadoGeneral = 'Parcial';

    await updateIngreso(ingresoId, { cronograma: updatedCronograma, estado: nuevoEstadoGeneral });
    setPagoModalOpen(false);
    setSelectedCuotaContextPago(null);
    setFechaPagoConfirm('');
  };

  const handleUpdateCuotaStatus = async (ingreso, cuotaIndex, newStatus) => {
    if (newStatus === 'Pagado') {
       handleOpenPagoModal(ingreso, ingreso.cronograma[cuotaIndex], cuotaIndex);
       return;
    }
    
    const updatedCronograma = [...ingreso.cronograma];
    updatedCronograma[cuotaIndex].estado = newStatus;
    updatedCronograma[cuotaIndex].fechaPago = '';
    updatedCronograma[cuotaIndex].facturado = false;
    updatedCronograma[cuotaIndex].fechaFacturacion = '';

    // Recalcular el estado general del ingreso
    const totalCuotas = updatedCronograma.length;
    const pagadas = updatedCronograma.filter(c => c.estado === 'Pagado').length;
    
    let nuevoEstadoGeneral = 'Pendiente';
    if (totalCuotas === 0) nuevoEstadoGeneral = 'Por Definir';
    else if (pagadas === totalCuotas) nuevoEstadoGeneral = 'Pagado';
    else if (pagadas > 0) nuevoEstadoGeneral = 'Parcial';

    await updateIngreso(ingreso.id, {
      cronograma: updatedCronograma,
      estado: nuevoEstadoGeneral
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este registro de cobranza y todo su cronograma?")) {
      await deleteIngreso(id);
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`¿Seguro que deseas ELIMINAR PERMANENTEMENTE los ${selectedIds.length} cuadernos seleccionados y todo su historial de cuotas?`)) {
       try {
         await Promise.all(selectedIds.map(id => deleteIngreso(id)));
         setSelectedIds([]);
       } catch (error) {
         alert("Error al eliminar múltiples registros.");
       }
    }
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const addCuotaField = () => {
    setCronograma([...cronograma, { cuota: cronograma.length + 1, monto: '', vencimiento: '' }]);
  };

  const removeCuotaField = (index) => {
    if (cronograma.length > 0) {
      setCronograma(cronograma.filter((_, i) => i !== index));
    }
  };

  const duplicateCuotaField = (index) => {
    const cuotaToCopy = cronograma[index];
    const newCrono = [...cronograma];
    const newItem = {
      ...cuotaToCopy,
      cuota: 0
    };
    newCrono.splice(index + 1, 0, newItem);
    const renumbered = newCrono.map((c, i) => ({...c, cuota: i + 1}));
    setCronograma(renumbered);
  };

  const emptyCronograma = () => {
    if (window.confirm("¿Deseas limipar todas las cuotas de este cuaderno? Podrás añadir cuotas después editando el cuaderno.")) {
      setCronograma([]);
    }
  };

  const handleWhatsAppReminder = (ingreso, cuota) => {
    const docInput = ingreso.expedienteId.split(' - ')[0];
    const client = clientes.find(c => c.documento === docInput);
    if (!client || !client.telefono) {
      alert("El cliente no tiene un número de celular/teléfono registrado en el directorio.");
      return;
    }
    const montoFormat = formatCurrency(cuota.monto);
    const mensaje = `Hola ${client.nombre}, te saludamos de VINDEX Finance. Te recordamos que tienes una cuota pendiente de tu "${ingreso.tipo}" por el monto de ${montoFormat} vencida el ${cuota.vencimiento}. Por favor comunícate con nosotros para regularizar el estado de tu pago.`;
    const phone = client.telefono.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=51${phone}&text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const handleOpenFacturaModalFijos = (ingreso, cuota, cuotaIndex) => {
    if (cuota.facturado) {
      const updatedCronograma = [...ingreso.cronograma];
      updatedCronograma[cuotaIndex].facturado = false;
      updatedCronograma[cuotaIndex].fechaFacturacion = '';
      updateIngreso(ingreso.id, { cronograma: updatedCronograma });
      return;
    }
    setSelectedCuotaContext({ ingresoId: ingreso.id, cuotaIndex, ingresoObj: ingreso });
    setFechaFactura(cuota.fechaPago || cuota.vencimiento || new Date().toISOString().split('T')[0]);
    setFacturaModalOpen(true);
  };

  const handleConfirmFacturaFijos = async (e) => {
    e.preventDefault();
    if (!selectedCuotaContext || !fechaFactura) return;
    const { ingresoId, cuotaIndex, ingresoObj } = selectedCuotaContext;
    const updatedCronograma = [...ingresoObj.cronograma];
    updatedCronograma[cuotaIndex].facturado = true;
    updatedCronograma[cuotaIndex].fechaFacturacion = fechaFactura;
    await updateIngreso(ingresoId, { cronograma: updatedCronograma });
    setFacturaModalOpen(false);
    setSelectedCuotaContext(null);
    setFechaFactura('');
  };

  const handleDownloadReporteMensualFijos = () => {
    const yearMonth = mesReporteSeleccionado;
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
    doc.text("REPORTE MENSUAL (FIJOS)", pageWidth - 14, 25, { align: "right" });
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text(`PERÍODO: ${yearMonth}`, 14, 55);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - 60, 55);
      
    let totalPagado = 0;
    let totalFacturado = 0;
    let totalBaseFacturada = 0;
    let totalIgvFacturado = 0;
    let totalPendiente = 0;
    let totalGlobal = 0;
    let rows = [];
    
    ingresos.forEach(ing => {
       (ing.cronograma || []).forEach((c) => {
          const isPagoThisMonth = (c.fechaPago || '').startsWith(yearMonth);
          const isFacturaThisMonth = (c.fechaFacturacion || '').startsWith(yearMonth);
          const isVencThisMonth = (c.vencimiento || '').startsWith(yearMonth);
          
          let showInReport = false;
          
          if (c.estado === 'Pagado') {
             if (isPagoThisMonth || isFacturaThisMonth) showInReport = true;
          } else {
             if (isVencThisMonth) showInReport = true;
          }
          
          if (showInReport) {
             const montoNum = Number(String(c.monto).replace(/,/g, '')) || 0;
             if (c.estado === 'Pagado') {
                 if (isPagoThisMonth) {
                    totalPagado += montoNum;
                    totalGlobal += montoNum;
                 }
                 if (isFacturaThisMonth) {
                    totalFacturado += montoNum;
                    const rate = ing.igvRate ?? 18;
                    totalBaseFacturada += montoNum / (1 + (rate / 100));
                    totalIgvFacturado += montoNum - (montoNum / (1 + (rate / 100)));
                 }
             } else {
                 if (isVencThisMonth) {
                    totalPendiente += montoNum;
                    totalGlobal += montoNum;
                 }
             }
             
             rows.push([
               c.fechaPago || '-',
               c.fechaFacturacion || '-',
               ing.expedienteId,
               `${ing.tipo} (C${c.cuota})`,
               c.estado,
               formatCurrency(montoNum)
             ]);
          }
       });
    });
    
    if (rows.length === 0) {
       alert("No se encontraron registros o pagos con esta fecha.");
       return;
    }
    
    autoTable(doc, { 
      startY: 65, 
      head: [['F. Pago', 'F. Factura', 'Cliente / Expediente', 'Concepto', 'Estado', 'Monto']], 
      body: rows, 
      theme: 'grid', 
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 }, 
      bodyStyles: { textColor: [30, 41, 59], fontSize: 8 }, 
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    
    let finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 210) { doc.addPage(); finalY = 20; }
    
    doc.setFillColor(248, 250, 252);
    doc.rect(14, finalY, pageWidth - 28, 60, 'F');
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59);
    doc.text("RESUMEN FISCAL MENSUAL", 20, finalY + 8);
    
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Dinero Recaudado (Pagado este Mes):`, 20, finalY + 17); doc.text(formatCurrency(totalPagado), 105, finalY + 17);
    doc.text(`Ingresos Contables (Facturado este Mes):`, 20, finalY + 25); doc.text(formatCurrency(totalFacturado), 105, finalY + 25);
    doc.text(`(-) Base Imponible Facturada:`, 20, finalY + 33); doc.text(formatCurrency(totalBaseFacturada), 105, finalY + 33);
    doc.text(`(-) IGV Extraído de Facturación:`, 20, finalY + 41); doc.text(formatCurrency(totalIgvFacturado), 105, finalY + 41);
    doc.text(`Total Pendiente de Cobro del Mes:`, 20, finalY + 49); doc.text(formatCurrency(totalPendiente), 105, finalY + 49);
    
    doc.setFillColor(15, 23, 42); doc.rect(14, finalY + 54, pageWidth - 28, 15, 'F');
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text("GLOBAL/PREVISIÓN DEL MES:", 20, finalY + 64); doc.setTextColor(212, 175, 55); doc.text(formatCurrency(totalGlobal), pageWidth - 70, finalY + 64);
    doc.save(`Reporte_Mensual_Fijos_${yearMonth}.pdf`);
    setMesReporteModalOpen(false);
  };

  const handleDownloadReporteAnualFijos = () => {
    const year = anoReporteSeleccionado;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
    doc.text("VINDEX", 14, 25);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("LEGAL GROUP", 46, 25);
    doc.setTextColor(212, 175, 55); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("REPORTE DE RENTA ANUAL (FIJOS)", pageWidth - 14, 25, { align: "right" });
    
    doc.setTextColor(30, 41, 59); doc.setFontSize(12); doc.text(`AÑO FISCAL: ${year}`, 14, 55);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - 60, 55);
      
    let totalPagadoAño = 0;
    let totalFacturadoAño = 0;
    let totalBaseFacturadaAño = 0;
    let totalIgvFacturadoAño = 0;
    let startY = 65;
    
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    monthNames.forEach((monthName, idx) => {
       const monthNum = String(idx + 1).padStart(2, '0');
       const yearMonth = `${year}-${monthNum}`;
       
       let totalPagadoMes = 0;
       let rows = [];
       
       ingresos.forEach(ing => {
          (ing.cronograma || []).forEach((c) => {
             const isPagoThisMonth = (c.fechaPago || '').startsWith(yearMonth);
             const isFacturaThisMonth = (c.fechaFacturacion || '').startsWith(yearMonth);
             
             if (c.estado === 'Pagado' && (isPagoThisMonth || isFacturaThisMonth)) {
                const montoNum = Number(String(c.monto).replace(/,/g, '')) || 0;
                if (isPagoThisMonth) {
                   totalPagadoMes += montoNum;
                   totalPagadoAño += montoNum;
                }
                if (isFacturaThisMonth) {
                   totalFacturadoAño += montoNum;
                   const rate = ing.igvRate ?? 18;
                   totalBaseFacturadaAño += montoNum / (1 + (rate / 100));
                   totalIgvFacturadoAño += montoNum - (montoNum / (1 + (rate / 100)));
                }
                
                rows.push([
                  c.fechaPago || '-',
                  c.fechaFacturacion || '-',
                  ing.expedienteId,
                  `${ing.tipo} (C${c.cuota})`,
                  formatCurrency(montoNum)
                ]);
             }
          });
       });
       
       if (rows.length > 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, startY - 6, pageWidth - 28, 10, 'F');
          doc.setTextColor(30, 41, 59); doc.setFontSize(11); doc.setFont("helvetica", "bold");
          doc.text(`MES: ${monthName.toUpperCase()} - RECAUDADO LÍQUIDO: ${formatCurrency(totalPagadoMes)}`, 16, startY);
          
          autoTable(doc, {
            startY: startY + 5,
            head: [['F. Pago', 'F. Factura', 'Cliente / Expediente', 'Concepto', 'Monto']],
            body: rows,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { textColor: [30, 41, 59], fontSize: 8 },
            alternateRowStyles: { fillColor: [248, 250, 252] }
          });
          
          startY = doc.lastAutoTable.finalY + 15;
          if (startY > 250) { doc.addPage(); startY = 20; }
       }
    });
    
    doc.setFillColor(248, 250, 252);
    doc.rect(14, startY, pageWidth - 28, 48, 'F');
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59);
    doc.text("RESUMEN FISCAL DEL AÑO", 20, startY + 8);
    
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Total Dinero Recaudado en el Año:`, 20, startY + 17); doc.text(formatCurrency(totalPagadoAño), 105, startY + 17);
    doc.text(`Ingresos Totales Facturados:`, 20, startY + 25); doc.text(formatCurrency(totalFacturadoAño), 105, startY + 25);
    doc.text(`(-) Base Imponible Anual Facturada:`, 20, startY + 33); doc.text(formatCurrency(totalBaseFacturadaAño), 105, startY + 33);
    doc.text(`(-) IGV Anual Extraído:`, 20, startY + 41); doc.text(formatCurrency(totalIgvFacturadoAño), 105, startY + 41);
    
    doc.setFillColor(15, 23, 42); doc.rect(14, startY + 53, pageWidth - 28, 15, 'F');
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text("SALDO LÍQUIDO ANUAL:", 20, startY + 63); doc.setTextColor(212, 175, 55); doc.text(formatCurrency(totalPagadoAño), pageWidth - 70, startY + 63);
    
    doc.save(`Renta_Anual_Fijos_${year}.pdf`);
    setAnoReporteModalOpen(false);
  };

  const handleDownloadComprobante = (ingreso, cuota, idx) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Banner corporativo
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Textos del Banner
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("VINDEX", 14, 25);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("LEGAL GROUP", 46, 25);
    
    doc.setTextColor(212, 175, 55); // Dorado corporativo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("RECIBO DE PAGO PROFESIONAL", pageWidth - 14, 25, { align: "right" });
    
    // Reset colores texto
    doc.setTextColor(30, 41, 59); // slate-800
    
    // N° Operación y Fecha Emisión
    const nOperacion = `V-${new Date().getTime().toString().slice(-6)}-${(idx+1).toString().padStart(2, '0')}`;
    const fechaEmision = new Date().toLocaleDateString('es-PE');
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`N° Operación:`, 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(`${nOperacion}`, 45, 55);
    
    doc.setFont("helvetica", "bold");
    doc.text(`Fecha de Emisión:`, pageWidth - 60, 55);
    doc.setFont("helvetica", "normal");
    doc.text(`${fechaEmision}`, pageWidth - 25, 55);
    
    // Línea divisoria
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 62, pageWidth - 14, 62);
    
    // Cuerpo del Comprobante
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Detalle de la Cuota", 14, 75);
    
    autoTable(doc, {
      startY: 85,
      head: [['Concepto', 'Cliente / Expediente', 'Vencimiento Original']],
      body: [[
        `${ingreso.tipo} (${ingreso.servicio || 'General'}) - Cuota N° ${idx + 1} de ${(ingreso.cronograma || []).length}`,
        ingreso.expedienteId,
        cuota.vencimiento
      ]],
      theme: 'plain',
      headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontStyle: 'bold' },
      bodyStyles: { textColor: [15, 23, 42], fontSize: 11 },
      margin: { left: 14, right: 14 }
    });
    
    const finalY = doc.lastAutoTable.finalY || 110;
    
    // Resumen Financiero
    doc.setFillColor(248, 250, 252);
    doc.rect(14, finalY + 15, pageWidth - 28, 30, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Total Abonado:", 20, finalY + 33);
    
    doc.setTextColor(212, 175, 55); // Dorado
    doc.setFontSize(18);
    doc.text(`${formatCurrency(cuota.monto)}`, pageWidth - 20, finalY + 34, { align: "right" });
    
    // Pie de página
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    const footerText = "Gracias por confiar en VINDEX Legal Group. Sello digital certificado por VINDEX Finance.";
    doc.text(footerText, pageWidth / 2, 280, { align: "center" });

    doc.save(`Comprobante_Cuota${idx + 1}_${ingreso.expedienteId.split(' - ')[0]}.pdf`);
  };

  const filteredIngresos = ingresos.filter(ing => 
    ing.expedienteId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeColor = (type) => {
    switch(type) {
      case 'Honorarios Fijos': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Porcentaje de ejecución': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700';
    }
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

  const hoy = new Date().toISOString().slice(0, 10);

  const handleDownloadPDF = (ingreso) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Banner Corporativo
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Textos del Banner
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("VINDEX", 14, 25);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("LEGAL GROUP", 46, 25);
    
    doc.setTextColor(212, 175, 55); // Dorado corporativo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("HOJA DE RUTA FINANCIERA", pageWidth - 14, 25, { align: "right" });
    
    // Reset colores
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    
    // Tres columnas
    doc.text("Cliente / Expediente:", 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(ingreso.expedienteId, 14, 62);
    
    doc.setFont("helvetica", "bold");
    doc.text("Inversión Total:", 105, 55, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(formatCurrency(ingreso.montoTotal), 105, 62, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.text("Tipo / Servicio:", pageWidth - 14, 55, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(`${ingreso.tipo} / ${ingreso.servicio || 'General'}`, pageWidth - 14, 62, { align: "right" });
    
    // Semáforo dinámico
    const tableData = (ingreso.cronograma || []).map(c => {
      let estadoSugerido = 'PENDIENTE';
      if (c.estado === 'Pagado') estadoSugerido = 'PAGADO';
      return [
        c.cuota,
        c.vencimiento,
        formatCurrency(c.monto),
        estadoSugerido
      ];
    });

    let foundNext = false;
    const hoy = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < tableData.length; i++) {
        if (tableData[i][3] === 'PENDIENTE') {
            if (tableData[i][1] < hoy) {
                tableData[i][3] = 'VENCIDO';
            } else if (!foundNext) {
                tableData[i][3] = 'PRÓXIMO';
                foundNext = true;
            }
        }
    }

    autoTable(doc, {
      startY: 75,
      head: [['N°', 'Vencimiento', 'Monto', 'Estado Sugerido']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 3) {
          if (data.cell.raw === 'PAGADO') {
             data.cell.styles.textColor = [21, 128, 61]; 
             data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'VENCIDO') {
             data.cell.styles.textColor = [220, 38, 38]; 
             data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'PRÓXIMO') {
             data.cell.styles.textColor = [180, 83, 9]; 
             data.cell.styles.fontStyle = 'bold';
          } else {
             data.cell.styles.textColor = [100, 116, 139];
          }
        }
      }
    });

    const finalY = doc.lastAutoTable.finalY || 100;
    
    const recaudado = (ingreso.cronograma || []).filter(c => c.estado === 'Pagado').reduce((acc, c) => acc + (Number(String(c.monto).replace(/,/g, '')) || 0), 0);
    const pendiente = ingreso.montoTotal - recaudado;
    
    doc.setFillColor(248, 250, 252);
    doc.rect(14, finalY + 10, pageWidth - 28, 30, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Monto Recaudado:", 20, finalY + 22);
    doc.setTextColor(21, 128, 61);
    doc.text(formatCurrency(recaudado), 70, finalY + 22);
    
    doc.setTextColor(15, 23, 42);
    doc.text("Saldo Pendiente:", 20, finalY + 32);
    doc.setTextColor(180, 83, 9);
    doc.text(formatCurrency(pendiente), 70, finalY + 32);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("Este documento es una proyección financiera en tiempo real, generada por VINDEX Finance.", pageWidth / 2, 280, { align: "center" });

    doc.save(`Hoja_Ruta_${ingreso.expedienteId.replace(/\s+/g, '_')}.pdf`);
  };

  const handleGenerateCrono = () => {
    const isEjecucion = formData.tipo === 'Porcentaje de ejecución';
    
    // Si isEjecucion, usamos autoCrono.total o formData.montoTotalEjecucion
    const safeTotalCrono = String(autoCrono.total).replace(/,/g, '');
    const safeTotalEjecucion = String(formData.montoTotalEjecucion).replace(/,/g, '');
    const t = isEjecucion ? (parseFloat(safeTotalCrono) || parseFloat(safeTotalEjecucion)) : parseFloat(safeTotalCrono);
    const c = parseFloat(String(autoCrono.cuota).replace(/,/g, ''));
    
    if (!t || !c || c <= 0 || t <= 0) return alert("Ingresa valores válidos de Monto Total y Monto de Cuota para fraccionar.");
    
    const globalPct = parseFloat(formData.porcentajeGlobalEjecucion) || 10;
    
    let remainder = t;
    let newCrono = [];
    let count = 1;
    let currentDate = parseISO(autoCrono.inicio);

    while (remainder > 0) {
      const rawCuota = remainder >= c ? c : remainder;
      const montoCuota = Math.round(rawCuota * 100) / 100;
      
      let cuotaObj = {
        cuota: count,
        vencimiento: format(currentDate, 'yyyy-MM-dd'),
        estado: 'Pendiente'
      };

      if (isEjecucion) {
        cuotaObj.montoBase = montoCuota.toFixed(2);
        cuotaObj.porcentaje = globalPct;
        cuotaObj.monto = (Math.round(montoCuota * globalPct) / 100).toFixed(2);
      } else {
        cuotaObj.monto = montoCuota.toFixed(2);
      }

      newCrono.push(cuotaObj);
      remainder -= montoCuota;
      count++;
      
      if (autoCrono.freq === 'Semanal') currentDate = addWeeks(currentDate, 1);
      else if (autoCrono.freq === 'Quincenal') currentDate = addDays(currentDate, 15);
      else if (autoCrono.freq === 'Mensual') currentDate = addMonths(currentDate, 1);
      else if (autoCrono.freq === 'Bimestral') currentDate = addMonths(currentDate, 2);
      else if (autoCrono.freq === 'Trimestral') currentDate = addMonths(currentDate, 3);
      else if (autoCrono.freq === 'Semestral') currentDate = addMonths(currentDate, 6);
      else if (autoCrono.freq === 'Anual') currentDate = addMonths(currentDate, 12);
    }
    setCronograma(newCrono);
  };

  // Removed handleDownloadExcel

  const handleDownloadClientReport = () => {
    if(!reportSelectedClient) return alert("Selecciona un cliente");
    const clientIngresos = ingresos.filter(i => i.expedienteId === reportSelectedClient);
    if(clientIngresos.length === 0) return alert("Este cliente no tiene cuadernos.");

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
    doc.text("INFORME FINANCIERO DE GESTION", pageWidth - 14, 25, { align: "right" });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text(`Cliente Analizado:`, 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(`${reportSelectedClient}`, 55, 55);

    let startY = 65;
    let globalTotal = 0;
    let globalPagado = 0;

    clientIngresos.forEach((ing, idx) => {
       const total = ing.montoTotal || 0;
       const pagado = (ing.cronograma || []).filter(c => c.estado === 'Pagado').reduce((acc, c) => acc + (Number(String(c.monto).replace(/,/g, '')) || 0), 0);
       globalTotal += total;
       globalPagado += pagado;

       doc.setFontSize(11);
       doc.setFont("helvetica", "bold");
       doc.text(`${idx + 1}. Obligación: ${ing.tipo} | Servicio: ${ing.servicio || 'General'}`, 14, startY);
       doc.setFont("helvetica", "normal");
       doc.setFontSize(10);
       doc.text(`Monto: ${formatCurrency(total)}  |  Recaudado: ${formatCurrency(pagado)}  |  Estado: ${ing.estado}`, 14, startY + 6);
       
       const tableData = (ing.cronograma || []).map(c => {
          let estadoParseado = c.estado;
          if(c.estado === 'Pendiente' && c.vencimiento < new Date().toISOString().slice(0, 10)) estadoParseado = 'VENCIDO';
          return [c.cuota, c.vencimiento, formatCurrency(c.monto), estadoParseado];
       });
       
       autoTable(doc, {
         startY: startY + 10,
         head: [['N°', 'Vencimiento', 'Monto', 'Estado']],
         body: tableData,
         theme: 'grid',
         headStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42] },
         margin: { left: 14, right: 14 },
         didParseCell: function(data) {
           if (data.section === 'body' && data.column.index === 3) {
             if (data.cell.raw === 'Pagado') data.cell.styles.textColor = [21, 128, 61]; 
             else if (data.cell.raw === 'VENCIDO') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
             else data.cell.styles.textColor = [100, 116, 139];
           }
         }
       });

       startY = doc.lastAutoTable.finalY + 15;
       if(startY > 250) {
          doc.addPage();
          startY = 20;
       }
    });

    const finalY = startY;
    if (finalY > 230) {
        doc.addPage();
        startY = 20;
    }
    doc.setFillColor(15, 23, 42);
    doc.rect(14, startY, pageWidth - 28, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN GLOBAL DEL CLIENTE", 20, startY + 10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Inversión Total: ${formatCurrency(globalTotal)}   |   Total Abonado: ${formatCurrency(globalPagado)}   |   Saldo Vivo: ${formatCurrency(globalTotal - globalPagado)}`, 20, startY + 18);

    doc.save(`Informe_Cliente_${reportSelectedClient.split(' - ')[0]}.pdf`);
    setIsClientReportModalOpen(false);
  };

  const handleDownloadGlobalReport = () => {
    if(ingresos.length === 0) return alert("No hay ningún cuaderno registrado en el sistema.");

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
    doc.text("REPORTE GLOBAL DE INGRESOS", pageWidth - 14, 25, { align: "right" });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text(`Expedición:`, 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(`${new Date().toLocaleDateString()}`, 40, 55);

    let startY = 65;
    let globalTotal = 0;
    let globalPagado = 0;
    let globalFacturado = 0;
    let globalBaseFacturada = 0;
    let globalIgvFacturado = 0;

    ingresos.forEach((ing, idx) => {
       const total = ing.montoTotal || 0;
       const pagado = (ing.cronograma || []).filter(c => c.estado === 'Pagado').reduce((acc, c) => acc + (Number(String(c.monto).replace(/,/g, '')) || 0), 0);
       const facturados = (ing.cronograma || []).filter(c => c.facturado === true).reduce((acc, c) => acc + (Number(String(c.monto).replace(/,/g, '')) || 0), 0);

       globalTotal += total;
       globalPagado += pagado;
       globalFacturado += facturados;
       
       if (facturados > 0) {
           const rate = ing.igvRate ?? 18;
           globalBaseFacturada += facturados / (1 + (rate/100));
           globalIgvFacturado += facturados - (facturados / (1 + (rate/100)));
       }

       doc.setFontSize(11);
       doc.setFont("helvetica", "bold");
       doc.text(`${idx + 1}. Cuaderno: ${ing.expedienteId}`, 14, startY);
       
       doc.setFont("helvetica", "italic");
       doc.setFontSize(10);
       doc.text(`Obligación: ${ing.tipo} | Servicio: ${ing.servicio || 'General'}`, 14, startY + 5);

       doc.setFont("helvetica", "normal");
       doc.text(`Monto: ${formatCurrency(total)}  |  Recaudado: ${formatCurrency(pagado)}  |  Estado: ${ing.estado}`, 14, startY + 11);
       
       const tableData = (ing.cronograma || []).map(c => {
          let estadoParseado = c.estado;
          if(c.estado === 'Pendiente' && c.vencimiento < new Date().toISOString().slice(0, 10)) estadoParseado = 'VENCIDO';
          return [c.cuota, c.vencimiento, formatCurrency(c.monto), estadoParseado];
       });
       
       if (tableData.length > 0) {
           autoTable(doc, {
             startY: startY + 15,
             head: [['N°', 'Vencimiento', 'Monto', 'Estado']],
             body: tableData,
             theme: 'grid',
             headStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42] },
             margin: { left: 14, right: 14 },
             didParseCell: function(data) {
               if (data.section === 'body' && data.column.index === 3) {
                 if (data.cell.raw === 'Pagado') data.cell.styles.textColor = [21, 128, 61]; 
                 else if (data.cell.raw === 'VENCIDO') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
                 else data.cell.styles.textColor = [100, 116, 139];
               }
             }
           });
           startY = doc.lastAutoTable.finalY + 15;
       } else {
           startY += 20;
       }

       if(startY > 250) {
          doc.addPage();
          startY = 20;
       }
    });

    const finalY = startY;
    if (finalY > 230) {
        doc.addPage();
        startY = 20;
    }
    doc.setFillColor(15, 23, 42);
    doc.rect(14, startY, pageWidth - 28, 55, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN FINANCIERO / FISCAL GLOBAL", 20, startY + 10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Inversión Bruta Total:`, 20, startY + 20); doc.text(formatCurrency(globalTotal), 100, startY + 20);
    doc.text(`Total Recaudado Real (Pagado):`, 20, startY + 28); doc.text(formatCurrency(globalPagado), 100, startY + 28);
    doc.text(`Total Contable (Facturado):`, 20, startY + 36); doc.text(formatCurrency(globalFacturado), 100, startY + 36);
    
    doc.setTextColor(212, 175, 55);
    doc.text(`(-) Base Imponible (Facturada):`, 20, startY + 44); doc.text(formatCurrency(globalBaseFacturada), 100, startY + 44);
    doc.text(`(-) IGV Retenido Histórico:`, 20, startY + 52); doc.text(formatCurrency(globalIgvFacturado), 100, startY + 52);

    doc.save(`Reporte_Global_Ingresos_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-3 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between border-b border-brand-200 dark:border-slate-800 pb-3 shrink-0 gap-4">
        <div>
           <h1 className="text-xl font-black text-brand-900 dark:text-white tracking-tight">Honorarios Fijos</h1>
           <p className="text-brand-600 dark:text-gray-400 font-medium text-xs mt-0.5">Administra honorarios fijos y porcentajes de ejecución vinculados a clientes.</p>
        </div>
        <button 
           onClick={() => setIsModalOpen(true)}
           className="bg-brand-900 hover:bg-brand-800 text-white px-5 py-2 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
        >
          <Plus size={16} /> Nuevo Cuaderno
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 mb-2">
        <div className="relative flex-1 w-full max-w-md">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" size={18} />
           <input 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             placeholder="Buscar por DNI o Cliente..." 
             className="w-full pl-10 pr-4 py-2 rounded-xl border border-brand-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-brand-900 dark:text-white focus:ring-2 focus:ring-brand-500 transition-all font-medium text-sm shadow-sm"
           />
        </div>
        <div className="grid grid-cols-2 lg:flex lg:flex-row justify-end gap-2 w-full text-[10px] md:text-xs">
           <button onClick={() => setMesReporteModalOpen(true)} className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl font-bold uppercase tracking-wider transition-colors shadow-sm w-full">
             <FileText size={14} /> MENSUAL
           </button>
           <button onClick={() => setAnoReporteModalOpen(true)} className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl font-bold uppercase tracking-wider transition-colors shadow-sm w-full">
             <Calendar size={14} /> ANUAL
           </button>
           <button onClick={handleDownloadGlobalReport} className="flex items-center justify-center gap-1.5 bg-brand-900 hover:bg-brand-800 text-white px-3 py-2 rounded-xl font-bold uppercase tracking-wider transition-colors shadow-sm w-full">
             <FileText size={14} /> GLOBAL
           </button>
           <button onClick={() => setIsClientReportModalOpen(true)} className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl font-bold uppercase tracking-wider transition-colors shadow-sm w-full">
             <FileText size={14} /> CLIENTE
           </button>
        </div>
      </div>

      {/* FLOATING ACTION BUTTON PARA ELIMINACIÓN MASIVA */}
      {selectedIds.length > 0 && (
         <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-5">
            <button 
              onClick={handleBulkDelete} 
              className="bg-red-600 hover:bg-red-500 text-white shadow-[0_10px_40px_rgba(220,38,38,0.5)] px-6 py-4 rounded-full font-black tracking-widest uppercase flex items-center gap-3 border-2 border-red-400/50 transition-all hover:scale-105"
            >
               <Trash2 size={20} /> Eliminar {selectedIds.length} Cuadernos
            </button>
         </div>
      )}

      {/* GRID DE TARJETAS PRINCIPAL */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6">
        {filteredIngresos.length === 0 ? (
           <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 border-2 border-dashed border-brand-200 dark:border-slate-800 rounded-3xl transition-colors">
             <AlertCircle size={64} className="mx-auto text-brand-200 dark:text-slate-700 mb-5" />
             <p className="text-brand-900 dark:text-white font-bold text-xl mb-2">Sin registros encontrados</p>
             <p className="text-brand-500 dark:text-slate-400 font-medium text-sm max-w-sm mx-auto">No se encontraron acuerdos de honorarios que coincidan con tu búsqueda actual.</p>
           </div>
        ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
             {filteredIngresos.map((ingreso) => {
                const isExpanded = expandedRow === ingreso.id;
                return (
                   <div key={ingreso.id} className={`relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border ${selectedIds.includes(ingreso.id) ? 'border-red-400 shadow-md transform scale-[1.01]' : 'border-brand-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-slate-700 hover:shadow-md'} shadow-sm transition-all duration-300 rounded-3xl flex flex-col overflow-hidden group`}>
                      
                      {/* CHECKBOX FLOTANTE RÁPIDO */}
                      <div className="absolute top-4 left-4 z-10 w-6 h-6">
                        <input 
                           type="checkbox" 
                           checked={selectedIds.includes(ingreso.id)} 
                           onChange={() => toggleSelection(ingreso.id)} 
                           className="w-5 h-5 rounded border-2 border-brand-300 text-red-500 focus:ring-red-500/20 bg-white cursor-pointer shadow-sm transition-all"
                        />
                      </div>

                      {/* Cabecera Tarjeta */}
                      <div className="p-5 pl-12 pb-4 border-b border-brand-50 dark:border-slate-800/50 flex justify-between items-start gap-4">
                         <div className="flex-1">
                           <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border rounded-md whitespace-nowrap mb-2 ${getTypeColor(ingreso.tipo)}`}>
                             {ingreso.tipo === 'Porcentaje de ejecución' ? 'Ejecución' : 'Honorario Fijo'}
                           </span>
                           <h3 className="font-black text-lg text-brand-900 dark:text-white leading-tight break-words">{ingreso.expedienteId}</h3>
                         </div>
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                           <button onClick={() => handleEdit(ingreso)} className="p-1.5 text-brand-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"><Edit3 size={16}/></button>
                           <button onClick={() => handleDelete(ingreso.id)} className="p-1.5 text-brand-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"><Trash2 size={16}/></button>
                         </div>
                      </div>

                      {/* Cuerpo Tarjeta */}
                      <div className="p-5 flex-1 flex flex-col gap-4">
                         <div className="flex flex-wrap items-end justify-between gap-y-2">
                            <div>
                               <p className="text-[10px] text-brand-500 font-bold uppercase tracking-widest mb-1">Monto Total</p>
                               <div className="font-black text-2xl text-brand-900 dark:text-white tracking-tight">
                                 {formatCurrency(ingreso.montoTotal)}
                               </div>
                               {ingreso.tipo === 'Porcentaje de ejecución' && ingreso.montoTotalEjecucion > 0 && (
                                 <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 mt-1">Base: {formatCurrency(ingreso.montoTotalEjecucion)}</div>
                               )}
                            </div>
                            <div className="text-right">
                               <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm border ${
                                 ingreso.estado === 'Pagado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                                 ingreso.estado === 'Parcial' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' :
                                 ingreso.estado === 'Por Definir' ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' :
                                 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                               }`}>
                                 {ingreso.estado === 'Pagado' && <CheckCircle size={12}/>}
                                 {ingreso.estado === 'Parcial' && <Clock size={12}/>}
                                 {ingreso.estado === 'Pendiente' && <AlertCircle size={12}/>}
                                 {ingreso.estado === 'Por Definir' && <Calendar size={12}/>}
                                 {ingreso.estado}
                               </span>
                            </div>
                         </div>
                         
                         <div className="flex items-center gap-2 text-[10px] font-bold text-brand-500 dark:text-slate-400 bg-brand-50 dark:bg-slate-800/50 p-3 rounded-xl border border-brand-100 dark:border-slate-700/50">
                           <Calendar size={14} className="text-brand-400" /> 
                           <span>{(ingreso.cronograma || []).length} Cuotas programadas</span>
                         </div>
                      </div>

                                            {/* Pie Tarjeta / Acciones */}
                      <div className="p-4 pt-0 mt-auto border-t border-brand-50 dark:border-slate-800/50 pt-4">
                        <button 
                          onClick={() => setExpandedRow(ingreso.id)}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          Ver Cuotas Programadas
                        </button>
                      </div>
                   </div>
                );
             })}
           </div>
        )}

        {/* MODAL DE CUOTAS */}
        {expandedRow && (() => {
          const ingreso = filteredIngresos.find(i => i.id === expandedRow);
              if (!ingreso) return null;
              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                   <div className="bg-white dark:bg-slate-950 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-brand-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                      
                      {/* Cabecera del Modal */}
                      <div className="bg-brand-900 dark:bg-brand-800 px-6 py-5 flex items-center justify-between shrink-0">
                         <div>
                           <h3 className="text-white font-black text-lg flex items-center gap-2">{ingreso.expedienteId}</h3>
                           <p className="text-brand-200 text-xs font-medium mt-0.5">Gestión de Cuotas y Acuerdos de Pago</p>
                         </div>
                         <button onClick={() => setExpandedRow(null)} className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-xl">
                           <X size={20} />
                         </button>
                      </div>

                      {/* Cuerpo del Modal (Cuotas) */}
                      <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-900/50 flex-1">
                         <div className="flex justify-between items-center mb-6">
                           <h4 className="text-sm font-black text-brand-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                             <Calendar size={18} className="text-brand-500" />
                             Cronograma de Pagos
                           </h4>
                           {(ingreso.cronograma || []).length > 0 && (
                             <button onClick={() => handleDownloadPDF(ingreso)} className="flex items-center gap-2 bg-brand-100 hover:bg-brand-200 text-brand-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm">
                               <Download size={14} /> Descargar PDF Global
                             </button>
                           )}
                         </div>
                         
                         {(!ingreso.cronograma || ingreso.cronograma.length === 0) ? (
                           <div className="text-center py-12 border-2 text-brand-500 border-dashed border-brand-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                              <Calendar size={48} className="mx-auto text-brand-200 dark:text-slate-800 mb-4" />
                              <p className="text-sm font-bold text-brand-900 dark:text-white mb-1">Sin cronograma definido.</p>
                              <p className="text-xs text-brand-400">Cierra esta ventana y edita el cuaderno para generarle las cuotas correspondientes.</p>
                           </div>
                         ) : (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {ingreso.cronograma.map((cuota, idx) => {
                               const hoy = new Date().toISOString().slice(0, 10);
                               const isOverdue = cuota.vencimiento < hoy && cuota.estado === 'Pendiente';

                               return (
                                 <div key={idx} className={`flex flex-col gap-4 p-5 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md ${
                                   cuota.estado === 'Pagado' ? 'border-emerald-200 dark:border-emerald-900/50' : 
                                   isOverdue ? 'border-red-300 dark:border-red-900/50' : 'border-brand-200 dark:border-slate-700'
                                 }`}>
                                   
                                   {/* Fila superior cuota */}
                                   <div className="flex items-start justify-between">
                                     <div className="flex items-center gap-3">
                                       <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-black text-sm ${
                                         cuota.estado === 'Pagado' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                         isOverdue ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                                         'bg-brand-50 text-brand-900 dark:bg-slate-800 dark:text-white'
                                       }`}>
                                         #{cuota.cuota}
                                       </div>
                                       <div>
                                         <div className="font-black text-brand-900 dark:text-white text-xl tracking-tight">
                                           {formatCurrency(cuota.monto)}
                                         </div>
                                         {(() => {
                                            const mC = Number(String(cuota.monto).replace(/,/g, '')) || 0;
                                            const rate = ingreso.igvRate ?? 18;
                                            const igvPart = mC - (mC / (1 + (rate/100)));
                                            return mC > 0 ? (
                                               <div className="text-[10px] font-bold text-indigo-500/80 dark:text-indigo-400/90 leading-tight">
                                                 Incluye IGV ({rate}%): {formatCurrency(igvPart)}
                                               </div>
                                            ) : null;
                                         })()}
                                         <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold mt-1.5">
                                           <div className="flex items-center gap-1">
                                             <Calendar size={12} className={isOverdue ? "text-red-500" : "text-brand-500"}/>
                                             <span className={isOverdue ? "text-red-600" : "text-brand-600 dark:text-slate-400"}>Vence: {cuota.vencimiento}</span>
                                           </div>
                                           {cuota.estado === 'Pagado' && cuota.fechaPago && (
                                              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 rounded-md dark:border-emerald-800 dark:bg-emerald-900/30">
                                                <CheckCircle size={10}/> Pago: {cuota.fechaPago}
                                              </div>
                                           )}
                                         </div>
                                       </div>
                                     </div>
                                     <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border text-center ${
                                       cuota.estado === 'Pagado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                                       isOverdue ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' :
                                       'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                     }`}>
                                       {isOverdue && cuota.estado === 'Pendiente' ? 'Vencido' : cuota.estado}
                                     </span>
                                   </div>
                                   
                                   {/* Acciones de cuota */}
                                   <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                   {cuota.estado !== 'Pagado' ? (
                                     <div className="flex items-center gap-2">
                                       {isOverdue && typeof handleWhatsAppReminder !== 'undefined' && (
                                         <button onClick={() => handleWhatsAppReminder(ingreso, cuota)} className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center items-center gap-1 shadow-sm" title="Enviar recordatorio por WhatsApp">
                                           <MessageCircle size={14} /> Recordar
                                         </button>
                                       )}
                                       <button onClick={() => handleUpdateCuotaStatus(ingreso, idx, 'Pagado')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center items-center gap-1 shadow-sm">
                                         <CheckCircle size={14} /> Marcar Pagado
                                       </button>
                                     </div>
                                   ) : (
                                     <div className="flex flex-col gap-2">
                                       <div className="flex items-center gap-2">
                                         <button onClick={() => handleDownloadComprobante(ingreso, cuota, idx)} className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center items-center gap-1 shadow-sm" title="Descargar Comprobante de Pago">
                                           <FileText size={14} /> Comprobante
                                         </button>
                                         <button onClick={() => handleUpdateCuotaStatus(ingreso, idx, 'Pendiente')} className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors">
                                           Revertir
                                         </button>
                                       </div>
                                       <button 
                                          onClick={() => handleOpenFacturaModalFijos(ingreso, cuota, idx)} 
                                          className={`w-full py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center items-center gap-1 shadow-sm ${
                                             cuota.facturado ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                          }`}
                                       >
                                         <CheckCircle size={14} /> {cuota.facturado ? `Facturado el ${cuota.fechaFacturacion} (Revertir)` : 'Marcar como Facturado'}
                                       </button>
                                     </div>
                                   )}
                                   </div>
                                 </div>
                               )
                             })}
                           </div>
                         )}
                      </div>
                      
                      {/* Footer Modal */}
                      <div className="bg-white dark:bg-slate-950 p-4 border-t border-brand-200 dark:border-slate-800 text-center shrink-0">
                         <button onClick={() => setExpandedRow(null)} className="text-xs font-bold uppercase tracking-widest text-brand-600 hover:text-brand-900 dark:text-slate-400 dark:hover:text-white transition-colors py-2 px-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800">
                           Cerrar
                         </button>
                      </div>

                   </div>
                </div>
              )
           })()}
      </div>

      {/* MODAL DE CREACIÓN / EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white dark:bg-slate-950 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col border border-brand-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
              <div className="bg-brand-50 dark:bg-slate-900 border-b border-brand-200 dark:border-slate-800 px-6 py-5 flex items-center justify-between shrink-0">
                 <h3 className="text-lg font-black text-brand-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
                   {editingId ? 'Editar Cuaderno' : 'Nuevo Cuaderno'}
                 </h3>
              </div>
              
              <div className="overflow-y-auto custom-scrollbar p-6">
                <form id="ingresoForm" onSubmit={handleCreate} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest">Cliente <span className="text-red-500">*</span></label>
                          <button type="button" onClick={() => { setIsModalOpen(false); navigate('/crm'); }} className="flex items-center gap-1.5 bg-brand-100 hover:bg-brand-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-brand-700 dark:text-slate-300 px-3 py-1 rounded-lg transition-colors font-bold text-[10px] uppercase tracking-wider shadow-sm" title="Ir al directorio y crear cliente">
                            <Plus size={14}/> Nuevo Cliente
                          </button>
                        </div>
                        <input 
                          required 
                          autoFocus
                          list="clientes-list"
                          value={formData.expedienteId} 
                          onChange={e => setFormData({...formData, expedienteId: e.target.value})} 
                          placeholder="Buscar cliente..."
                          className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium text-brand-900 dark:text-white bg-white dark:bg-slate-900" 
                        />
                        <datalist id="clientes-list">
                          {clientes.map(c => <option key={c.id} value={`${c.documento} - ${c.nombre}`} />)}
                        </datalist>
                    </div>
                    <div className="md:col-span-2">
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest">Servicio / Categoría <span className="text-red-500">*</span></label>
                          <button type="button" onClick={() => setIsServicioModalOpen(true)} className="flex items-center gap-1.5 bg-brand-100 hover:bg-brand-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-brand-700 dark:text-slate-300 px-3 py-1 rounded-lg transition-colors font-bold text-[10px] uppercase tracking-wider shadow-sm" title="Crear Nuevo Servicio">
                            <Plus size={14}/> Nuevo Servicio
                          </button>
                        </div>
                        <input 
                          required 
                          list="servicios-list"
                          type="text"
                          value={formData.servicio} 
                          onChange={e => setFormData({...formData, servicio: e.target.value})} 
                          placeholder="Ej: Trámite Administrativo"
                          className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-bold text-brand-900 dark:text-white bg-white dark:bg-slate-900" 
                        />
                        <datalist id="servicios-list">
                          {servicios.map(s => <option key={s.id} value={s.nombre} />)}
                        </datalist>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest">Descripción</label>
                        </div>
                        <textarea 
                          rows={2}
                          value={formData.descripcion} 
                          onChange={e => setFormData({...formData, descripcion: e.target.value})} 
                          placeholder="Detalles del alcance (Opcional)"
                          className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium text-brand-900 dark:text-white bg-white dark:bg-slate-900 resize-none h-[46px]" 
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Tipo de Honorario <span className="text-red-500">*</span></label>
                        <select 
                          required 
                          value={formData.tipo} 
                          onChange={e => setFormData({...formData, tipo: e.target.value})} 
                          className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-bold text-brand-900 dark:text-white bg-white dark:bg-slate-900 appearance-none" 
                        >
                          <option>Honorarios Fijos</option>
                          <option>Porcentaje de ejecución</option>
                        </select>
                    </div>
                  </div>

                  {/* CLIENT PREVIEW CARD */}
                  {selectedClientPreview && (
                    <div className="bg-gradient-to-br from-brand-50 to-white dark:from-slate-800 dark:to-slate-900 border border-brand-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                       <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest mb-1">Previsualización de Cliente</span>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-8 h-8 rounded-full bg-brand-200 dark:bg-slate-700 flex items-center justify-center text-brand-800 dark:text-brand-300 font-bold text-sm">
                          {selectedClientPreview.nombre.charAt(0).toUpperCase()}
                        </span>
                        <div>
                           <h4 className="text-sm font-black text-brand-900 dark:text-white leading-tight">{selectedClientPreview.nombre}</h4>
                           <p className="text-xs font-medium text-brand-600 dark:text-gray-400">DNI/RUC: {selectedClientPreview.documento}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                         <div className="bg-white dark:bg-slate-950 px-3 py-2 rounded-lg border border-brand-100 dark:border-slate-800">
                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Celular / Teléfono</span>
                            <span className="font-bold text-brand-700 dark:text-gray-300">{selectedClientPreview.telefono || 'No registrado'}</span>
                         </div>
                         <div className="bg-white dark:bg-slate-950 px-3 py-2 rounded-lg border border-brand-100 dark:border-slate-800 overflow-hidden">
                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Correo</span>
                            <span className="font-bold text-brand-700 dark:text-gray-300 truncate block text-ellipsis">{selectedClientPreview.correo || 'No registrado'}</span>
                         </div>
                         <div className="col-span-2 bg-white dark:bg-slate-950 px-3 py-2 rounded-lg border border-brand-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Contraparte Asignada</span>
                              <span className="font-bold text-brand-700 dark:text-gray-300">{selectedClientPreview.contraparte || 'No asignada'}</span>
                            </div>
                            <div className="w-6 h-6 rounded-full bg-brand-50 dark:bg-slate-800 flex items-center justify-center">
                              <CheckCircle size={10} className="text-brand-500" />
                            </div>
                         </div>
                      </div>
                    </div>
                  )}

                  {/* NUEVA LOGICA: PORCENTAJE DE EJECUCION GLOBALS */}
                  {formData.tipo === 'Porcentaje de ejecución' && (
                    <div className="bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900/50 rounded-2xl p-5">
                      <h4 className="text-sm font-black text-brand-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                        <DollarSign size={16} className="text-purple-500"/>
                        Monto Global de la Ejecución
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 md:col-span-1">
                          <label className="block text-[10px] font-bold text-brand-600 dark:text-purple-400 uppercase tracking-widest mb-1.5 flex justify-between">
                            <span>Total Adeudado a Cliente</span>
                            <span className="font-medium opacity-60">Opcional</span>
                          </label>
                          <input 
                            type="text" 
                            value={formData.montoTotalEjecucion} 
                            onChange={e => setFormData({...formData, montoTotalEjecucion: formatNumberInput(e.target.value)})} 
                            placeholder="Ej: 70,000.00" 
                            className="w-full border border-purple-200 dark:border-purple-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 transition-all font-bold dark:bg-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                           <label className="block text-[10px] font-bold text-brand-600 dark:text-purple-400 uppercase tracking-widest mb-1.5 flex justify-between">
                            <span>Nuestra Porción Global (%)</span>
                          </label>
                          <input 
                            type="number" 
                            step="0.01" 
                            min="0" 
                            max="100"
                            value={formData.porcentajeGlobalEjecucion} 
                            onChange={e => setFormData({...formData, porcentajeGlobalEjecucion: e.target.value})} 
                            placeholder="Ej: 10" 
                            className="w-full border border-purple-200 dark:border-purple-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 transition-all font-bold dark:bg-slate-900 dark:text-white text-center"
                          />
                        </div>
                        <div className="col-span-2">
                           <p className="text-[10px] text-brand-600 dark:text-gray-400 leading-relaxed">Si desconoces la cifra total, puedes dejarlo en blanco y guardar el cuadernos sin cuotas. Abajo en las cuotas (o usando el generador) podrás desglosar las fracciones que se te paguen.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AUTO GENERADOR (OCULTO PARA PORCENTAJE DE EJECUCIÓN COMO FUE SOLICITADO) */}
                  {formData.tipo !== 'Porcentaje de ejecución' && (
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/50 border rounded-2xl p-5">
                      <h4 className="text-sm font-black text-brand-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Calendar size={16} className="text-blue-500"/>
                        Generador Automático de Cuotas
                      </h4>
                      <p className="text-[10px] text-brand-500 mb-3 leading-relaxed">Utiliza esto si deseas que el sistema genere múltiples fechas de cobro automáticamente.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <div>
                          <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Monto Total</label>
                          <input type="text" value={autoCrono.total} onChange={e => setAutoCrono({...autoCrono, total: formatNumberInput(e.target.value)})} placeholder="Ej: 1,500.00" className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 font-bold dark:bg-slate-900 dark:text-white"/>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Monto de Cuota</label>
                          <input type="text" value={autoCrono.cuota} onChange={e => setAutoCrono({...autoCrono, cuota: formatNumberInput(e.target.value)})} placeholder="Ej: 200.00" className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 font-bold dark:bg-slate-900 dark:text-white"/>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Frecuencia</label>
                          <select value={autoCrono.freq} onChange={e => setAutoCrono({...autoCrono, freq: e.target.value})} className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 font-bold dark:bg-slate-900 dark:text-white appearance-none">
                            <option>Semanal</option>
                            <option>Quincenal</option>
                            <option>Mensual</option>
                            <option>Bimestral</option>
                            <option>Trimestral</option>
                            <option>Semestral</option>
                            <option>Anual</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Inicio Pago</label>
                          <input type="date" value={autoCrono.inicio} onChange={e => setAutoCrono({...autoCrono, inicio: e.target.value})} className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 font-bold dark:bg-slate-900 dark:text-white"/>
                        </div>
                      </div>
                      <button type="button" onClick={handleGenerateCrono} className="w-full bg-brand-100 text-brand-800 hover:bg-brand-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 py-2 rounded-xl font-bold transition-all text-xs uppercase tracking-wider shadow-sm">
                        Generar Cronograma Automático
                      </button>
                    </div>
                  )}

                  {/* SECCIÓN CRONOGRAMA */}
                  <div className="bg-brand-50/50 dark:bg-slate-900/50 border border-brand-200 dark:border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-brand-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                          <Calendar size={16} className="text-brand-500"/>
                          Detalle de Cuotas
                        </h4>
                        <span className="bg-white dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold rounded-md border border-brand-200 dark:border-slate-700 shadow-sm">{cronograma.length} cuotas</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedCuotasToRemove.length > 0 && (
                          <button 
                            type="button" 
                            onClick={() => {
                              const remaining = cronograma.filter((c, i) => !selectedCuotasToRemove.includes(i));
                              const renumbered = remaining.map((c, i) => ({...c, cuota: i + 1}));
                              setCronograma(renumbered);
                              setSelectedCuotasToRemove([]);
                            }}
                            className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 dark:border-red-900 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                          >
                            Eliminar ({selectedCuotasToRemove.length})
                          </button>
                        )}
                        {cronograma.length > 0 && (
                          <button 
                            type="button" 
                            onClick={emptyCronograma}
                            className="bg-white text-red-500 hover:bg-red-50 hover:border-red-200 border border-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                          >
                            Limpiar Todo
                          </button>
                        )}
                        <button 
                          type="button" 
                          onClick={addCuotaField}
                          className="bg-brand-200 text-brand-800 hover:bg-brand-300 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                        >
                          + Agregar Cuota
                        </button>
                      </div>
                    </div>

                    {cronograma.length === 0 ? (
                       <div className="text-center py-8">
                          <p className="text-sm font-bold text-brand-500">Sin cronograma de pagos.</p>
                          <p className="text-xs text-brand-400 mt-1 max-w-sm mx-auto">Puedes guardar el cuaderno solo con el Monto Global y definir las cuotas posteriormente en "Editar".</p>
                       </div>
                    ) : (
                      <div className="space-y-3">
                        {cronograma.map((c, index) => (
                          <div key={index} className="flex flex-col xl:flex-row items-start xl:items-center gap-3 w-full bg-slate-50 dark:bg-slate-800/30 xl:bg-transparent p-4 xl:p-0 rounded-2xl border border-brand-100 dark:border-slate-800 xl:border-none">
                            <div className="flex items-center justify-between w-full xl:w-auto mb-1 xl:mb-0">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500 shrink-0 cursor-pointer mr-3"
                                checked={selectedCuotasToRemove.includes(index)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedCuotasToRemove([...selectedCuotasToRemove, index]);
                                  else setSelectedCuotasToRemove(selectedCuotasToRemove.filter(i => i !== index));
                                }}
                              />
                              <div className="w-8 h-8 shrink-0 rounded-full bg-brand-900 text-white flex items-center justify-center font-black text-xs">
                                {index + 1}
                              </div>
                              <div className="flex xl:hidden items-center gap-1">
                                <button type="button" onClick={() => duplicateCuotaField(index)} className="p-2 rounded-lg transition-colors border text-brand-600 border-brand-200 hover:bg-brand-50 hover:border-brand-300 dark:text-brand-400 dark:border-slate-700 dark:hover:bg-slate-800"><Copy size={16}/></button>
                                <button type="button" onClick={() => deleteCuotaField(index)} className="p-2 rounded-lg transition-colors border text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 dark:border-red-900/30 dark:hover:bg-red-900/20"><Trash2 size={16}/></button>
                              </div>
                            </div>
                            <div className={`grid gap-3 w-full flex-1 ${formData.tipo === 'Porcentaje de ejecución' ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'}`}>
                            {formData.tipo === 'Porcentaje de ejecución' && (
                              <>
                                <div className="w-full" title="Abono recibido por el cliente en este momento">
                                  <label className="block text-[8px] font-bold text-brand-500 uppercase tracking-widest mb-1 ml-1 leading-tight h-6 flex items-end">Abono Cliente</label>
                                  <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" size={14}/>
                                    <input 
                                      required 
                                      type="text"
                                      placeholder="Ej: 2,000.00"
                                      value={c.montoBase !== undefined ? c.montoBase : ''}
                                      onChange={(e) => {
                                        const newCrono = [...cronograma];
                                        const mBase = formatNumberInput(e.target.value);
                                        newCrono[index].montoBase = mBase;
                                        const numericBase = Number(String(mBase).replace(/,/g, '')) || 0;
                                        const pct = newCrono[index].porcentaje || parseFloat(String(formData.porcentajeGlobalEjecucion).replace(/,/g, '')) || 10;
                                        newCrono[index].porcentaje = pct;
                                        // Update the formatted output calculation implicitly skipping commas visually
                                        newCrono[index].monto = formatNumberInput(((numericBase * (Number(String(pct).replace(/,/g, '')) || 0)) / 100).toFixed(2));
                                        setCronograma(newCrono);
                                      }}
                                      className="w-full border border-brand-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold bg-white dark:bg-slate-900 dark:text-gray-200"
                                    />
                                  </div>
                                </div>
                                <div className="w-full" title="Porcentaje del estudio (%)">
                                  <label className="block text-[8px] font-bold text-brand-500 uppercase tracking-widest mb-1 ml-1 text-center leading-tight h-6 flex items-end justify-center">%</label>
                                  <input 
                                    required 
                                    type="text"
                                    placeholder="%"
                                    value={c.porcentaje !== undefined ? c.porcentaje : (formData.porcentajeGlobalEjecucion || 10)}
                                    onChange={(e) => {
                                      const newCrono = [...cronograma];
                                      const pct = formatNumberInput(e.target.value);
                                      newCrono[index].porcentaje = pct;
                                      const numericBase = Number(String(newCrono[index].montoBase).replace(/,/g, '')) || 0;
                                      newCrono[index].monto = formatNumberInput(((numericBase * (Number(String(pct).replace(/,/g, '')) || 0)) / 100).toFixed(2));
                                      setCronograma(newCrono);
                                    }}
                                    className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-2 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold bg-gray-50 dark:bg-slate-800 dark:text-white text-center"
                                  />
                                </div>
                              </>
                            )}
                            <div className="w-full">
                              <label className="block text-[8px] font-bold text-brand-500 uppercase tracking-widest mb-1 ml-1 leading-tight h-6 flex items-end">
                                {formData.tipo === 'Porcentaje de ejecución' ? 'Nuestra Cuota' : 'Monto de Cuota'}
                              </label>
                              <div className="relative">
                                {formData.tipo !== 'Porcentaje de ejecución' && <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" size={14}/>}
                                <input 
                                  required 
                                  type="text"
                                  placeholder={formData.tipo === 'Porcentaje de ejecución' ? "Cálculo" : "Ej: 1,200.50"}
                                  readOnly={formData.tipo === 'Porcentaje de ejecución'}
                                  value={c.monto}
                                  onChange={(e) => {
                                    if (formData.tipo !== 'Porcentaje de ejecución') {
                                      const newCrono = [...cronograma];
                                      newCrono[index].monto = formatNumberInput(e.target.value);
                                      setCronograma(newCrono);
                                    }
                                  }}
                                  className={`w-full border border-brand-200 dark:border-slate-700 rounded-xl ${formData.tipo !== 'Porcentaje de ejecución' ? 'pl-9' : 'px-4'} pr-4 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold ${formData.tipo === 'Porcentaje de ejecución' ? 'bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100 border-purple-300 dark:border-purple-800 select-none' : 'bg-white dark:bg-slate-950 dark:text-white'}`}
                                />
                              </div>
                            </div>
                            <div className="w-full">
                              <label className="block text-[8px] font-bold text-brand-500 uppercase tracking-widest mb-1 ml-1 leading-tight h-6 flex items-end">Fecha de Cobro</label>
                              <input 
                                required 
                                type="date"
                                value={c.vencimiento}
                                onChange={(e) => {
                                  const newCrono = [...cronograma];
                                  newCrono[index].vencimiento = e.target.value;
                                  setCronograma(newCrono);
                                }}
                                className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold bg-white dark:bg-slate-950 dark:text-white"
                              />
                            </div>
                            </div>
                            <div className="self-end pb-1 ml-2 hidden xl:flex items-center gap-1 shrink-0">
                              <button 
                                type="button"
                                onClick={() => duplicateCuotaField(index)}
                                title="Duplicar esta cuota"
                                className="p-2 rounded-lg transition-colors border text-brand-600 border-brand-200 hover:bg-brand-50 hover:border-brand-300 dark:text-brand-400 dark:border-slate-700 dark:hover:bg-slate-800"
                              >
                                <Copy size={16}/>
                              </button>
                              <button 
                                type="button"
                                onClick={() => removeCuotaField(index)}
                                title="Eliminar esta cuota"
                                className="p-2 rounded-lg transition-colors border text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 dark:text-red-400 dark:border-slate-700 dark:hover:bg-slate-800"
                              >
                                <Trash2 size={16}/>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-brand-900 text-white rounded-2xl p-4 flex flex-col md:flex-row justify-between md:items-center shadow-lg gap-2 mt-4">
                     <span className="text-xs font-black uppercase tracking-widest opacity-80">Monto Total a Cobrar</span>
                     <span className="text-xl md:text-xl font-black">{formatCurrency(cronograma.reduce((acc, c) => acc + (Number(String(c.monto).replace(/,/g, '')) || 0), 0))}</span>
                  </div>

                  {/* BREAKDOWN IGV EDITABLE EN HONORARIOS FIJOS */}
                  {(() => {
                    const mTotal = cronograma.reduce((acc, c) => acc + (Number(String(c.monto).replace(/,/g, '')) || 0), 0);
                    if (mTotal <= 0) return null;
                    const igvR = formData.igvRate ?? 18;
                    const baseImp = mTotal / (1 + (igvR/100));
                    const calcIgv = mTotal - baseImp;
                    return (
                        <div className="mt-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                           <div className="flex items-center justify-between mb-3 pb-3 border-b border-indigo-100/50 dark:border-indigo-800/30">
                             <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                               <Calculator size={14} /> Análisis de Retención Fiscal (IGV)
                             </span>
                             {isEditingIgv ? (
                                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded px-1.5 py-0.5 border border-indigo-300 dark:border-indigo-600 shadow-sm">
                                   <input 
                                     autoFocus
                                     type="number" 
                                     value={formData.igvRate ?? 18}
                                     onChange={handleIgvChange}
                                     onBlur={() => setIsEditingIgv(false)}
                                     onKeyDown={(e) => e.key === 'Enter' && setIsEditingIgv(false)}
                                     className="w-12 h-7 text-sm text-center focus:outline-none font-black bg-transparent text-indigo-900 dark:text-indigo-300"
                                     step="1" min="0" max="100"
                                   />
                                   <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 pr-1">%</span>
                                </div>
                             ) : (
                                <button 
                                  type="button" 
                                  onClick={() => setIsEditingIgv(true)}
                                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 px-3 py-1 rounded shadow-sm transition-colors"
                                >
                                   Tasa: {formData.igvRate ?? 18}% <Edit2 size={12} />
                                </button>
                             )}
                           </div>
                           
                           <div className="grid grid-cols-2 gap-4">
                               <div className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-indigo-50 dark:border-indigo-900/30 flex justify-between items-center text-sm shadow-sm">
                                  <span className="text-slate-500 font-semibold dark:text-slate-400 text-xs">Base Imponible Neta:</span>
                                  <span className="font-black text-indigo-900 dark:text-indigo-300">
                                     S/ {formatCurrency(baseImp)}
                                  </span>
                               </div>
                               <div className="bg-indigo-600 dark:bg-indigo-500/20 p-3 rounded-lg border border-indigo-700 dark:border-indigo-500/50 flex justify-between items-center text-sm shadow-sm text-white dark:text-indigo-200">
                                  <span className="opacity-90 font-semibold text-xs">Impuesto (IGV):</span>
                                  <span className="font-black">
                                     S/ {formatCurrency(calcIgv)}
                                  </span>
                               </div>
                           </div>
                        </div>
                    );
                  })()}

                </form>
              </div>

              <div className="bg-brand-50 dark:bg-slate-900 border-t border-brand-200 dark:border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
                  <button type="button" onClick={handleCloseModal} className="w-full sm:w-auto px-5 py-2.5 text-brand-600 dark:text-gray-400 font-bold text-xs uppercase cursor-pointer hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors tracking-wide border border-transparent shadow-sm">Cancelar</button>
                  <button form="ingresoForm" type="submit" className="w-full sm:w-auto bg-brand-900 hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500 text-white px-6 py-2 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide">
                    {editingId ? 'Guardar Cambios' : 'Guardar Nuevo'}
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL INFORME CLIENTE */}
      {isClientReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-brand-200 dark:border-slate-800 flex flex-col">
              <div className="bg-brand-900 px-6 py-5 flex items-center justify-between shrink-0">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  <FileText size={20} className="text-brand-300" /> Reporte de Cliente
                </h3>
                <button onClick={() => setIsClientReportModalOpen(false)} className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 line-clamp-none max-h-[80vh] overflow-y-auto">
                 <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2">Selecciona un Cliente</label>
                 <select 
                   value={reportSelectedClient} 
                   onChange={(e) => setReportSelectedClient(e.target.value)}
                   className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 font-bold bg-white dark:bg-slate-900 dark:text-white"
                 >
                    <option value="">-- Buscar y seleccionar cliente --</option>
                    {[...new Set(ingresos.map(i => i.expedienteId))].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                 </select>
                 <button 
                   onClick={handleDownloadClientReport}
                   className="w-full mt-6 bg-brand-900 hover:bg-brand-800 text-white py-2 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors shadow-md flex justify-center items-center gap-2"
                 >
                   <FileText size={18}/> Generar Informe PDF
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL REPORTE ANUAL FIJOS */}
      {anoReporteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-brand-200 dark:border-slate-800 flex flex-col">
              <div className="bg-emerald-600 px-6 py-5 flex items-center justify-between shrink-0">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  <Calendar size={20} className="text-emerald-200" /> Reporte Anual
                </h3>
                <button onClick={() => setAnoReporteModalOpen(false)} className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                 <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2">Selecciona el Año</label>
                 <select 
                   value={anoReporteSeleccionado} 
                   onChange={(e) => setAnoReporteSeleccionado(e.target.value)}
                   className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 font-bold bg-white dark:bg-slate-900 dark:text-white mb-6"
                 >
                   {Array.from({length: 10}, (_, i) => {
                     const year = new Date().getFullYear() - i;
                     return <option key={year} value={year}>{year}</option>;
                   })}
                 </select>
                 <button 
                   onClick={handleDownloadReporteAnualFijos}
                   className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors shadow-md flex justify-center items-center gap-2"
                 >
                   <Download size={18}/> Descargar Reporte Anual
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL REPORTE MENSUAL FIJOS */}
      {mesReporteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-brand-200 dark:border-slate-800 flex flex-col">
              <div className="bg-brand-900 px-6 py-5 flex items-center justify-between shrink-0">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  <FileText size={20} className="text-brand-300" /> Reporte Mensual
                </h3>
                <button onClick={() => setMesReporteModalOpen(false)} className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                 <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2">Selecciona el Mes y Año</label>
                 <input 
                   type="month" 
                   value={mesReporteSeleccionado} 
                   onChange={(e) => setMesReporteSeleccionado(e.target.value)}
                   className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 font-bold bg-white dark:bg-slate-900 dark:text-white mb-6"
                 />
                 <button 
                   onClick={handleDownloadReporteMensualFijos}
                   className="w-full bg-brand-900 hover:bg-brand-800 text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors shadow-md flex justify-center items-center gap-2"
                 >
                   <Download size={18}/> Descargar PDF
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* CONFIRMAR FECHA DE FACTURACIÓN */}
      {facturaModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-brand-200 dark:border-slate-800 transform transition-all scale-100">
            <div className="bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-900/50 p-6 text-center">
              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border-4 border-amber-50 dark:border-amber-900/30">
                <CheckCircle className="text-amber-500" size={32} />
              </div>
              <h3 className="text-xl font-black text-amber-900 dark:text-amber-500 tracking-tight">Confirmar Facturación</h3>
              <p className="text-amber-700 dark:text-amber-400 text-sm font-medium mt-1">Ingresa la fecha de emisión del comprobante.</p>
            </div>
            
            <form onSubmit={handleConfirmFacturaFijos} className="p-6 pb-8">
               <div className="space-y-2">
                 <label className="block text-xs font-bold text-brand-600 dark:text-slate-400 uppercase tracking-wider">Fecha en Factura / Boleta</label>
                 <input 
                   type="date" 
                   required
                   value={fechaFactura}
                   onChange={(e) => setFechaFactura(e.target.value)}
                   className="w-full text-center border-2 border-brand-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-lg focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-black text-brand-900 dark:text-white bg-slate-50 dark:bg-slate-950" 
                 />
               </div>
               
               <div className="mt-8 flex items-center gap-3">
                 <button type="button" onClick={() => setFacturaModalOpen(false)} className="flex-1 px-4 py-3 text-brand-600 dark:text-slate-400 font-bold text-sm uppercase hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancelar</button>
                 <button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-bold text-sm uppercase py-3 rounded-xl shadow-md transition-all shadow-amber-500/20">Confirmar</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMAR FECHA DE PAGO */}
      {pagoModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-brand-200 dark:border-slate-800 transform transition-all scale-100">
            <div className="bg-emerald-100 dark:bg-emerald-900/40 border-b border-emerald-200 dark:border-emerald-900/50 p-6 text-center">
              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border-4 border-emerald-50 dark:border-emerald-900/30">
                <CheckCircle className="text-emerald-500" size={32} />
              </div>
              <h3 className="text-xl font-black text-emerald-900 dark:text-emerald-500 tracking-tight">Confirmar Pago</h3>
              <p className="text-emerald-700 dark:text-emerald-400 text-sm font-medium mt-1">Registra la fecha real en la que el cliente abonó esta cuota.</p>
            </div>
            
            <form onSubmit={handleConfirmPago} className="p-6 pb-8">
               <div className="space-y-2">
                 <label className="block text-xs font-bold text-brand-600 dark:text-slate-400 uppercase tracking-wider">Fecha del Abono</label>
                 <input 
                   type="date" 
                   required
                   value={fechaPagoConfirm}
                   onChange={(e) => setFechaPagoConfirm(e.target.value)}
                   className="w-full text-center border-2 border-brand-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-lg focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-black text-brand-900 dark:text-white bg-slate-50 dark:bg-slate-950" 
                 />
               </div>
               <div className="mt-8 flex items-center gap-3">
                 <button type="button" onClick={() => setPagoModalOpen(false)} className="flex-1 px-4 py-3 text-brand-600 dark:text-slate-400 font-bold text-sm uppercase hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancelar</button>
                 <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-sm uppercase py-3 rounded-xl shadow-md transition-all shadow-emerald-500/20">Confirmar</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Crear Servicio */}
      <ServicioModal 
        isOpen={isServicioModalOpen} 
        onClose={() => setIsServicioModalOpen(false)} 
        onSave={handleSaveServicio} 
        initialData={null} 
      />
    </div>
  );
}
