import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToIngresos, addIngreso, updateIngreso, deleteIngreso, addServicio } from '../utils/financeStorage';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, DollarSign, Calendar, CheckCircle, AlertCircle, Trash2, Download, Edit3, MessageCircle, FileText, Calculator, Edit2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ServicioModal from '../components/ServicioModal';

export default function HonorariosVariablesView() {
  const [ingresos, setIngresos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [editingId, setEditingId] = useState(null);
  const [selectedClientPreview, setSelectedClientPreview] = useState(null);
  const [isServicioModalOpen, setIsServicioModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]); // Multiselect
  
  // Facturación Modal State
  const [facturaModalOpen, setFacturaModalOpen] = useState(false);
  const [selectedIngresoFactura, setSelectedIngresoFactura] = useState(null);
  const [fechaFactura, setFechaFactura] = useState('');
  
  // Pago Modal State
  const [pagoModalOpen, setPagoModalOpen] = useState(false);
  const [selectedIngresoPago, setSelectedIngresoPago] = useState(null);
  const [fechaPagoConfirm, setFechaPagoConfirm] = useState('');
  
  const [expandedYears, setExpandedYears] = useState({});
  const toggleYear = (year) => {
    setExpandedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };
  
  const navigate = useNavigate();
  
  const [clientes, setClientes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [contrapartes, setContrapartes] = useState([]);

  useEffect(() => {
    const unsubClientes = onSnapshot(query(collection(db, 'clientes')), (snapshot) => {
      setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubServicios = onSnapshot(query(collection(db, 'servicios')), (snapshot) => {
      setServicios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubContrapartes = onSnapshot(query(collection(db, 'contrapartes')), (snapshot) => {
      setContrapartes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubClientes(); unsubServicios(); unsubContrapartes(); };
  }, []);

  const [formData, setFormData] = useState({
    expedienteId: '',
    tipo: 'Por audiencia', // default
    servicio: '',
    descripcion: '',
    moneda: 'PEN',
    montoTotal: '',
    estado: 'Pendiente',
    fechaPago: new Date().toISOString().split('T')[0],
    facturado: false,
    igvRate: 18,
    contraparte: ''
  });

  const [isEditingIgv, setIsEditingIgv] = useState(false);

  const handleIgvChange = (e) => {
     let val = parseFloat(e.target.value);
     if (isNaN(val) || val < 0) val = 0;
     if (val > 100) val = 100;
     setFormData(prev => ({ ...prev, igvRate: val }));
  };

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

  const TIPOS_PERMITIDOS = [
    'Por audiencia',
    'Por acto procesal',
    'Por asesoría',
    'Otros ingresos'
  ];

  useEffect(() => {
    const unsubscribe = subscribeToIngresos((data) => {
      // Ordenar por fecha de PAGO descendente (Meses recientes arriba)
      setIngresos(data
        .filter(ing => TIPOS_PERMITIDOS.includes(ing.tipo))
        .sort((a, b) => new Date(b.fechaPago || b.createdAt || 0) - new Date(a.fechaPago || a.createdAt || 0)));
    });
    return () => unsubscribe();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.expedienteId) return;

    const montoLimpio = Number(String(formData.montoTotal).replace(/,/g, '')) || 0;

    try {
      if (editingId) {
        await updateIngreso(editingId, {
          expedienteId: formData.expedienteId,
          tipo: formData.tipo,
          servicio: formData.servicio,
          descripcion: formData.descripcion || '',
          moneda: formData.moneda,
          montoTotal: montoLimpio,
          estado: formData.estado,
          fechaPago: formData.fechaPago,
          facturado: formData.facturado,
          contraparte: formData.contraparte
        });
      } else {
        await addIngreso({
          expedienteId: formData.expedienteId,
          tipo: formData.tipo,
          servicio: formData.servicio,
          descripcion: formData.descripcion || '',
          moneda: formData.moneda,
          montoTotal: montoLimpio,
          estado: formData.estado,
          fechaPago: formData.fechaPago,
          facturado: formData.facturado,
          contraparte: formData.contraparte,
          cronograma: [] // Empty array for backwards compatibility just in case
        });
      }
      handleCloseModal();
    } catch (error) {
      alert("Error al guardar el pago: " + error.message);
    }
  };

  const handleEdit = (ingreso) => {
    setFormData({
      expedienteId: ingreso.expedienteId,
      tipo: ingreso.tipo,
      servicio: ingreso.servicio || '',
      descripcion: ingreso.descripcion || '',
      moneda: ingreso.moneda || 'PEN',
      montoTotal: ingreso.montoTotal || '',
      estado: ingreso.estado || 'Pendiente',
      fechaPago: ingreso.fechaPago || '',
      facturado: ingreso.facturado || false,
      igvRate: ingreso.igvRate ?? 18,
      contraparte: ingreso.contraparte || ''
    });
    setEditingId(ingreso.id);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ 
      expedienteId: '', 
      tipo: 'Por audiencia', 
      servicio: '', 
      descripcion: '', 
      moneda: 'PEN', 
      montoTotal: '',
      estado: 'Pendiente',
      fechaPago: new Date().toISOString().split('T')[0],
      facturado: false,
      contraparte: ''
    });
  };

  const handleSaveServicio = async (data) => {
    await addServicio(data);
    setIsServicioModalOpen(false);
  };

  const handleOpenFacturaModal = (ingreso) => {
    if (ingreso.facturado) {
      // Si ya está facturado, simplemente lo desmarca sin preguntar fechas
      updateIngreso(ingreso.id, { facturado: false, fechaFacturacion: null });
      return;
    }
    // Si no está facturado, abre el modal
    setSelectedIngresoFactura(ingreso);
    setFechaFactura(ingreso.fechaPago || new Date().toISOString().split('T')[0]);
    setFacturaModalOpen(true);
  };

  const handleConfirmFactura = async (e) => {
    e.preventDefault();
    if (!selectedIngresoFactura || !fechaFactura) return;
    
    await updateIngreso(selectedIngresoFactura.id, { 
      facturado: true, 
      fechaFacturacion: fechaFactura 
    });
    
    setFacturaModalOpen(false);
    setSelectedIngresoFactura(null);
    setFechaFactura('');
  };

  const handleOpenPagoModal = (ingreso) => {
    setSelectedIngresoPago(ingreso);
    setFechaPagoConfirm(new Date().toISOString().slice(0, 10)); // Default today
    setPagoModalOpen(true);
  };

  const handleConfirmPago = async (e) => {
    e.preventDefault();
    if (!selectedIngresoPago || !fechaPagoConfirm) return;
    
    await updateIngreso(selectedIngresoPago.id, {
      estado: 'Pagado',
      fechaPago: fechaPagoConfirm
    });
    
    setPagoModalOpen(false);
    setSelectedIngresoPago(null);
    setFechaPagoConfirm('');
  };

  const handleUpdateStatus = async (ingresoId, newStatus) => {
    if (newStatus === 'Pagado') {
        const ing = ingresos.find(i => i.id === ingresoId);
        if (ing) handleOpenPagoModal(ing);
        return;
    }
    
    await updateIngreso(ingresoId, {
      estado: newStatus,
      facturado: false,
      fechaFacturacion: null,
      fechaPago: null
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este ingreso?")) {
      await deleteIngreso(id);
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`¿Seguro que deseas ELIMINAR PERMANENTEMENTE los ${selectedIds.length} ingresos seleccionados?`)) {
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

  const handleWhatsAppReminder = (ingreso) => {
    const docInput = ingreso.expedienteId.split(' - ')[0];
    const client = clientes.find(c => c.documento === docInput);
    if (!client || !client.telefono) {
      alert("El cliente no tiene un número de celular/teléfono registrado en el directorio.");
      return;
    }
    const montoFormat = formatCurrency(ingreso.montoTotal);
    const mensaje = `Hola ${client.nombre}, te saludamos de VINDEX Legal Group. Te recordamos que tienes el pago pendiente por el servicio de "${ingreso.tipo}" (${ingreso.servicio}) por el monto de ${montoFormat}. Por favor comunícate con nosotros para regularizar tu pago.`;
    const phone = client.telefono.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=51${phone}&text=${encodeURIComponent(mensaje)}`, '_blank');
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
    if (parts.length === 2 && parts[1].length > 2) {
      parts[1] = parts[1].substring(0, 2);
    }
    if (parts[0]) {
      parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
    }
    return parts.join('.');
  };

  const handleDownloadComprobante = (ingreso) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Banner corporativo
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Textos del Banner
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
    doc.text("RECIBO DE PAGO PROFESIONAL", pageWidth - 14, 25, { align: "right" });
    
    // Reset colores texto
    doc.setTextColor(30, 41, 59);
    
    // N° Operación
    const nOperacion = `V-${new Date().getTime().toString().slice(-6)}`;
    const fechaEmision = new Date().toLocaleDateString('es-PE');
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`N° Operación:`, 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(nOperacion, 45, 55);
    
    doc.setFont("helvetica", "bold");
    doc.text(`Fecha de Emisión:`, pageWidth - 60, 55);
    doc.setFont("helvetica", "normal");
    doc.text(fechaEmision, pageWidth - 25, 55);

    // Datos del Cliente
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 65, pageWidth - 28, 30, 'F');
    
    const docInput = ingreso.expedienteId.split(' - ')[0];
    const client = clientes.find(c => c.documento === docInput);
    
    doc.setFont("helvetica", "bold");
    doc.text("Datos del Cliente / Pagador:", 20, 75);
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre: ${client ? client.nombre : ingreso.expedienteId}`, 20, 83);
    doc.text(`Documento: ${docInput}`, 20, 89);
    
    // Detalle del Pago
    doc.setFont("helvetica", "bold");
    doc.text("Detalle del Concepto Cobrado:", 14, 110);
    
    const tableData = [
      [ingreso.tipo, ingreso.servicio || 'Servicio General', formatCurrency(ingreso.montoTotal)]
    ];
    
    autoTable(doc, {
      startY: 115,
      head: [['Tipo de Honorario', 'Servicio Realizado', 'Monto Pagado']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    
    const finalY = doc.lastAutoTable.finalY || 150;
    
    doc.setFillColor(248, 250, 252);
    doc.rect(pageWidth - 90, finalY + 10, 76, 30, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TOTAL PAGADO:", pageWidth - 85, finalY + 28);
    
    doc.setTextColor(21, 128, 61);
    doc.setFontSize(16);
    doc.text(formatCurrency(ingreso.montoTotal), pageWidth - 45, finalY + 28);
    
    // Pie de página
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("Este recibo es un comprobante interno de VINDEX Finance y no tiene validez tributaria.", pageWidth / 2, 280, { align: "center" });

    doc.save(`Recibo_${ingreso.expedienteId.split(' - ')[0]}_${nOperacion}.pdf`);
  };

  const handleDownloadMonthReport = (year, month, monthItems) => {
    try {
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
      doc.text("REPORTE MENSUAL", pageWidth - 14, 25, { align: "right" });
      
      // Detalles del informe
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`PERÍODO: ${month.toUpperCase()} ${year}`, 14, 55);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generado el: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - 60, 55);
      
      const monthNum = {
        'Enero':'01', 'Febrero':'02', 'Marzo':'03', 'Abril':'04', 'Mayo':'05', 'Junio':'06',
        'Julio':'07', 'Agosto':'08', 'Septiembre':'09', 'Octubre':'10', 'Noviembre':'11', 'Diciembre':'12'
      }[month];
      const yearMonth = `${year}-${monthNum}`;
      
      let totalPagado = 0;
      let totalFacturado = 0;
      let totalBaseFacturada = 0;
      let totalIgvFacturado = 0;
      let rows = [];
      
      ingresos.forEach(ing => {
          const isPagoThisMonth = (ing.fechaPago || '').startsWith(yearMonth);
          const isFactThisMonth = (ing.fechaFacturacion || '').startsWith(yearMonth);
          
          if (ing.estado === 'Pagado' && (isPagoThisMonth || isFactThisMonth)) {
             const montoNum = ing.montoTotal || 0;
             if (isPagoThisMonth) totalPagado += montoNum;
             if (isFactThisMonth) {
                totalFacturado += montoNum;
                const rate = ing.igvRate ?? 18;
                totalBaseFacturada += montoNum / (1 + (rate / 100));
                totalIgvFacturado += montoNum - (montoNum / (1 + (rate / 100)));
             }
             
             rows.push([
               ing.fechaPago || '-',
               ing.fechaFacturacion || '-',
               ing.expedienteId,
               ing.tipo || 'General',
               formatCurrency(montoNum)
             ]);
          }
      });
      
      if (rows.length === 0) {
         alert("No hay ingresos ni facturaciones registradas en este mes.");
         return;
      }
      
      autoTable(doc, {
        startY: 65,
        head: [['F. Pago', 'F. Factura', 'Cliente / Expediente', 'Tipo de Honorario', 'Monto']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { textColor: [30, 41, 59], fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      
      let finalY = doc.lastAutoTable.finalY + 15;
      
      if (finalY > 230) {
        doc.addPage();
        finalY = 20;
      }
      
      // Resumen Fiscal Mensual
      doc.setFillColor(248, 250, 252);
      doc.rect(14, finalY, pageWidth - 28, 48, 'F');
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("RESUMEN FISCAL MENSUAL", 20, finalY + 8);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Dinero Ingresado (Pagado este Mes):`, 20, finalY + 17);
      doc.text(formatCurrency(totalPagado), 105, finalY + 17);
      
      doc.text(`Total Facturado este Mes:`, 20, finalY + 25);
      doc.text(formatCurrency(totalFacturado), 105, finalY + 25);
      
      doc.text(`(-) Base Imponible Facturada:`, 20, finalY + 33);
      doc.text(formatCurrency(totalBaseFacturada), 105, finalY + 33);
      
      doc.text(`(-) IGV Extraído de Facturación:`, 20, finalY + 41);
      doc.text(formatCurrency(totalIgvFacturado), 105, finalY + 41);
      
      // Total general
      doc.setFillColor(15, 23, 42);
      doc.rect(14, finalY + 52, pageWidth - 28, 15, 'F');
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("TOTAL LÍQUIDO DEL MES:", 20, finalY + 62);
      doc.setTextColor(212, 175, 55);
      doc.text(formatCurrency(totalPagado), pageWidth - 70, finalY + 62);
      
      doc.save(`Reporte_Mensual_${month}_${year}.pdf`);
    } catch(err) {
      alert("Error al generar reporte mensual: " + err.message);
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
      doc.text("REPORTE DE RENTA ANUAL", pageWidth - 14, 25, { align: "right" });
      
      // Detalles del informe
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`AÑO FISCAL: ${year}`, 14, 55);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generado el: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - 60, 55);
      
      let totalFacturadoAño = 0;
      let totalPagadoAño = 0;
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
            const isPagoThisMonth = (ing.fechaPago || '').startsWith(yearMonth);
            const isFactThisMonth = (ing.fechaFacturacion || '').startsWith(yearMonth);
            
            if (ing.estado === 'Pagado' && (isPagoThisMonth || isFactThisMonth)) {
               const montoNum = ing.montoTotal || 0;
               if (isPagoThisMonth) {
                   totalPagadoMes += montoNum;
                   totalPagadoAño += montoNum;
               }
               if (isFactThisMonth) {
                   totalFacturadoAño += montoNum;
                   const rate = ing.igvRate ?? 18;
                   totalBaseFacturadaAño += montoNum / (1 + (rate / 100));
                   totalIgvFacturadoAño += montoNum - (montoNum / (1 + (rate / 100)));
               }
               
               rows.push([
                 ing.fechaPago || '-',
                 ing.fechaFacturacion || '-',
                 ing.expedienteId,
                 ing.tipo || 'General',
                 formatCurrency(montoNum)
               ]);
            }
         });
         
         if (rows.length > 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(14, startY - 6, pageWidth - 28, 10, 'F');
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(`MES: ${monthName.toUpperCase()} - RECAUDADO LÍQUIDO: ${formatCurrency(totalPagadoMes)}`, 16, startY);
            
            autoTable(doc, {
              startY: startY + 5,
              head: [['F. Pago', 'F. Factura', 'Cliente / Expediente', 'Tipo de Honorario', 'Monto']],
              body: rows,
              theme: 'grid',
              headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
              bodyStyles: { textColor: [30, 41, 59], fontSize: 8 },
              alternateRowStyles: { fillColor: [248, 250, 252] }
            });
            
            startY = doc.lastAutoTable.finalY + 15;
            
            if (startY > 250) {
              doc.addPage();
              startY = 20;
            }
         }
      });
      
      // Resumen Fiscal Anual
      doc.setFillColor(248, 250, 252);
      doc.rect(14, startY, pageWidth - 28, 48, 'F');
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("RESUMEN FISCAL DEL AÑO", 20, startY + 8);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Dinero Recaudado en el Año:`, 20, startY + 17);
      doc.text(formatCurrency(totalPagadoAño), 95, startY + 17);
      
      doc.text(`Ingresos Totales Facturados:`, 20, startY + 25);
      doc.text(formatCurrency(totalFacturadoAño), 95, startY + 25);
      
      doc.text(`(-) Base Imponible Anual Facturada:`, 20, startY + 33);
      doc.text(formatCurrency(totalBaseFacturadaAño), 95, startY + 33);
      
      doc.text(`(-) IGV Anual Extraído:`, 20, startY + 41);
      doc.text(formatCurrency(totalIgvFacturadoAño), 95, startY + 41);
      
      // Total general
      doc.setFillColor(15, 23, 42);
      doc.rect(14, startY + 53, pageWidth - 28, 15, 'F');
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("SALDO LÍQUIDO ANUAL:", 20, startY + 63);
      doc.setTextColor(212, 175, 55);
      doc.text(formatCurrency(totalPagadoAño), pageWidth - 70, startY + 63);
      
      doc.save(`Renta_Anual_VINDEX_Honorarios_${year}.pdf`);
      
      if (shouldPurge) {
         const allIds = Object.values(yearData).flat().map(ing => ing.id);
         for (const id of allIds) {
           if(id) await deleteIngreso(id);
         }
         alert(`Año Fiscal ${year} documentado y registros purgados.`);
      } else {
         alert("Operación completada. Se conservaron los registros en el sistema.");
      }
    } catch(err) {
      alert("Error al intentar cerrar el año: " + err.message);
    }
  };

  const filteredIngresos = ingresos.filter(ing => 
    ing.expedienteId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ing.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedIngresos = filteredIngresos.reduce((acc, ing) => {
    let dateObj;
    if (ing.fechaPago) {
      dateObj = new Date(`${ing.fechaPago}T12:00:00`);
    } else {
      dateObj = ing.createdAt ? new Date(ing.createdAt) : new Date();
    }
    const year = dateObj.getFullYear().toString();
    const month = dateObj.toLocaleDateString('es-PE', { month: 'long' });
    const monthCapitalized = month.charAt(0).toUpperCase() + month.slice(1);
    
    if (!acc[year]) acc[year] = {};
    if (!acc[year][monthCapitalized]) acc[year][monthCapitalized] = [];
    acc[year][monthCapitalized].push(ing);
    return acc;
  }, {});

  const sortedYears = Object.keys(groupedIngresos).sort((a, b) => b - a);

  const getTypeColor = (type) => {
    switch(type) {
      case 'Por audiencia': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
      case 'Por acto procesal': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'Por asesoría': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
      case 'Otros ingresos': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
      default: return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-3 animate-in fade-in duration-500">
      
      {/* HEADER COMPACTO */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between border-b border-brand-100 dark:border-slate-800 pb-3 shrink-0 gap-4">
        <div className="flex-1">
           <h1 className="text-2xl font-black text-brand-900 dark:text-white tracking-tight">Honorarios Variables</h1>
           <p className="text-brand-500 dark:text-gray-400 font-medium text-xs mt-0.5">Registro de pagos únicos por audiencias, actos procesales o asesorías.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto text-xs">
           <button 
             onClick={() => setIsModalOpen(true)}
             className="w-full lg:w-auto bg-brand-900 hover:bg-brand-800 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
           >
             <Plus size={16} /> REGISTRAR NUEVO PAGO
           </button>
        </div>
      </div>

      {/* FILTRO Y ORDENAMIENTO */}
      <div className="flex flex-col sm:flex-row gap-4 mb-2 justify-between">
        <div className="relative flex-1 max-w-md">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" size={18} />
           <input 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             placeholder="Buscar por DNI o Nombre de Cliente..." 
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
               <Trash2 size={20} /> Eliminar {selectedIds.length} Seleccionados
            </button>
         </div>
      )}

      {/* GRID DE TARJETAS PRINCIPAL */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6">
        {sortedYears.length === 0 ? (
           <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 border-2 border-dashed border-brand-200 dark:border-slate-800 rounded-3xl transition-colors">
             <AlertCircle size={64} className="mx-auto text-brand-200 dark:text-slate-700 mb-5" />
             <p className="text-brand-900 dark:text-white font-bold text-xl mb-2">Sin registros encontrados</p>
             <p className="text-brand-500 dark:text-slate-400 font-medium text-sm max-w-sm mx-auto">No hay registros o no coinciden con la búsqueda.</p>
           </div>
        ) : (
           <div className="flex flex-col gap-10">
             {sortedYears.map((year) => {
               const isExpanded = expandedYears[year] !== undefined ? expandedYears[year] : (sortedYears[0] === year);
               return (
               <div key={year} className="flex flex-col gap-5">
                 
                 {/* ENCABEZADO DE AÑO FISCAL */}
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-brand-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-brand-100 dark:border-slate-700 shadow-sm">
                   <h2 className="cursor-pointer text-xl font-black text-brand-900 dark:text-white flex items-center gap-2 hover:text-brand-700 transition-colors" onClick={() => toggleYear(year)}>
                     <Calendar size={22} className="text-brand-600 dark:text-brand-400" />
                     Año Fiscal {year}
                   </h2>
                   <div className="flex items-center gap-2 w-full sm:w-auto">
                     <button 
                       onClick={() => toggleYear(year)}
                       className="bg-white hover:bg-brand-50 text-brand-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 border border-brand-200 dark:border-slate-600 flex-1 sm:flex-none"
                     >
                       {isExpanded ? 'Ocultar Meses' : 'Desplegar Pagos'}
                     </button>
                     <button 
                       onClick={() => handleCloseYear(year, groupedIngresos[year])}
                       className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 border border-red-200 dark:border-red-800/30 flex-1 sm:flex-none"
                     >
                       <Download size={16} /> Reporte Anual
                     </button>
                   </div>
                 </div>

                 {/* MESES DEL AÑO */}
                 {isExpanded && Object.keys(groupedIngresos[year]).sort((a, b) => {
                    const monthOrder = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    return sortOrder === 'desc' 
                      ? monthOrder.indexOf(b) - monthOrder.indexOf(a)
                      : monthOrder.indexOf(a) - monthOrder.indexOf(b);
                 }).map((month) => {
                   const monthItems = groupedIngresos[year][month];
                   const sumMes = monthItems.reduce((acc, current) => acc + (current.montoTotal || 0), 0);
                   return (
                     <div key={month} className="ml-2 sm:ml-6 flex flex-col gap-3">
                       <h3 className="text-sm font-bold text-brand-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-between border-b border-brand-50 dark:border-slate-800 pb-2">
                         <span className="flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-brand-400"></span>{month}
                         </span>
                         <div className="flex items-center gap-3">
                           <button onClick={() => handleDownloadMonthReport(year, month, monthItems)} className="text-[9px] uppercase font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors shadow-sm cursor-pointer border border-indigo-200"><Download size={12}/> Reporte Mes</button>
                           <span className="text-brand-900 dark:text-white font-black">{formatCurrency(sumMes)}</span>
                         </div>
                       </h3>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                         {monthItems.map((ingreso) => {
                            return (
                   <div key={ingreso.id} className={`relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border ${selectedIds.includes(ingreso.id) ? 'border-red-400 shadow-md transform scale-[1.01]' : 'border-brand-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-slate-700 hover:shadow-md'} shadow-sm transition-all duration-300 rounded-2xl flex flex-col overflow-hidden group`}>
                      
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
                      <div className="p-5 pl-12 pb-3 border-b border-brand-50 dark:border-slate-800/50 flex justify-between items-start gap-4">
                         <div className="flex-1">
                           <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border rounded-md whitespace-nowrap mb-2 ${getTypeColor(ingreso.tipo)}`}>
                             {ingreso.tipo}
                           </span>
                           <h3 className="font-black text-lg text-brand-900 dark:text-white leading-tight break-words">{ingreso.expedienteId}</h3>
                           {ingreso.servicio && (
                             <p className="text-brand-500 font-bold text-[10px] mt-1 uppercase">{ingreso.servicio}</p>
                           )}
                         </div>
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                           <button onClick={() => handleEdit(ingreso)} className="p-1.5 text-brand-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"><Edit3 size={16}/></button>
                           <button onClick={() => handleDelete(ingreso.id)} className="p-1.5 text-brand-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"><Trash2 size={16}/></button>
                         </div>
                      </div>

                      {/* Cuerpo Tarjeta */}
                      <div className="p-5 flex-1 flex flex-col gap-4">
                         <div className="flex items-center justify-between border-b border-brand-50 dark:border-slate-800/50 pb-3">
                            <div>
                               <p className="text-[10px] text-brand-500 font-bold uppercase tracking-widest mb-1">Monto del Pago</p>
                               <div className="font-black text-2xl text-brand-900 dark:text-white tracking-tight">
                                 {formatCurrency(ingreso.montoTotal)}
                               </div>
                            </div>
                            <div className="text-right flex flex-col gap-1.5 items-end">
                               <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm border ${
                                 ingreso.estado === 'Pagado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                                 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                               }`}>
                                 {ingreso.estado === 'Pagado' ? <CheckCircle size={12}/> : <AlertCircle size={12}/>}
                                 {ingreso.estado}
                               </span>
                            </div>
                         </div>
                         
                         {/* Fechas Visibles */}
                         <div className="flex flex-col gap-1.5 bg-brand-50/50 dark:bg-slate-800/30 p-3 rounded-xl">
                           <div className="flex items-center gap-2 text-xs font-bold text-brand-700 dark:text-slate-300">
                             <Calendar size={13} className="text-brand-500"/> 
                             <span>Pago: {ingreso.fechaPago ? new Date(`${ingreso.fechaPago}T12:00:00`).toLocaleDateString('es-PE') : 'No registrada'}</span>
                           </div>
                           {ingreso.facturado && ingreso.fechaFacturacion && (
                             <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                               <FileText size={13} />
                               <span>Facturado el: {new Date(`${ingreso.fechaFacturacion}T12:00:00`).toLocaleDateString('es-PE')}</span>
                             </div>
                           )}
                         </div>
                         
                         {ingreso.descripcion && (
                           <div className="text-[11px] text-brand-600 dark:text-slate-400 leading-snug line-clamp-2">
                             {ingreso.descripcion}
                           </div>
                         )}
                      </div>

                      {/* Pie Tarjeta / Acciones */}
                      <div className="p-4 pt-0 mt-auto border-t border-brand-50 dark:border-slate-800/50 pt-4">
                        <div className="flex flex-col gap-2">
                          {ingreso.estado !== 'Pagado' ? (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleWhatsAppReminder(ingreso)}
                                className="bg-[#25D366] hover:bg-[#128C7E] text-white px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm"
                                title="Enviar recordatorio por WhatsApp"
                              >
                                <MessageCircle size={16} />
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(ingreso.id, 'Pagado')}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm py-2.5"
                              >
                                <CheckCircle size={14} /> Marcar como Pagado
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleUpdateStatus(ingreso.id, 'Pendiente')}
                                className="bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm text-center flex-1"
                                title="Revertir a Pendiente"
                              >
                                Revertir
                              </button>
                              <button 
                                onClick={() => handleDownloadComprobante(ingreso)}
                                className="flex-1 flex items-center justify-center gap-1.5 bg-brand-900 hover:bg-brand-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm py-2.5"
                              >
                                <FileText size={14} /> Descargar Recibo
                              </button>
                            </div>
                          )}
                          
                          {ingreso.estado === 'Pagado' && (
                            <button
                              onClick={() => handleOpenFacturaModal(ingreso)}
                              className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 border ${
                                ingreso.facturado 
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800'
                                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-indigo-600 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 dark:hover:text-indigo-400'
                              }`}
                              title={ingreso.facturado ? "Desmarcar factura" : "Marcar como facturado"}
                            >
                              {ingreso.facturado && <CheckCircle size={14}/>}
                              {ingreso.facturado ? 'Documento Facturado' : 'Marcar como Facturado'}
                            </button>
                          )}
                        </div>
                      </div>
                   </div>
                );
                         })}
                       </div>
                     </div>
                   );
                 })}
               </div>
               );
             })}
           </div>
        )}
      </div>

      {/* MODAL DE CREACIÓN / EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white dark:bg-slate-950 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col border border-brand-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
              <div className="bg-brand-50 dark:bg-slate-900 border-b border-brand-200 dark:border-slate-800 px-6 py-5 flex items-center justify-between shrink-0">
                 <h3 className="text-lg font-black text-brand-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
                   {editingId ? 'Editar Pago' : 'Registrar Nuevo Pago'}
                 </h3>
              </div>
              
              <div className="overflow-y-auto custom-scrollbar p-6">
                <form id="ingresoForm" onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* CLIENTE */}
                    <div className="md:col-span-2">
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

                    {/* CLIENT PREVIEW CARD */}
                    {selectedClientPreview && (
                    <div className="bg-gradient-to-br from-brand-50 to-white dark:from-slate-800 dark:to-slate-900 border border-brand-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col gap-2 mt-4 mb-4">
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
                         <div className="col-span-2 bg-white dark:bg-slate-950 px-3 py-2 rounded-lg border border-brand-100 dark:border-slate-800">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Contraparte Específica (Opcional)</label>
                            <select
                              value={formData.contraparte}
                              onChange={(e) => setFormData({...formData, contraparte: e.target.value})}
                              className="w-full bg-transparent border-none p-0 text-sm font-bold text-brand-700 dark:text-gray-300 focus:ring-0 outline-none"
                            >
                              <option value="">{selectedClientPreview.contraparte ? `Usar del cliente: ${selectedClientPreview.contraparte}` : 'Seleccione (Opcional)...'}</option>
                              {contrapartes.map(c => (
                                <option key={c.id} value={c.nombre}>{c.nombre}</option>
                              ))}
                            </select>
                         </div>
                      </div>
                    </div>
                    )}

                    {/* TIPO Y SERVICIO */}
                    <div>
                        <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Tipo de Honorario <span className="text-red-500">*</span></label>
                        <select 
                          required 
                          value={formData.tipo} 
                          onChange={e => setFormData({...formData, tipo: e.target.value})}
                          className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-bold text-brand-900 dark:text-white bg-white dark:bg-slate-900"
                        >
                          {TIPOS_PERMITIDOS.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest">Servicio Específico (Opcional)</label>
                          <button type="button" onClick={() => setIsServicioModalOpen(true)} className="flex items-center gap-1.5 bg-brand-100 hover:bg-brand-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-brand-700 dark:text-slate-300 px-2.5 py-1 rounded-lg transition-colors font-bold text-[9px] uppercase tracking-wider shadow-sm" title="Crear Nuevo Servicio">
                            <Plus size={12}/> Nuevo
                          </button>
                        </div>
                        <input 
                          list="servicios-list"
                          type="text"
                          value={formData.servicio} 
                          onChange={e => setFormData({...formData, servicio: e.target.value})} 
                          placeholder="Ej: Audiencia Conciliación"
                          className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-bold text-brand-900 dark:text-white bg-white dark:bg-slate-900" 
                        />
                        <datalist id="servicios-list">
                          {servicios.map(s => <option key={s.id} value={s.nombre} />)}
                        </datalist>
                    </div>

                    {/* MONTO Y ESTADO */}
                    <div>
                        <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Monto Total a Cobrar <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-brand-400">S/</span>
                          <input 
                            required 
                            type="text" 
                            value={formData.montoTotal} 
                            onChange={e => setFormData({...formData, montoTotal: formatNumberInput(e.target.value)})} 
                            placeholder="Ej: 500.00"
                            className="w-full border border-brand-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 font-bold bg-white dark:bg-slate-900 text-brand-900 dark:text-white" 
                          />
                        </div>
                        
                        {/* Breakdown Dinámico del IGV */}
                        {formData.montoTotal && parseFloat(String(formData.montoTotal).replace(/,/g, '')) > 0 && (
                          <div className="mt-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-3 animate-in fade-in slide-in-from-top-2">
                             <div className="flex items-center justify-between mb-2 pb-2 border-b border-indigo-100/50 dark:border-indigo-800/30">
                               <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                                 <Calculator size={12} /> Cálculo del IGV Extraído
                               </span>
                               {isEditingIgv ? (
                                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded px-1 border border-indigo-200 dark:border-indigo-700">
                                     <input 
                                       autoFocus
                                       type="number" 
                                       value={formData.igvRate ?? 18}
                                       onChange={handleIgvChange}
                                       onBlur={() => setIsEditingIgv(false)}
                                       onKeyDown={(e) => e.key === 'Enter' && setIsEditingIgv(false)}
                                       className="w-10 h-6 text-xs text-center focus:outline-none font-bold bg-transparent text-indigo-900 dark:text-indigo-300"
                                       step="1"
                                       min="0"
                                       max="100"
                                     />
                                     <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 pr-1">%</span>
                                  </div>
                               ) : (
                                  <button 
                                    type="button" 
                                    onClick={() => setIsEditingIgv(true)}
                                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center gap-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 px-2 py-0.5 rounded shadow-sm transition-colors"
                                  >
                                     IGV {formData.igvRate ?? 18}% <Edit2 size={10} />
                                  </button>
                               )}
                             </div>
                             
                             <div className="space-y-1.5">
                                 <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500 font-medium dark:text-slate-400">Base Imponible:</span>
                                    <span className="font-bold text-indigo-900 dark:text-indigo-300">
                                       S/ {formatCurrency(parseFloat(String(formData.montoTotal).replace(/,/g, '')) / (1 + ((formData.igvRate ?? 18)/100)))}
                                    </span>
                                 </div>
                                 <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500 font-medium dark:text-slate-400">Impuesto (IGV):</span>
                                    <span className="font-black text-indigo-600 dark:text-indigo-400">
                                       S/ {formatCurrency(parseFloat(String(formData.montoTotal).replace(/,/g, '')) - (parseFloat(String(formData.montoTotal).replace(/,/g, '')) / (1 + ((formData.igvRate ?? 18)/100))))}
                                    </span>
                                 </div>
                             </div>
                          </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Estado del Pago <span className="text-red-500">*</span></label>
                        <select 
                          required 
                          value={formData.estado} 
                          onChange={e => setFormData({...formData, estado: e.target.value})}
                          className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-bold text-brand-900 dark:text-white bg-white dark:bg-slate-900"
                        >
                          <option value="Pendiente">Cobro Pendiente</option>
                          <option value="Pagado">El Cliente Ya Pagó (Pagado)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Fecha de Pago <span className="text-red-500">*</span></label>
                        <input 
                          required
                          type="date"
                          value={formData.fechaPago || ''} 
                          onChange={e => setFormData({...formData, fechaPago: e.target.value})}
                          className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 font-bold bg-white dark:bg-slate-900 text-brand-900 dark:text-white"
                        />
                    </div>

                    {/* OPCIÓN DE FACTURACIÓN EN MODAL */}
                    <div className="md:col-span-2 bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800/30 flex items-center justify-between">
                        <div>
                           <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300">Estado de Facturación</label>
                           <p className="text-[10px] text-indigo-600 dark:text-indigo-400/70">¿Se emitió comprobante fiscal para impuestos de este pago?</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={formData.facturado} onChange={e => setFormData({...formData, facturado: e.target.checked})} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {/* DESCRIPCIÓN */}
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Descripción o Detalles del Pago</label>
                        <textarea 
                          rows={2}
                          value={formData.descripcion} 
                          onChange={e => setFormData({...formData, descripcion: e.target.value})} 
                          placeholder="Información adicional sobre este pago o servicio... (Opcional)"
                          className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium text-brand-900 dark:text-white bg-white dark:bg-slate-900 resize-none" 
                        />
                    </div>
                  </div>

                  {/* PREVIEW DEL DIRECTORIO */}
                  {selectedClientPreview && (
                    <div className="mt-4 p-4 bg-brand-50 dark:bg-slate-800/50 rounded-2xl border border-brand-100 dark:border-slate-700">
                      <p className="text-[10px] font-black uppercase text-brand-500 tracking-widest mb-2">Previsualización de Cliente</p>
                      <div className="flex gap-4 items-center">
                        <div className="w-10 h-10 rounded-full bg-brand-900 text-white flex items-center justify-center font-black text-lg shadow-sm">
                          {selectedClientPreview.nombre.charAt(0)}
                        </div>
                        <div>
                           <p className="font-bold text-sm text-brand-900 dark:text-white leading-tight">{selectedClientPreview.nombre}</p>
                           <p className="text-xs text-brand-500 mt-0.5">DNI/RUC: {selectedClientPreview.documento} {selectedClientPreview.telefono && ` | Tel: ${selectedClientPreview.telefono}`}</p>
                        </div>
                      </div>
                    </div>
                  )}

                </form>
              </div>

              <div className="bg-brand-50 dark:bg-slate-900 border-t border-brand-200 dark:border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
                  <button type="button" onClick={handleCloseModal} className="w-full sm:w-auto px-5 py-2.5 text-brand-600 dark:text-gray-400 font-bold text-xs uppercase cursor-pointer hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors tracking-wide border border-transparent shadow-sm">Cancelar</button>
                  <button form="ingresoForm" type="submit" className="w-full sm:w-auto bg-brand-900 hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide">
                    {editingId ? 'Guardar Cambios' : 'Registrar Pago'}
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE FECHA DE PAGO */}
      {pagoModalOpen && selectedIngresoPago && (
        <div className="fixed inset-0 bg-brand-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white dark:bg-slate-950 rounded-3xl shadow-2xl w-full max-w-sm flex flex-col border border-brand-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/30 px-6 py-5 flex items-center justify-between shrink-0">
                 <h3 className="text-base font-black text-emerald-900 dark:text-emerald-300 tracking-tight flex items-center gap-2">
                   <CheckCircle size={18} /> Confirmar Pago
                 </h3>
              </div>
              
              <div className="p-6">
                <form id="pagoForm" onSubmit={handleConfirmPago} className="space-y-4">
                  <div>
                      <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Fecha Real del Abono <span className="text-red-500">*</span></label>
                      <p className="text-xs text-brand-400 dark:text-slate-400 mb-3 leading-snug">
                        Esta fecha identificará contablemente en qué mes ingresó el pago a caja.
                      </p>
                      <input 
                        required 
                        type="date"
                        value={fechaPagoConfirm} 
                        onChange={e => setFechaPagoConfirm(e.target.value)}
                        className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 font-bold bg-white dark:bg-slate-900 text-brand-900 dark:text-white"
                      />
                  </div>
                </form>
              </div>

              <div className="bg-brand-50 dark:bg-slate-900 border-t border-brand-200 dark:border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
                  <button type="button" onClick={() => setPagoModalOpen(false)} className="w-full sm:w-auto px-5 py-2.5 text-brand-600 dark:text-gray-400 font-bold text-xs uppercase cursor-pointer hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors tracking-wide border border-transparent shadow-sm">Cancelar</button>
                  <button form="pagoForm" type="submit" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide">
                    Confirmar Pago
                  </button>
              </div>
           </div>
        </div>
      )}

      <ServicioModal 
        isOpen={isServicioModalOpen} 
        onClose={() => setIsServicioModalOpen(false)} 
        onSave={handleSaveServicio} 
        initialData={null} 
      />

      {/* MODAL DE CONFIRMACIÓN DE FECHA DE FACTURACIÓN */}
      {facturaModalOpen && selectedIngresoFactura && (
        <div className="fixed inset-0 bg-brand-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white dark:bg-slate-950 rounded-3xl shadow-2xl w-full max-w-sm flex flex-col border border-brand-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/30 px-6 py-5 flex items-center justify-between shrink-0">
                 <h3 className="text-base font-black text-indigo-900 dark:text-indigo-300 tracking-tight flex items-center gap-2">
                   <FileText size={18} /> Confirmar Facturación
                 </h3>
              </div>
              
              <div className="p-6">
                <form id="facturaForm" onSubmit={handleConfirmFactura} className="space-y-4">
                  <div>
                      <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Fecha de Emisión de Factura <span className="text-red-500">*</span></label>
                      <p className="text-xs text-brand-400 dark:text-slate-400 mb-3 leading-snug">
                        Se utilizará esta fecha para los cálculos de la renta anual. Por defecto, es la fecha que se registró como pagado.
                      </p>
                      <input 
                        required 
                        type="date"
                        value={fechaFactura} 
                        onChange={e => setFechaFactura(e.target.value)}
                        className="w-full border border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-bold bg-white dark:bg-slate-900 text-brand-900 dark:text-white"
                      />
                  </div>
                </form>
              </div>

              <div className="bg-brand-50 dark:bg-slate-900 border-t border-brand-200 dark:border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
                  <button type="button" onClick={() => setFacturaModalOpen(false)} className="w-full sm:w-auto px-5 py-2.5 text-brand-600 dark:text-gray-400 font-bold text-xs uppercase cursor-pointer hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors tracking-wide border border-transparent shadow-sm">Cancelar</button>
                  <button form="facturaForm" type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide">
                    Confirmar Facturado
                  </button>
              </div>
           </div>
        </div>
      )}
      {/* Modal Cierre Anual Honorarios Variables */}
      {cierreParams && (
        <div className="fixed inset-0 bg-brand-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-2xl font-black text-brand-900 mb-2">Cierre Anual {cierreParams.year}</h3>
              <p className="text-sm font-medium text-brand-600 mb-6 flex flex-col gap-1">
                <span>¿Qué deseas hacer con el cierre fiscal de <strong>Honorarios Variables</strong> de este año?</span>
              </p>
              
              <div className="space-y-4 mb-6">
                 <button 
                   onClick={() => executeCierre(false)}
                   className="w-full text-left p-4 border-2 border-brand-200 hover:border-brand-500 rounded-2xl transition-all bg-brand-50 hover:bg-brand-100 hover:shadow-md cursor-pointer"
                 >
                    <h4 className="font-black text-brand-900 flex items-center gap-2"><FileText size={18} className="text-brand-500"/> Solo Reporte PDF</h4>
                    <p className="text-[11px] font-bold text-brand-500 mt-1 uppercase tracking-wider">Descarga el reporte contable pero mantiene todo el historial de cobros intacto en el sistema.</p>
                 </button>
                 
                 <button 
                   onClick={() => executeCierre(true)}
                   className="w-full text-left p-4 border-2 border-rose-200 hover:border-rose-500 rounded-2xl transition-all bg-rose-50 hover:bg-rose-100/50 hover:shadow-md cursor-pointer group"
                 >
                    <h4 className="font-black text-rose-700 flex items-center gap-2"><Trash2 size={18} className="text-rose-500 group-hover:scale-110 transition-transform"/> PDF + Purga Segura</h4>
                    <p className="text-[11px] font-bold text-rose-500 mt-1 uppercase tracking-wider">Descarga el reporte detallado y ELIMINA permanentemente todos los registros del {cierreParams.year}.</p>
                 </button>
              </div>
              
              <button onClick={() => setCierreParams(null)} className="w-full py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar Operación</button>
           </div>
        </div>
      )}

    </div>
  );
}
