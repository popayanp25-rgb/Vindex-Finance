import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Landmark, ArrowUpCircle, ArrowDownCircle, Banknote, CalendarDays, TrendingUp, DollarSign, CheckCircle, Briefcase, Users, AlertTriangle, Wallet, Eye, EyeOff, ChevronUp, ChevronDown, ListMinus, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';
export default function CajaView() {
  const [ingresos, setIngresos] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [retiros, setRetiros] = useState([]);
  const [socios, setSocios] = useState([]);
  const { userData } = useAuth();
  
  const [activeTab, setActiveTab] = useState('operativa'); 
  const [anioCaja, setAnioCaja] = useState(new Date().getFullYear().toString());
  
  const [dividendosFiltro, setDividendosFiltro] = useState('historico');
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().toISOString().slice(0, 7));
  const [hideSaldo, setHideSaldo] = useState(false);
  const [hideMovimientos, setHideMovimientos] = useState(false);

  const [isDivModalOpen, setIsDivModalOpen] = useState(false);
  const [divMode, setDivMode] = useState('formal'); 
  const [divData, setDivData] = useState({ socioId: '', monto: '', maxMonto: 0, rangoText: '', fechaManual: new Date().toISOString().slice(0, 10) });

  const [isCofreActionOpen, setIsCofreActionOpen] = useState(false);
  const [rentaWizardStep, setRentaWizardStep] = useState(1);
  const [cofreActionData, setCofreActionData] = useState({ tipo: '', monto: '', maxMonto: 0, rangoText: '', deudaVal: 0, anioVal: '' });
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingRetiroId, setEditingRetiroId] = useState(null);
  const [editRetiroData, setEditRetiroData] = useState({ concepto: '', monto: '', fechaPago: '' });

  const handleSaveEditRetiro = async (id) => {
      try {
          const newDateStr = new Date(`${editRetiroData.fechaPago}T12:00:00.000Z`).toISOString();
          await updateDoc(doc(db, 'retiros_caja', id), {
              concepto: editRetiroData.concepto,
              monto: Number(editRetiroData.monto).toFixed(2),
              fechaPago: newDateStr
          });
          setEditingRetiroId(null);
      } catch (e) {
          console.error(e);
          alert('Error al guardar edición');
      }
  };

  const handleDeleteRetiro = async (id) => {
      if(window.confirm('¿Estás seguro de eliminar este registro histórico?')) {
          try {
              await deleteDoc(doc(db, 'retiros_caja', id));
          } catch(e) {
              console.error(e);
              alert('Error al eliminar registro');
          }
      }
  };

  useEffect(() => {
    const unsubIng = onSnapshot(query(collection(db, 'ingresos')), s => setIngresos(s.docs.map(d => ({ id: d.id, ...d.data()}))));
    const unsubEg = onSnapshot(query(collection(db, 'egresos')), s => setEgresos(s.docs.map(d => ({ id: d.id, ...d.data()}))));
    const unsubRet = onSnapshot(query(collection(db, 'retiros_caja')), s => setRetiros(s.docs.map(d => ({ id: d.id, ...d.data()}))));
    const unsubSoc = onSnapshot(query(collection(db, 'socios')), s => setSocios(s.docs.map(d => ({ id: d.id, ...d.data()}))));
    return () => { unsubIng(); unsubEg(); unsubRet(); unsubSoc(); };
  }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val);

  const calcDeudaAnual = (anio) => {
      const desgloseObj = {};
      for(let i=1; i<=12; i++){
          desgloseObj[i.toString().padStart(2, '0')] = { 
              ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0 
          };
      }

      ingresos.forEach(ing => {
          if (ing.cronograma && ing.cronograma.length > 0) {
              ing.cronograma.forEach(c => {
                 const fp = c.fechaPago || '';
                 if (c.estado === 'Pagado' && fp.startsWith(anio) && c.facturado) {
                     const m = Number(String(c.monto).replace(/,/g, '')) || 0;
                     const rate = ing.igvRate ?? 18;
                     const b = m / (1 + (rate / 100));
                     const mesNum = fp.slice(5, 7);
                     if (desgloseObj[mesNum]) {
                         desgloseObj[mesNum].ingresoBruto += m;
                         desgloseObj[mesNum].igvVentas += (m - b);
                     }
                 }
              });
          } else {
              const fp = ing.fechaPago || '';
              if (ing.estado === 'Pagado' && fp.startsWith(anio) && ing.facturado) {
                  const m = Number(String(ing.montoTotal||ing.monto||0).replace(/,/g, '')) || 0;
                  const rate = ing.igvRate ?? 18;
                  const b = m / (1 + (rate / 100));
                  const mesNum = fp.slice(5, 7);
                  if (desgloseObj[mesNum]) {
                      desgloseObj[mesNum].ingresoBruto += m;
                      desgloseObj[mesNum].igvVentas += (m - b);
                  }
              }
          }
      });

      egresos.forEach(eg => {
          const fp = eg.fechaPago || eg.fecha || '';
          if (eg.estado === 'Pagado' && fp.startsWith(anio)) {
             const m = Number(String(eg.montoTotal||eg.monto).replace(/,/g, '')) || 0;
             const mesNum = fp.slice(5, 7);
             if (desgloseObj[mesNum]) {
                 const esFactura = eg.comprobanteTipo === 'Factura' || eg.comprobante === 'Factura';
                 const esRH = eg.comprobanteTipo === 'Recibo por Honorarios' || eg.comprobante === 'Recibo por Honorarios' || eg.comprobante === 'RH';
                 if (esFactura) {
                     const rate = eg.igv ?? 18;
                     const b = m / (1 + (rate / 100));
                     desgloseObj[mesNum].egresoFormal += b;
                     desgloseObj[mesNum].igvCompras += (m - b);
                 } else if (esRH) {
                     desgloseObj[mesNum].egresoFormal += m;
                 }
             }
          }
      });

      let anualIngresos = 0, anualEgresos = 0, anualAdelanto = 0;
      Object.keys(desgloseObj).forEach(m => {
          const data = desgloseObj[m];
          const igvPagar = Math.max(0, data.igvVentas - data.igvCompras);
          const baseImponible = data.ingresoBruto - igvPagar;
          anualIngresos += baseImponible;
          anualEgresos += data.egresoFormal;
          anualAdelanto += (baseImponible * 0.01);
      });
      
      const baseRenta = Math.max(0, anualIngresos - anualEgresos);
      return Math.max(0, (baseRenta * 0.10) - anualAdelanto);
  };

  const calcFondos = (rangoStr, tipoFiltro) => {
      const inRange = (fecha) => {
          if (!fecha) return false;
          if (tipoFiltro === 'historico') return true;
          if (tipoFiltro === 'anio') return fecha.startsWith(rangoStr);
          if (tipoFiltro === 'mes') return fecha.startsWith(rangoStr);
          return true;
      };

      let recTotal = 0, factBase = 0, igvCobrado = 0;
      ingresos.forEach(ing => {
          if (ing.cronograma && ing.cronograma.length > 0) {
              ing.cronograma.forEach(c => {
                  if (c.estado === 'Pagado' && inRange(c.fechaPago)) {
                      const m = Number(String(c.monto).replace(/,/g, '')) || 0;
                      recTotal += m;
                      if (c.facturado) {
                          const rate = ing.igvRate ?? 18;
                          factBase += m / (1 + (rate / 100));
                          igvCobrado += m - (m / (1 + (rate / 100)));
                      }
                  }
              });
          } else {
              if (ing.estado === 'Pagado' && inRange(ing.fechaPago)) {
                  const m = Number(String(ing.montoTotal).replace(/,/g, '')) || 0;
                  recTotal += m;
                  if (ing.facturado) {
                      const rate = ing.igvRate ?? 18;
                      factBase += m / (1 + (rate / 100));
                      igvCobrado += m - (m / (1 + (rate / 100)));
                  }
              }
          }
      });

      let gastadoOperativoTotal = 0, egFormBase = 0, igvPagado = 0;
      let retiradoFormal = 0, retiradoInformal = 0, gastadoFisicoBruto = 0, gastadoCofreMonto = 0;

      // Gastos Operativos (Vienen de Tributación/Egresos)
      egresos.forEach(eg => {
          const f = eg.fechaPago || eg.fecha || '';
          if (inRange(f) && eg.estado === 'Pagado') {
              const m = Number(String(eg.montoTotal || eg.monto).replace(/,/g, '')) || 0;
              gastadoFisicoBruto += m;
              gastadoOperativoTotal += m;

              const esFactura = eg.comprobanteTipo === 'Factura' || eg.comprobante === 'Factura';
              const esRH = eg.comprobanteTipo === 'Recibo por Honorarios' || eg.comprobante === 'Recibo por Honorarios' || eg.comprobante === 'RH';
              
              if (esFactura) {
                  const rate = eg.igv ?? 18;
                  egFormBase += m / (1 + (rate / 100));
                  igvPagado += m - (m / (1 + (rate / 100)));
              } else if (esRH) {
                  egFormBase += m;
              }
          }
      });

      // Retiros (Independientes, no afectan a Operativa global)
      let ingresoExtraFormal = 0;
      retiros.forEach(ret => {
          const f = ret.fechaPago || '';
          if (inRange(f)) {
              const m = Number(String(ret.monto).replace(/,/g, '')) || 0;
              
              if (ret.tipo === 'formal_neto') {
                  retiradoFormal += m;
                  gastadoFisicoBruto += m;
              } else if (ret.tipo === 'formal_impuesto') {
                  retiradoFormal += m; 
              } else if (ret.tipo === 'informal') {
                  retiradoInformal += m;
                  gastadoFisicoBruto += m;
              } else if (ret.tipo === 'cofre_renta' || ret.tipo === 'cofre_traslado') {
                  gastadoCofreMonto += m;
                  if (ret.tipo === 'cofre_renta') gastadoFisicoBruto += m; 
              } else if (ret.tipo === 'cofre_traslado_futuro') {
                  gastadoCofreMonto += m;
              } else if (ret.tipo === 'ingreso_excedente_renta') {
                  ingresoExtraFormal += m;
              }
          }
      });

      const igvAPagar = Math.max(0, igvCobrado - igvPagado);
      const factTotal = factBase + igvCobrado;

      // Sincronizando la matemática de Renta que se definió en Tributación
      const baseImponibleMensual = factTotal - igvAPagar;
      const renta1 = baseImponibleMensual * 0.01;
      const gastadoTotalFormalOperativo = gastadoOperativoTotal - egInfoOperativo;
      const utilidadBrutaFormal = baseImponibleMensual - gastadoTotalFormalOperativo;
      const reserva9_teorico = utilidadBrutaFormal > 0 ? (utilidadBrutaFormal * 0.09) : 0;
      const reserva9 = Math.max(0, reserva9_teorico - gastadoCofreMonto);

      const saldoFisicoFormalOperativo = factTotal - gastadoTotalFormalOperativo;
      const retencionesFormales = igvAPagar + renta1 + reserva9;
      
      const generadoLegal = saldoFisicoFormalOperativo - retencionesFormales + ingresoExtraFormal;
      let disponibleLegal = generadoLegal - retiradoFormal;
      
      const generadoInformal = ingInfo - egInfoOperativo;
      let disponibleInformal = generadoInformal - retiradoInformal;

      if (disponibleLegal < 0) {
          disponibleInformal += disponibleLegal;
          disponibleLegal = 0;
      } else if (disponibleInformal < 0) {
          disponibleLegal += disponibleInformal;
          disponibleInformal = 0;
      }

      return {
          recTotal, gastadoTotal: gastadoFisicoBruto, 
          generadoLegal, retiradoLegal: retiradoFormal, disponibleLegal,
          generadoInformal, retiradoInformal, disponibleInformal, reserva9,
          // Compatibilidad condicional (Mantenemos nombres para old references que no sean rediseñados si los hay)
          utilidadLegalLimpia: disponibleLegal,
          utilidadInformalLimpia: disponibleInformal
      };
  };

  const mesesInfo = [
      { num: '01', nombre: 'Enero' }, { num: '02', nombre: 'Febrero' }, { num: '03', nombre: 'Marzo' }, 
      { num: '04', nombre: 'Abril' }, { num: '05', nombre: 'Mayo' }, { num: '06', nombre: 'Junio' }, 
      { num: '07', nombre: 'Julio' }, { num: '08', nombre: 'Agosto' }, { num: '09', nombre: 'Septiembre' }, 
      { num: '10', nombre: 'Octubre' }, { num: '11', nombre: 'Noviembre' }, { num: '12', nombre: 'Diciembre' }
  ];

  const openPaymentModal = (modo, maxAmount, monthName) => {
      setDivMode(modo);
      setDivData({ socioId: '', monto: '', maxMonto: maxAmount, rangoText: monthName, fechaManual: new Date().toISOString().slice(0, 10) });
      setIsDivModalOpen(true);
  };

  const handleRetiroSubmit = async (e) => {
      e.preventDefault();
      if ((divMode !== 'formal' && !divData.socioId) || !divData.monto) return;
      const amount = Number(divData.monto);
      if (amount <= 0) return alert("Monto inválido");
      if (amount > divData.maxMonto) {
          alert(`El monto solicitado (S/ ${amount}) SUPERA el Fondo ${divMode === 'formal' ? 'Legal' : 'Informal'} disponible (S/ ${divData.maxMonto.toFixed(2)}). No puedes retirar más del saldo permitido.`);
          return;
      }

      const socioEncontrado = divData.socioId ? socios.find(s => s.id === divData.socioId) : null;
      const nombreSocio = socioEncontrado ? socioEncontrado.nombres : 'Socio Desconocido';
      const customDateStr = new Date(`${divData.fechaManual}T12:00:00.000Z`).toISOString();
      
      if (divMode === 'formal') {
          const netoTotal = amount * 0.95;
          const imp = amount * 0.05;
          try {
              const distribucionPdfData = [];
              const baseData = { fechaPago: customDateStr, origenPeriodo: divData.rangoText };

              // SUNAT Doc
              await addDoc(collection(db, 'retiros_caja'), {
                  tipo: 'formal_impuesto', concepto: `Retención 5% IR Dividendos (SUNAT)`, monto: imp.toFixed(2), ...baseData
              });

              // Socios Docs
              for (const socio of socios) {
                  const cut = netoTotal * (socio.porcentaje / 100);
                  if (cut > 0) {
                      await addDoc(collection(db, 'retiros_caja'), {
                          tipo: 'formal_neto', concepto: `Pago Dividendos (95% Neto): ${socio.nombres}`, monto: cut.toFixed(2), socioId: socio.id, ...baseData
                      });
                      distribucionPdfData.push([socio.nombres, `${socio.porcentaje}%`, `S/ ${cut.toFixed(2)}`]);
                  }
              }

              // PDF Generation
              const docPdf = new jsPDF();
              const pageWidth = docPdf.internal.pageSize.getWidth();
              
              // ---------------- ESTÉTICA HEADER (VINDEX LEGAL GROUP) ----------------
              docPdf.setFillColor(15, 23, 42); // slate-900 oscuro
              docPdf.rect(0, 0, pageWidth, 28, 'F');
              
              docPdf.setTextColor(255, 255, 255);
              docPdf.setFontSize(22);
              docPdf.setFont("helvetica", "bold");
              docPdf.text("VINDEX", 15, 19);
              
              docPdf.setFontSize(9);
              docPdf.setFont("helvetica", "normal");
              docPdf.text("LEGAL GROUP", 47, 19);
              
              docPdf.setTextColor(234, 179, 8); // Gold
              docPdf.setFontSize(12);
              docPdf.setFont("helvetica", "bold");
              docPdf.text('CONSTANCIA DE DIVIDENDOS', pageWidth - 15, 19, { align: 'right' });
              
              docPdf.setTextColor(30, 41, 59);
              docPdf.setFontSize(11);
              docPdf.setFont("helvetica", "bold");
              docPdf.text(`ORIGEN DE FONDO: ${divData.rangoText}`, 15, 40);
              
              docPdf.setFontSize(9);
              docPdf.setFont("helvetica", "normal");
              docPdf.text(`Generado el: ${divData.fechaManual}`, pageWidth - 15, 40, { align: 'right' });
              // ----------------------------------------------------------------------

              autoTable(docPdf, {
                  startY: 48,
                  head: [['Concepto', 'Descripción', 'Monto']],
                  body: [
                      ['Fondo Bruto Extraído', 'Total autorizado para distribución', `S/ ${amount.toFixed(2)}`],
                      ['Retención SUNAT (5%)', 'Impuesto a la Renta por Dividendos', `S/ ${imp.toFixed(2)}`],
                      ['Monto Neto a Distribuir', 'El 95% libre entre los socios', `S/ ${netoTotal.toFixed(2)}`]
                  ],
                  headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
                  alternateRowStyles: { fillColor: [248, 250, 252] }
              });

              autoTable(docPdf, {
                  startY: docPdf.lastAutoTable.finalY + 10,
                  head: [['Socio Beneficiario', 'Participación', 'Monto a Depositar']],
                  body: distribucionPdfData,
                  headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
                  alternateRowStyles: { fillColor: [248, 250, 252] }
              });

              docPdf.save(`Comprobante_Dividendos_${new Date().getTime()}.pdf`);

              setDivData({ socioId: '', monto: '', maxMonto: 0, rangoText: '', fechaManual: new Date().toISOString().slice(0, 10) });
              setIsDivModalOpen(false);
          } catch(e) { console.error(e); alert('Error en la operación'); }
      } else {
          try {
              await addDoc(collection(db, 'retiros_caja'), {
                  tipo: 'informal', concepto: `Retiro Informal Directo: ${nombreSocio}`, monto: amount.toFixed(2), socioId: divData.socioId, fechaPago: customDateStr, origenPeriodo: divData.rangoText
              });
              setDivData({ socioId: '', monto: '', maxMonto: 0, rangoText: '', fechaManual: new Date().toISOString().slice(0, 10) });
              setIsDivModalOpen(false);
          } catch(e) { console.error(e); alert('Error'); }
      }
  };

  const openCofreAction = (tipo, maxMonto, walletData) => {
      const deuda = tipo === 'renta' ? calcDeudaAnual(walletData.anio) : 0;
      setCofreActionData({ 
          tipo, 
          monto: '', 
          maxMonto, 
          rangoText: `${walletData.mes} ${walletData.anio}`,
          anioVal: walletData.anio,
          deudaVal: deuda
      });
      setRentaWizardStep(1);
      setIsCofreActionOpen(true);
      setWalletModalData(null); 
  };

  const handleWizardSubmit = async (modo) => {
      try {
          const debt = cofreActionData.deudaVal;
          const cofreDisp = cofreActionData.maxMonto;
          const nextYear = String(Number(cofreActionData.anioVal) + 1);
          const nextYearDateStr = `${nextYear}-04-01T12:00:00.000Z`;

          if (modo === 'pagar_solo') {
              await addDoc(collection(db, 'retiros_caja'), {
                  tipo: 'cofre_renta', concepto: `Pago Renta Anual SUNAT desde Cofre`, monto: debt.toFixed(2), fechaPago: new Date().toISOString(), origenPeriodo: cofreActionData.rangoText
              });
          } else if (modo === 'pagar_y_trasladar') {
              await addDoc(collection(db, 'retiros_caja'), {
                  tipo: 'cofre_renta', concepto: `Pago Renta Anual SUNAT desde Cofre`, monto: debt.toFixed(2), fechaPago: new Date().toISOString(), origenPeriodo: cofreActionData.rangoText
              });
              await addDoc(collection(db, 'retiros_caja'), {
                  tipo: 'cofre_traslado_futuro', concepto: `Excedente vaciado para traslado al año siguiente`, monto: (cofreDisp - debt).toFixed(2), fechaPago: new Date().toISOString(), origenPeriodo: cofreActionData.rangoText
              });
              await addDoc(collection(db, 'retiros_caja'), {
                  tipo: 'ingreso_excedente_renta', concepto: `Excedente Libre de Renta del Año ${cofreActionData.anioVal}`, monto: (cofreDisp - debt).toFixed(2), fechaPago: nextYearDateStr, origenPeriodo: cofreActionData.rangoText
              });
          } else if (modo === 'pagar_con_utilidad') {
              if (cofreDisp > 0) {
                 await addDoc(collection(db, 'retiros_caja'), {
                     tipo: 'cofre_renta', concepto: `Vaciado Total Cofre - Pago Renta SUNAT Parcial`, monto: cofreDisp.toFixed(2), fechaPago: new Date().toISOString(), origenPeriodo: cofreActionData.rangoText
                 });
              }
              const faltante = debt - cofreDisp;
              await addDoc(collection(db, 'retiros_caja'), {
                 tipo: 'formal_neto', concepto: `Cobertura a Favor de Renta Anual SUNAT (Faltante)`, monto: faltante.toFixed(2), fechaPago: new Date().toISOString(), origenPeriodo: cofreActionData.rangoText, socioId: 'SUNAT'
              });
          }
          setIsCofreActionOpen(false);
      } catch(e) { console.error(e); alert('Error ejecutando Asistente de Renta'); }
  };

  const handleCofreSubmit = async (e) => {
      e.preventDefault();
      const amount = Number(cofreActionData.monto);
      if (amount <= 0 || amount > cofreActionData.maxMonto) return alert("Monto inválido o superior al límite del cofre.");
      
      try {
          if (cofreActionData.tipo === 'renta') {
              await addDoc(collection(db, 'retiros_caja'), {
                  tipo: 'cofre_renta', concepto: `Pago Renta Anual SUNAT desde Cofre`, monto: Number(cofreActionData.monto).toFixed(2), fechaPago: new Date().toISOString(), origenPeriodo: cofreActionData.rangoText
              });
          } else {
              await addDoc(collection(db, 'retiros_caja'), {
                  tipo: 'cofre_traslado', concepto: `Traslado de Cofre a Utilidad Formal`, monto: Number(cofreActionData.monto).toFixed(2), fechaPago: new Date().toISOString(), origenPeriodo: cofreActionData.rangoText
              });
          }
          setIsCofreActionOpen(false);
      } catch(err) { alert(err.message); }
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
       <div className="flex flex-col md:flex-row items-center justify-between border-b border-brand-200 dark:border-slate-800 pb-4 shrink-0 gap-3">
          <h1 className="text-2xl font-black text-brand-900 dark:text-white flex items-center gap-2">
            <Landmark className="text-emerald-500" size={28}/> Flujo de Caja Corporativa
          </h1>
          <div className="flex items-center gap-3">
             <div className="bg-brand-900 dark:bg-slate-700 text-white p-2 rounded-xl shadow-sm flex items-center gap-2 px-4 shadow-sm">
                 <CalendarDays size={16}/>
                 <span className="font-bold text-xs uppercase tracking-wider">Caja Mensual (Año)</span>
              </div>
          </div>
       </div>

       {activeTab === 'operativa' && (() => {
           const anioMetrics = calcFondos(anioCaja, 'anio');
           const saldoLiquido = anioMetrics.disponibleLegal + anioMetrics.disponibleInformal;

           const movimientosGenerados = (() => {
               let list = [];
               mesesInfo.forEach(mes => {
                   const metrics = calcFondos(`${anioCaja}-${mes.num}`, 'mes');
                   const isCurrentMonth = new Date().toISOString().slice(5,7) === mes.num;
                   if (metrics.recTotal === 0 && metrics.gastadoTotal === 0 && !isCurrentMonth) return;
                   
                   const fpDate = new Date(anioCaja, Number(mes.num) - 1, 28, 12, 0, 0).toISOString();
                   
                   if (metrics.generadoLegal !== 0 && Math.abs(metrics.generadoLegal) > 0.01) {
                       list.push({
                           id: `v-leg-${mes.num}`,
                           tipo: metrics.generadoLegal > 0 ? 'ingreso' : 'egreso',
                           titulo: `Utilidad Formal`,
                           subtitulo: metrics.generadoLegal > 0 ? `Abono Mensual Calculado • ${mes.nombre}` : `Pérdida Mensual Calculada • ${mes.nombre}`,
                           monto: Math.abs(metrics.generadoLegal),
                           fecha: fpDate,
                       });
                   }
                   if (metrics.generadoInformal !== 0 && Math.abs(metrics.generadoInformal) > 0.01) {
                       list.push({
                           id: `v-inf-${mes.num}`,
                           tipo: metrics.generadoInformal > 0 ? 'ingreso' : 'egreso',
                           titulo: `Utilidad Informal`,
                           subtitulo: metrics.generadoInformal > 0 ? `Abono Mensual Calculado • ${mes.nombre}` : `Pérdida Mensual Calculada • ${mes.nombre}`,
                           monto: Math.abs(metrics.generadoInformal),
                           fecha: fpDate,
                       });
                   }
                   if (metrics.reserva9 > 0) {
                       list.push({
                           id: `v-cof-${mes.num}`,
                           tipo: 'neutro',
                           titulo: `Cofre Intocable (9%)`,
                           subtitulo: `Depósito Contingencia • ${mes.nombre}`,
                           monto: metrics.reserva9,
                           fecha: fpDate,
                       });
                   }
               });

               retiros.forEach(r => {
                   if ((r.fechaPago || '').startsWith(anioCaja)) {
                       let titulo = r.concepto || 'Retiro de Caja';
                       if (r.tipo === 'cofre_renta' || r.tipo === 'pago_renta_utilidad') titulo = 'Pago Renta Anual SUNAT';
                       
                       list.push({
                           id: r.id,
                           tipo: r.tipo.includes('excedente') ? 'ingreso_extra' : 'egreso',
                           titulo: titulo,
                           subtitulo: `Extracto ${r.origenPeriodo || 'Global'} • ${(new Date(r.fechaPago || '').toLocaleString('es-PE', {day:'2-digit', month:'short', year:'numeric', hour:'numeric', minute:'2-digit'}).replace(',', ' - '))} `,
                           monto: Number(r.monto),
                           fecha: r.fechaPago || '',
                       });
                   }
               });

               list.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

               // Group by month
               const grouped = [];
               let currentMonth = '';
               let currentMonthTotal = 0;
               let currentMonthItems = [];

               list.forEach(mov => {
                   const fechaObj = new Date(mov.fecha);
                   const monthName = fechaObj.toLocaleString('es-PE', { month:'long', year:'numeric' }).toUpperCase();
                   
                   if (monthName !== currentMonth) {
                       if (currentMonth !== '') {
                           grouped.push({ type: 'header', titulo: currentMonth, suma: currentMonthTotal });
                           grouped.push(...currentMonthItems);
                       }
                       currentMonth = monthName;
                       currentMonthTotal = 0;
                       currentMonthItems = [];
                   }
                   
                   if (mov.tipo === 'egreso') currentMonthTotal -= mov.monto;
                   else currentMonthTotal += mov.monto;
                   
                   currentMonthItems.push({ ...mov, isItem: true });
               });
               if (currentMonth !== '') {
                   grouped.push({ type: 'header', titulo: currentMonth, suma: currentMonthTotal });
                   grouped.push(...currentMonthItems);
               }

               return grouped;
           })();

           const downloadExtractReport = () => {
              const doc = new jsPDF();
              const pageWidth = doc.internal.pageSize.getWidth();
              
              // ---------------- ESTÉTICA HEADER (VINDEX LEGAL GROUP) ----------------
              doc.setFillColor(15, 23, 42); // slate-900 oscuro
              doc.rect(0, 0, pageWidth, 28, 'F');
              
              doc.setTextColor(255, 255, 255);
              doc.setFontSize(22);
              doc.setFont("helvetica", "bold");
              doc.text("VINDEX", 15, 19);
              
              doc.setFontSize(9);
              doc.setFont("helvetica", "normal");
              doc.text("LEGAL GROUP", 47, 19);
              
              doc.setTextColor(234, 179, 8); // Gold
              doc.setFontSize(12);
              doc.setFont("helvetica", "bold");
              doc.text('ESTADO DE CUENTA BANCARIO', pageWidth - 15, 19, { align: 'right' });
              
              doc.setTextColor(30, 41, 59);
              doc.setFontSize(11);
              doc.setFont("helvetica", "bold");
              doc.text(`EJERCICIO FINANCIERO: AÑO ${anioCaja}`, 15, 40);
              
              doc.setFontSize(9);
              doc.setFont("helvetica", "normal");
              doc.text(`Generado el: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - 15, 40, { align: 'right' });
              // ----------------------------------------------------------------------
              
              // Resumen general autoTable
              autoTable(doc, {
                  startY: 48,
                  head: [['Resumen Directo de Caja Fuerte', 'Total Acumulado']],
                  body: [
                      ['Fondo Contable Legal (Formal)', formatCurrency(anioMetrics.disponibleLegal)],
                      ['Fondo Comercial Activo (Informal)', formatCurrency(anioMetrics.disponibleInformal)],
                      ['Pre-Fondo Reserva Renta (Cofre Fijo)', formatCurrency(anioMetrics.reserva9)],
                      ['Saldo Vivo Consolidado', formatCurrency(saldoLiquido + anioMetrics.reserva9)]
                  ],
                  headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
                  alternateRowStyles: { fillColor: [248, 250, 252] }
              });

              // Extracto Histórico
              const bodyMovimientos = [];
              movimientosGenerados.forEach(item => {
                  if (item.type === 'header') {
                      bodyMovimientos.push([{ content: `--- ${item.titulo} (Balance Mes: ${formatCurrency(item.suma)}) ---`, colSpan: 4, styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [71, 85, 105], halign: 'center' } }]);
                  } else {
                      bodyMovimientos.push([
                          item.fecha.slice(0, 10),
                          item.titulo,
                          item.tipo === 'ingreso' ? 'Abono / Depósito' : 'Cargo / Retiro',
                          formatCurrency(item.monto)
                      ]);
                  }
              });

              autoTable(doc, {
                  startY: doc.lastAutoTable.finalY + 10,
                  head: [['Fecha Operación', 'Detalle de Movimiento', 'Tipo de Operación', 'Importe Neto']],
                  body: bodyMovimientos,
                  headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
                  alternateRowStyles: { fillColor: [248, 250, 252] }
              });

              doc.save(`Estado_de_Cuenta_VINDEX_${anioCaja}.pdf`);
           };

           return (
               <div className="flex flex-col xl:flex-row gap-8 items-start animate-in slide-in-from-bottom-2 duration-300 w-full max-w-[1400px] mx-auto">
                   
                   {/* COLUMN 1: BANK STATEMENT (70% width on large screens) */}
                   <div className="w-full xl:w-[65%] flex flex-col space-y-6">
                       <div className="flex bg-white dark:bg-slate-900 border border-brand-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl shadow-brand-900/10 flex-col w-full relative z-10">
                           <div className="bg-brand-900 dark:bg-slate-950 p-6 md:p-8 pt-8 md:pt-10 text-white text-center rounded-b-3xl relative overflow-hidden shadow-sm z-10 border-b-4 border-brand-800">
                               <div className="absolute top-0 right-0 p-4 md:p-8 opacity-5 blur-[2px]"><Landmark size={150}/></div>
                               <p className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-300 mb-2 relative z-20">Balance General {anioCaja}</p>
                               <h2 className="text-4xl md:text-6xl font-black mb-1 clash-display tracking-tight relative z-20">
                                    {hideSaldo ? 'S/ ••••••' : formatCurrency(saldoLiquido)}
                               </h2>
                               <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-400/80 tracking-widest relative z-20 mt-1 uppercase">
                                  Suma total de fondos (Incluyendo Cofre): {hideSaldo ? '***' : formatCurrency(saldoLiquido + anioMetrics.reserva9)}
                               </p>
                               
                               <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 mb-6 relative z-20 text-[11px] font-bold tracking-widest text-brand-200">
                                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Formal: {hideSaldo ? '***' : formatCurrency(anioMetrics.disponibleLegal)}</span>
                                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Informal: {hideSaldo ? '***' : formatCurrency(anioMetrics.disponibleInformal)}</span>
                                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-400"></div> Cofre: {hideSaldo ? '***' : formatCurrency(anioMetrics.reserva9)}</span>
                               </div>

                               <div className="flex items-center justify-center gap-3 relative z-20 mt-4">
                                   <button onClick={() => setHideSaldo(!hideSaldo)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-200 hover:text-white transition-colors bg-brand-800/50 border border-brand-700/50 px-4 py-2 rounded-xl shadow-sm">
                                       {hideSaldo ? <Eye size={16}/> : <EyeOff size={16}/>}
                                       {hideSaldo ? 'Mostrar saldos' : 'Ocultar saldos'}
                                   </button>
                                   <button onClick={downloadExtractReport} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-900 transition-colors bg-white hover:bg-slate-200 border border-brand-700/50 px-4 py-2 rounded-xl shadow-md">
                                       <Download size={16}/> Descargar
                                   </button>
                               </div>
                           </div>
                           
                           <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center border-b border-brand-100 dark:border-slate-800">
                               <button onClick={() => setHideMovimientos(!hideMovimientos)} className="flex items-center gap-2 text-sm font-black text-brand-700 dark:text-brand-300 w-full justify-between px-2">
                                   <div className="flex items-center gap-2 uppercase tracking-wide">
                                      <ListMinus size={18}/> {hideMovimientos ? 'Mostrar Extracto Bancario' : 'Ocultar Extracto Bancario'}
                                   </div>
                                   {hideMovimientos ? <ChevronDown size={20}/> : <ChevronUp size={20}/>}
                               </button>
                           </div>

                           {!hideMovimientos && (
                               <div className="flex flex-col bg-white dark:bg-slate-900 pb-2">
                                   {movimientosGenerados.length === 0 ? (
                                       <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No hay movimientos registrados.</div>
                                   ) : movimientosGenerados.map((item, i) => {
                                       if (item.type === 'header') {
                                           return (
                                               <div key={'h-'+i} className="bg-slate-100 dark:bg-slate-800/80 border-y border-slate-200 dark:border-slate-700 px-4 md:px-6 py-2 flex justify-between items-center sticky top-0 z-10 shadow-sm backdrop-blur-md">
                                                   <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{item.titulo}</span>
                                                   <span className={`text-[11px] font-black uppercase tracking-widest ${item.suma < 0 ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                                       {hideSaldo ? '***' : formatCurrency(item.suma)}
                                                   </span>
                                               </div>
                                           );
                                       }
                                       return (
                                           <div 
                                               key={item.id + i} 
                                               className={`flex justify-between items-center px-4 md:px-6 py-4 md:py-5 border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200`}
                                           >
                                               <div className="flex flex-col gap-0.5">
                                                   <span className={`text-[14px] font-black tracking-tight ${item.tipo === 'egreso' ? 'text-slate-700 dark:text-slate-300' : 'text-emerald-900 dark:text-emerald-400'}`}>
                                                       {item.titulo}
                                                   </span>
                                                   <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                       {item.subtitulo}
                                                   </span>
                                               </div>
                                               <div className={`text-base font-black whitespace-nowrap ${item.tipo === 'egreso' ? 'text-red-500' : (item.tipo === 'neutro' ? 'text-blue-500' : 'text-emerald-600')}`}>
                                                   {hideSaldo ? '***' : `${item.tipo==='egreso'?'-':'+'} ${formatCurrency(item.monto)}`}
                                               </div>
                                           </div>
                                       );
                                   })}
                               </div>
                           )}
                       </div>
                   </div>
                   {/* COLUMN 2: ACTION BUTTONS (35% width on large screens) */}
                   <div className="w-full xl:w-[35%] flex flex-col gap-4 xl:sticky xl:top-6 pb-6">
                       <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-3xl p-5 border border-emerald-100 dark:border-emerald-900/50 text-center flex flex-col hover:border-emerald-300 transition-all shadow-sm">
                           <span className="text-[10px] font-black uppercase text-emerald-600 block mb-1.5 tracking-[0.1em]">Utilidad Formal Libre</span>
                           <div className="flex-1 flex flex-col justify-center">
                               <p className={`font-black text-3xl lg:text-4xl tracking-tight mb-3 ${anioMetrics.disponibleLegal < 0 ? 'text-red-500' : 'text-teal-800 dark:text-teal-400'}`}>
                                  {hideSaldo ? '***' : formatCurrency(anioMetrics.disponibleLegal)}
                               </p>
                           </div>
                           <button 
                               disabled={anioMetrics.disponibleLegal <= 0}
                               onClick={() => openPaymentModal('formal', anioMetrics.disponibleLegal, `${anioCaja} (Acumulado Anual)`)} 
                               className={`text-[11px] font-black uppercase tracking-widest w-full py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 ${anioMetrics.disponibleLegal > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                           >
                               <Briefcase size={16}/> {anioMetrics.disponibleLegal > 0 ? 'Retirar Dividendos' : 'Fondo Vacío'}
                           </button>
                       </div>

                       <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-3xl p-5 border border-amber-100 dark:border-amber-900/50 text-center flex flex-col hover:border-amber-300 transition-all shadow-sm">
                           <span className="text-[10px] font-black uppercase text-amber-600 block mb-1.5 tracking-[0.1em]">Utilidad Informal Libre</span>
                           <div className="flex-1 flex flex-col justify-center">
                               <p className={`font-black text-3xl lg:text-4xl tracking-tight mb-3 ${anioMetrics.disponibleInformal < 0 ? 'text-red-500' : 'text-amber-700 dark:text-amber-500'}`}>
                                  {hideSaldo ? '***' : formatCurrency(anioMetrics.disponibleInformal)}
                               </p>
                           </div>
                           <button 
                               disabled={anioMetrics.disponibleInformal <= 0}
                               onClick={() => openPaymentModal('informal', anioMetrics.disponibleInformal, `${anioCaja} (Acumulado Anual)`)} 
                               className={`text-[11px] font-black uppercase tracking-widest w-full py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 ${anioMetrics.disponibleInformal > 0 ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                           >
                               <TrendingUp size={16}/> {anioMetrics.disponibleInformal > 0 ? 'Retiro Directo' : 'Fondo Vacío'}
                           </button>
                       </div>

                       <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-3xl p-5 border border-blue-100 dark:border-blue-900/50 text-center flex flex-col hover:border-blue-300 transition-all shadow-sm">
                           <span className="text-[10px] font-black uppercase text-blue-600 block mb-1.5 tracking-[0.1em]">Cofre Reserva (9%)</span>
                           <div className="flex-1 flex flex-col justify-center">
                               <p className={`font-black text-3xl lg:text-4xl tracking-tight mb-3 text-blue-800 dark:text-blue-400`}>
                                  {hideSaldo ? '***' : formatCurrency(anioMetrics.reserva9)}
                               </p>
                           </div>
                           <div className="grid grid-cols-2 gap-2.5">
                               <button 
                                   disabled={anioMetrics.reserva9 <= 0}
                                   onClick={() => openCofreAction('renta', anioMetrics.reserva9, { mes: 'Acumulado Anual', anio: anioCaja, metrics: anioMetrics })} 
                                   className={`text-[9px] font-black uppercase tracking-[0.1em] w-full py-2 rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${anioMetrics.reserva9 > 0 ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                               >
                                   <AlertTriangle size={14}/> Pagar Renta
                               </button>
                               <button 
                                   disabled={anioMetrics.reserva9 <= 0}
                                   onClick={() => openCofreAction('traslado', anioMetrics.reserva9, { mes: 'Acumulado Anual', anio: anioCaja, metrics: anioMetrics })} 
                                   className={`text-[9px] font-black uppercase tracking-[0.1em] w-full py-2 rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${anioMetrics.reserva9 > 0 ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                               >
                                   <ArrowUpCircle size={14}/> A Formal
                               </button>
                           </div>
                       </div>
                       
                       <div className="flex flex-col gap-3 bg-brand-50/50 dark:bg-slate-900/40 p-4 rounded-3xl border border-brand-200 dark:border-slate-800 w-full relative z-0 mt-1">
                         <div className="flex flex-col items-center gap-2 w-full">
                             <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest flex items-center gap-1 w-full justify-center">
                                 <CalendarDays size={14}/> Histórico:
                             </span>
                             <select 
                                 value={anioCaja} 
                                 onChange={e => setAnioCaja(e.target.value)}
                                 className="bg-brand-100 dark:bg-slate-800 border-2 border-brand-200 dark:border-slate-700 text-brand-900 dark:text-white font-black px-4 py-1.5 rounded-xl focus:ring-4 focus:ring-brand-500/20 outline-none transition-all shadow-sm w-full text-center text-sm"
                             >
                                 {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
                             </select>
                         </div>
                         <button 
                             onClick={() => setIsHistoryModalOpen(true)}
                             className="bg-brand-900 hover:bg-brand-800 text-white text-[9px] font-black uppercase tracking-widest px-3 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 w-full mt-1"
                         >
                             <AlertTriangle size={14}/> Ver Historial / Corrección
                         </button>
                      </div>
                   </div>
               </div>
           );
       })()}



      {/* MODAL DE LIQUIDACIÓN / PAGOS */}
      {isDivModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md transition-all animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-950 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-brand-200 dark:border-slate-800 transform transition-all scale-100">
            <div className={`border-b p-6 text-center ${divMode === 'formal' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30' : 'bg-amber-50 border-amber-100 dark:bg-amber-950/30'}`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border-4 ${divMode === 'formal' ? 'bg-white border-emerald-50 text-emerald-600 dark:bg-emerald-900/50' : 'bg-white border-amber-50 text-amber-600 dark:bg-amber-900/50'}`}>
                {divMode === 'formal' ? <Briefcase size={32} /> : <TrendingUp size={32}/>}
              </div>
              <h3 className={`text-xl font-black tracking-tight ${divMode === 'formal' ? 'text-emerald-900 dark:text-emerald-300' : 'text-amber-900 dark:text-amber-300'}`}>
                {divMode === 'formal' ? 'Distribución de Dividendos' : 'Retiro Estructural Diario'}
              </h3>
              <p className={`text-sm font-bold mt-1 uppercase tracking-wider ${divMode === 'formal' ? 'text-emerald-700/80 dark:text-emerald-500' : 'text-amber-700/80 dark:text-amber-500'}`}>Extracción de: {divData.rangoText}</p>
            </div>
            
            <form onSubmit={handleRetiroSubmit} className="p-6 pb-8 space-y-4 text-left">
               {divMode !== 'formal' && (
                 <div>
                    <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Cuenta Destino (Socio)</label>
                    <select required value={divData.socioId} onChange={e => setDivData({...divData, socioId: e.target.value})} className="w-full border-2 border-brand-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-4 outline-none transition-all text-sm font-bold bg-white dark:bg-slate-900 text-brand-900 dark:text-white">
                      <option value="">Selecciona al socio de la mesa...</option>
                      {socios.map(s => <option key={s.id} value={s.id}>{s.nombres} - {s.documento}</option>)}
                    </select>
                 </div>
               )}
               <div className="grid grid-cols-2 gap-4">
                   <div>
                      <div className="flex justify-between items-end mb-1.5 text-[10px] uppercase font-bold tracking-widest">
                         <span className="text-brand-500">Monto A Girar</span>
                      </div>
                      <input required type="number" step="0.01" min="1" value={divData.monto} onChange={e => setDivData({...divData, monto: e.target.value})} className="w-full text-center border-2 border-brand-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-lg font-black bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-4 transition-all" placeholder="0.00" />
                   </div>
                   <div>
                      <div className="flex justify-between items-end mb-1.5 text-[10px] uppercase font-bold tracking-widest">
                         <span className="text-brand-500">Fecha Efectiva</span>
                      </div>
                      <input required type="date" value={divData.fechaManual} onChange={e => setDivData({...divData, fechaManual: e.target.value})} className="w-full text-center border-2 border-brand-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-lg font-black bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-4 transition-all" />
                   </div>
               </div>
               <div className="flex justify-end -mt-2 mb-2"><span className="text-[10px] font-bold uppercase tracking-widest text-brand-400">Max Autorizado: S/ {divData.maxMonto?.toFixed(2)}</span></div>

               {divMode === 'formal' && Number(divData.monto) > 0 && (
                   <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mt-2 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center text-xs py-1">
                            <span className="font-bold text-slate-500 dark:text-slate-400">Póliza SUNAT (Retención Segunda - 5%)</span>
                            <span className="font-black text-amber-600">S/ {(Number(divData.monto) * 0.05).toFixed(2)}</span>
                        </div>
                        
                        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] uppercase font-bold text-emerald-600 mb-2 tracking-widest text-center">Desglose de Pago (95%)</p>
                            {socios.map(socio => {
                                const cut = (Number(divData.monto) * 0.95) * (socio.porcentaje / 100);
                                if (cut <= 0) return null;
                                return (
                                   <div key={`socio-dist-${socio.id}`} className="flex justify-between items-center text-xs mb-1.5 opacity-90">
                                       <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                          <Users size={12}/> {socio.nombres} ({socio.porcentaje}%)
                                       </span>
                                       <span className="font-black text-emerald-700 dark:text-emerald-400">S/ {cut.toFixed(2)}</span>
                                   </div>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-slate-400 text-center font-bold italic pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                           *Se generará constancia PDF y {socios.filter(s => s.porcentaje > 0).length + 1} descargas contables automáticamente en la caja bancaria.
                        </p>
                   </div>
               )}
               
               <div className="mt-8 flex items-center gap-3 pt-2">
                 <button type="button" onClick={() => setIsDivModalOpen(false)} className="flex-1 px-4 py-3 text-brand-600 font-bold text-xs uppercase hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                 <button type="submit" className={`flex-1 text-white font-black text-xs uppercase py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 ${divMode === 'formal' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30' : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/30'}`}>
                    <CheckCircle size={16}/> Confirmar Operación
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}



      {/* MODAL ACCIONES COFRE */}
      {isCofreActionOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm transition-all animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-950 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-brand-200 dark:border-slate-800 transform transition-all scale-100">
            <div className={`border-b p-6 text-center ${cofreActionData.tipo === 'renta' ? 'bg-blue-50 border-blue-100 dark:bg-blue-950/30' : 'bg-indigo-50 border-indigo-100 dark:bg-indigo-950/30'}`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border-4 ${cofreActionData.tipo === 'renta' ? 'bg-white border-blue-50 text-blue-600 dark:bg-blue-900/50' : 'bg-white border-indigo-50 text-indigo-600 dark:bg-indigo-900/50'}`}>
                {cofreActionData.tipo === 'renta' ? <AlertTriangle size={32} /> : <ArrowUpCircle size={32}/>}
              </div>
              <h3 className={`text-xl font-black tracking-tight ${cofreActionData.tipo === 'renta' ? 'text-blue-900 dark:text-blue-300' : 'text-indigo-900 dark:text-indigo-300'}`}>
                {cofreActionData.tipo === 'renta' ? 'Liquidador Anual SUNAT' : 'Traslado a Utilidad Formal'}
              </h3>
              <p className={`text-sm font-bold mt-1 uppercase tracking-wider ${cofreActionData.tipo === 'renta' ? 'text-blue-700/80 dark:text-blue-500' : 'text-indigo-700/80 dark:text-indigo-500'}`}>Periodo de Operación: {cofreActionData.rangoText}</p>
            </div>
            
            <div className="p-6 pb-8">
               {cofreActionData.tipo === 'traslado' && (
                 <form onSubmit={handleCofreSubmit} className="space-y-4">
                    <div>
                       <div className="flex justify-between items-end mb-1.5 text-[10px] uppercase font-bold tracking-widest">
                          <span className="text-brand-500">Monto A Operar</span>
                          <span className="text-brand-400">Disp. en Cofre: S/ {cofreActionData.maxMonto?.toFixed(2)}</span>
                       </div>
                       <input required type="number" step="0.01" min="1" max={cofreActionData.maxMonto} value={cofreActionData.monto} onChange={e => setCofreActionData({...cofreActionData, monto: e.target.value})} className="w-full text-center border-2 dark:border-slate-700 rounded-2xl px-4 py-4 text-2xl font-black bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-4 transition-all" placeholder="0.00" />
                    </div>
                    <p className="text-[10px] text-slate-500 text-center font-bold italic mt-4 px-4 leading-relaxed">
                        *El efectivo seguirá en el sistema bancario. Solo estamos recategorizando el fondo internamente para que esté disponible en tu bloque Legal.
                    </p>
                    <div className="mt-6 flex items-center gap-3 pt-2">
                      <button type="button" onClick={() => setIsCofreActionOpen(false)} className="flex-1 px-4 py-3 text-brand-600 font-bold text-xs uppercase hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                      <button type="submit" className="flex-1 text-white font-black text-xs uppercase py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30">
                         <CheckCircle size={16}/> Ejecutar
                      </button>
                    </div>
                 </form>
               )}

               {cofreActionData.tipo === 'renta' && rentaWizardStep === 1 && (
                 <div className="space-y-6 text-center">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                             <span className="text-[10px] font-black uppercase text-brand-500 block mb-1">Total en Cofre</span>
                             <span className="text-xl font-black">{formatCurrency(cofreActionData.maxMonto)}</span>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-200 dark:border-red-900/30">
                             <span className="text-[10px] font-black uppercase text-red-600 block mb-1">Deuda a Cancelar</span>
                             <span className="text-xl font-black text-red-600">{formatCurrency(cofreActionData.deudaVal)}</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setIsCofreActionOpen(false)} className="flex-1 px-4 py-3 text-brand-600 font-bold text-xs uppercase hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                      <button onClick={() => setRentaWizardStep(2)} className="flex-1 text-white font-black text-xs uppercase py-3 rounded-xl bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2">
                          Analizar Resolución <ArrowUpCircle size={14} className="rotate-90"/>
                      </button>
                    </div>
                 </div>
               )}

               {cofreActionData.tipo === 'renta' && rentaWizardStep === 2 && (
                 <div className="space-y-6 text-center animate-in slide-in-from-right-4">
                    {cofreActionData.maxMonto >= cofreActionData.deudaVal ? (
                        <>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                                <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest block mb-2">Excedente Libre a Favor</span>
                                <span className="text-4xl font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(cofreActionData.maxMonto - cofreActionData.deudaVal)}</span>
                                <p className="text-[10px] font-bold text-emerald-900/70 dark:text-emerald-500/80 mt-3 leading-relaxed">
                                    ¡Excelente! Tu cofre es suficiente. Traslada la diferencia hacia la utilidad disponible de ABRIL del siguiente año libre de impuestos para tus socios.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => handleWizardSubmit('pagar_y_trasladar')} className="w-full text-white font-black text-xs uppercase py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 shadow-lg flex justify-center items-center">
                                    Pagar Deuda y Trasladar Excedente
                                </button>
                                <button onClick={() => handleWizardSubmit('pagar_solo')} className="w-full text-slate-500 font-bold text-[10px] uppercase py-3 hover:bg-slate-50 rounded-xl">
                                    Solo Pagar Deuda (No Trasladar Ocurrente)
                                </button>
                                <button onClick={() => setRentaWizardStep(1)} className="mt-2 w-full text-slate-400 font-bold text-xs uppercase hover:text-slate-600 transition-colors flex items-center justify-center gap-1">
                                    Volver atrás
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-red-50 dark:bg-red-900/20 p-5 rounded-2xl border border-red-200 dark:border-red-800">
                                <span className="text-[10px] font-black uppercase text-red-600 tracking-widest block mb-2">Faltante Tributario</span>
                                <span className="text-4xl font-black text-red-700 dark:text-red-400">-{formatCurrency(cofreActionData.deudaVal - cofreActionData.maxMonto)}</span>
                                <p className="text-[10px] font-bold text-red-900/70 dark:text-red-500/80 mt-3 leading-relaxed">
                                    Debes vaciar todo el cofre y completar este faltante utilizando fondos directamente de la **Utilidad Legal Libre** de los socios.
                                </p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-3">
                                    <button onClick={() => setIsCofreActionOpen(false)} className="flex-1 text-slate-600 font-bold text-xs uppercase py-3 bg-slate-100 hover:bg-slate-200 rounded-xl">Cancelar</button>
                                    <button onClick={() => handleWizardSubmit('pagar_con_utilidad')} className="flex-1 text-white font-black text-[10px] uppercase py-3 rounded-xl bg-red-600 hover:bg-red-500 shadow-lg">
                                        Pagar con Utilidad Formal
                                    </button>
                                </div>
                                <button onClick={() => setRentaWizardStep(1)} className="w-full text-slate-400 font-bold text-xs uppercase hover:text-slate-600 transition-colors flex items-center justify-center gap-1">
                                    Volver atrás
                                </button>
                            </div>
                        </>
                    )}
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DE RETIROS */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm transition-all animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-brand-200 dark:border-slate-800">
             <div className="p-6 border-b border-brand-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-3xl">
                <div className="flex items-center gap-3">
                   <CalendarDays className="text-brand-500" size={24}/>
                   <div>
                       <h3 className="text-xl font-black text-brand-900 dark:text-white">Panel de Movimientos de Caja</h3>
                       <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mt-0.5">Gestión independiente del Periodo: {anioCaja}</p>
                   </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
             </div>
             
             <div className="p-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-900 flex-1 space-y-4">
                 {(() => {
                     const inRangeHistory = (fecha) => {
                         if (!fecha) return false;
                         return fecha.startsWith(anioCaja.toString());
                     };
                     const historicos = retiros.filter(r => inRangeHistory(r.fechaPago)).sort((a,b) => new Date(b.fechaPago) - new Date(a.fechaPago));
                     
                     if (historicos.length === 0) return (
                         <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-sm">No existen retiros ni acciones de cofre en este periodo.</div>
                     );

                     return historicos.map(r => {
                         let color = 'bg-slate-50 border-slate-200 text-slate-800';
                         let icon = <Banknote size={16}/>;
                         let flag = 'Operación';
                         
                         if(r.tipo === 'formal_neto') { color = 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-400'; icon = <Briefcase size={16}/>; flag = 'Dividendo 95%'; }
                         if(r.tipo === 'formal_impuesto') { color = 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-400'; icon = <Banknote size={16}/>; flag = 'Poliza SUNAT 5%'; }
                         if(r.tipo === 'informal') { color = 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-400'; icon = <TrendingUp size={16}/>; flag = 'Retiro Informal'; }
                         if(r.tipo === 'cofre_renta' || r.tipo === 'cofre_traslado') { color = 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-400'; icon = <AlertTriangle size={16}/>; flag = 'Acción de Cofre'; }

                         if (editingRetiroId === r.id) {
                             return (
                                 <div key={r.id} className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border shadow-sm ${color} transition-all`}>
                                     <div className="flex-1 space-y-3 md:space-y-0 md:flex md:gap-4 md:items-center w-full">
                                         <input 
                                             value={editRetiroData.concepto} 
                                             onChange={e => setEditRetiroData({...editRetiroData, concepto: e.target.value})} 
                                             className="border-2 border-brand-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-sm font-bold w-full md:w-1/2" 
                                             placeholder="Concepto de operación"
                                         />
                                         <input 
                                             type="number" step="0.01" 
                                             value={editRetiroData.monto} 
                                             onChange={e => setEditRetiroData({...editRetiroData, monto: e.target.value})} 
                                             className="border-2 border-brand-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-sm font-bold w-full md:w-1/4" 
                                             placeholder="Monto"
                                         />
                                         <input 
                                             type="date" 
                                             value={editRetiroData.fechaPago} 
                                             onChange={e => setEditRetiroData({...editRetiroData, fechaPago: e.target.value})} 
                                             className="border-2 border-brand-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-sm font-bold w-full md:w-1/4" 
                                         />
                                     </div>
                                     <div className="flex items-center gap-2 mt-4 md:mt-0 lg:ml-4 shrink-0 justify-end">
                                         <button onClick={() => setEditingRetiroId(null)} className="px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors">Cancelar</button>
                                         <button onClick={() => handleSaveEditRetiro(r.id)} className="px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-brand-600 text-white hover:bg-brand-500 transition-colors">Guardar</button>
                                     </div>
                                 </div>
                             );
                         }

                         return (
                             <div key={r.id} className={`flex flex-col xl:flex-row xl:items-center justify-between p-4 rounded-2xl border shadow-sm ${color} transition-all hover:shadow-md gap-4`}>
                                 <div className="flex items-start gap-4">
                                     <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm rounded-full shrink-0">
                                         {icon}
                                     </div>
                                     <div>
                                         <h4 className="font-black text-sm md:text-base leading-tight">{r.concepto}</h4>
                                         <div className="flex gap-3 text-[10px] font-bold uppercase tracking-widest mt-1.5 opacity-80">
                                            <span>FECHA: {(r.fechaPago || '').slice(0,10)}</span>
                                            <span>TIPO: {flag}</span>
                                         </div>
                                     </div>
                                 </div>
                                 <div className="flex items-center justify-between xl:justify-end gap-3 shrink-0 border-t xl:border-t-0 pt-3 xl:pt-0 border-current/20">
                                     <span className="font-black text-xl w-32 text-right mr-2">{formatCurrency(r.monto)}</span>
                                     <button 
                                        onClick={() => {
                                            setEditRetiroData({ concepto: r.concepto, monto: r.monto, fechaPago: (r.fechaPago||'').slice(0,10) });
                                            setEditingRetiroId(r.id);
                                        }}
                                        className="bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-600 hover:text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 shadow-sm"
                                     >
                                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg> Editar
                                     </button>
                                     <button 
                                        onClick={() => handleDeleteRetiro(r.id)}
                                        className="bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-600 hover:text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 shadow-sm"
                                     >
                                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                     </button>
                                 </div>
                             </div>
                         );
                     });
                 })()}
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
