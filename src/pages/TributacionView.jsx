import React, { useState, useEffect } from 'react';
import { subscribeToIngresos, subscribeToEgresos, addEgreso } from '../utils/financeStorage';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Landmark, TrendingUp, TrendingDown, DollarSign, PieChart, ShieldCheck, AlertTriangle, Users, BookOpen, Briefcase, FileText, CheckCircle, ArrowRight, CornerDownRight, X, Info, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("TributacionView Error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 max-w-2xl mx-auto mt-20 bg-red-50 border border-red-200 rounded-3xl shadow-xl text-center">
          <AlertTriangle className="text-red-500 mx-auto w-16 h-16 mb-4" />
          <h2 className="text-2xl font-black text-red-900 mb-2">Error de Ejecución Interna</h2>
          <p className="text-red-700 font-bold text-sm mb-4">React ha detenido el módulo por seguridad debido al siguiente error detectado:</p>
          <div className="bg-red-900 text-red-100 p-4 rounded-xl text-left font-mono text-xs overflow-auto">
             {this.state.error?.message}
          </div>
          <p className="text-red-600 mt-4 text-xs font-bold">Por favor, copia este texto rojo y compártelo.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function TributacionViewContent() {
  const [ingresos, setIngresos] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [socios, setSocios] = useState([]);
  const [activeTab, setActiveTab] = useState('igv');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().toISOString().slice(0, 7));
  const [anioDashboard, setAnioDashboard] = useState(new Date().getFullYear().toString());
  const [desgloseView, setDesgloseView] = useState(null);
  const [matrizView, setMatrizView] = useState('ingresos');
  const { userData } = useAuth();
  useEffect(() => {
    const unsubIng = subscribeToIngresos(data => setIngresos(data));
    const unsubEgr = subscribeToEgresos(data => setEgresos(data));
    const unsubSoc = onSnapshot(query(collection(db, 'users')), snapshot => {
      setSocios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubIng(); unsubEgr(); unsubSoc(); };
  }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val);

  const formatConcepto = (str) => {
    if (!str) return '';
    if (str.includes(' - ')) {
        const parts = str.split(' - ');
        if (/^\d{6,}$/.test(parts[0].trim())) {
            return `${parts.slice(1).join(' - ')} - ${parts[0].trim()}`;
        }
    }
    return str;
  };

  // === CALCULOS TRIBUTARIOS DEL MES SELECCIONADO (IGV & RENTA) ===
  const detallesIngresosMes = [];
  let totalRecaudadoMes = 0;
  let totalFacturadoMes = 0;
  let baseImponibleMensual = 0;
  let igvCobradoMensual = 0;
  
  const anioFiscal = anioDashboard;
  let anualIngresosTotales = 0;
  let anualIngresosFormalesBase = 0; 
  let anualAdelantoRenta = 0;

  const desgloseAnualObj = {
      '01': { ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0, ingresoCalculado: 0, egresoCalculado: 0 },
      '02': { ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0, ingresoCalculado: 0, egresoCalculado: 0 },
      '03': { ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0, ingresoCalculado: 0, egresoCalculado: 0 },
      '04': { ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0, ingresoCalculado: 0, egresoCalculado: 0 },
      '05': { ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0, ingresoCalculado: 0, egresoCalculado: 0 },
      '06': { ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0, ingresoCalculado: 0, egresoCalculado: 0 },
      '07': { ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0, ingresoCalculado: 0, egresoCalculado: 0 },
      '08': { ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0, ingresoCalculado: 0, egresoCalculado: 0 },
      '09': { ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0, ingresoCalculado: 0, egresoCalculado: 0 },
      '10': { ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0, ingresoCalculado: 0, egresoCalculado: 0 },
      '11': { ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0, ingresoCalculado: 0, egresoCalculado: 0 },
      '12': { ingresoBruto: 0, igvVentas: 0, egresoFormal: 0, igvCompras: 0, ingresoCalculado: 0, egresoCalculado: 0 }
  };

  // === CALCULOS HISTÓRICOS Y ANUALES DE INGRESOS ===
  ingresos.forEach(ing => {
    if (ing.cronograma && ing.cronograma.length > 0) {
        ing.cronograma.forEach((c, idx) => {
           const isPagoThisMonth = (c.fechaPago || '').startsWith(mesSeleccionado);
           const isPagoEsteAnio = (c.fechaPago || '').startsWith(anioFiscal);
           
           if (c.estado === 'Pagado') {
               const monto = Number(String(c.monto).replace(/,/g, '')) || 0;
               if (isPagoThisMonth) {
                   totalRecaudadoMes += monto;
                   let itemIGV = 0;
                   let itemBase = 0;
                   let itemRenta = 0;
                   if (c.facturado) {
                       totalFacturadoMes += monto;
                       const rate = ing.igvRate ?? 18;
                       itemBase = monto / (1 + (rate / 100));
                       itemIGV = monto - itemBase;
                       itemRenta = itemBase * 0.01;
                       baseImponibleMensual += itemBase;
                       igvCobradoMensual += itemIGV;
                   }
                   detallesIngresosMes.push({
                       id: `${ing.id}-q-${idx}`,
                       expediente: `${formatConcepto(ing.expedienteId)} (Cuota ${c.cuota})`,
                       origen: 'Fijo',
                       monto: monto,
                       facturado: c.facturado === true,
                       igv: itemIGV,
                       base: itemBase,
                       renta1: itemRenta,
                       fechaPago: c.fechaPago || ''
                   });
               }
               // Para Anual
               if (isPagoEsteAnio) {
                   anualIngresosTotales += monto;
                   if (c.facturado) {
                       const rate = ing.igvRate ?? 18;
                       const base = monto / (1 + (rate / 100));
                       anualIngresosFormalesBase += base;
                       anualAdelantoRenta += (base * 0.01);
                       const m = (c.fechaPago || '').slice(5, 7);
                       if(desgloseAnualObj[m]) {
                           desgloseAnualObj[m].ingresoBruto += monto;
                           desgloseAnualObj[m].igvVentas += (monto - base);
                       }
                   }
               }
           }
        });
    } else {
        const isPagoThisMonth = (ing.fechaPago || '').startsWith(mesSeleccionado);
        const isPagoEsteAnio = (ing.fechaPago || '').startsWith(anioFiscal);
        
        if (ing.estado === 'Pagado') {
            const monto = Number(String(ing.montoTotal).replace(/,/g, '')) || 0;
            if (isPagoThisMonth) {
                totalRecaudadoMes += monto;
                let itemIGV = 0;
                let itemBase = 0;
                let itemRenta = 0;
                if (ing.facturado) {
                    totalFacturadoMes += monto;
                    const rate = ing.igvRate ?? 18;
                    itemBase = monto / (1 + (rate / 100));
                    itemIGV = monto - itemBase;
                    itemRenta = itemBase * 0.01;
                    baseImponibleMensual += itemBase;
                    igvCobradoMensual += itemIGV;
                }
                detallesIngresosMes.push({
                   id: `${ing.id}-v`,
                   expediente: `${formatConcepto(ing.expedienteId || 'Directo')} (${ing.tipo || 'Variable'})`,
                   origen: 'Variable',
                   monto: monto,
                   facturado: ing.facturado === true,
                   igv: itemIGV,
                   base: itemBase,
                   renta1: itemRenta,
                   fechaPago: ing.fechaPago || ''
                });
            }
            // Para Anual
            if (isPagoEsteAnio) {
                anualIngresosTotales += monto;
                if (ing.facturado) {
                    const rate = ing.igvRate ?? 18;
                    const base = monto / (1 + (rate / 100));
                    anualIngresosFormalesBase += base;
                    anualAdelantoRenta += (base * 0.01);
                    const m = (ing.fechaPago || '').slice(5, 7);
                    if(desgloseAnualObj[m]) {
                        desgloseAnualObj[m].ingresoBruto += monto;
                        desgloseAnualObj[m].igvVentas += (monto - base);
                    }
                }
            }
        }
    }
  });

  const detallesEgresosMes = [];
  let totalGastadoMes = 0;
  let baseEgresosMensual = 0;
  let igvPagadoMensual = 0;
  let totalEgresosFormales = 0;
  let totalEgresosInformales = 0;
  
  let anualEgresosTotales = 0;
  let anualEgresosFormalesBase = 0;

  egresos.forEach(eg => {
      const fechaCruce = eg.fechaPago || eg.fecha || '';
      const isPagoThisMonth = fechaCruce.startsWith(mesSeleccionado);
      const isPagoEsteAnio = fechaCruce.startsWith(anioFiscal);

      if (eg.estado === 'Pagado') {
          const monto = Number(String(eg.montoTotal || eg.monto).replace(/,/g, '')) || 0;
          
          const esFactura = eg.comprobanteTipo === 'Factura' || eg.comprobante === 'Factura';
          const esRH = eg.comprobanteTipo === 'Recibo por Honorarios' || eg.comprobante === 'Recibo por Honorarios' || eg.comprobante === 'RH';
          const esFormal = esFactura || esRH;

          if (isPagoThisMonth) {
              totalGastadoMes += monto;
              let itemIGV = 0;
              
              if (esFactura) {
                  const rate = eg.igv ?? 18;
                  const itemBase = monto / (1 + (rate / 100));
                  itemIGV = monto - itemBase;
                  baseEgresosMensual += itemBase;
                  igvPagadoMensual += itemIGV;
                  totalEgresosFormales += monto; // 100% sale de caja como formal
              } else if (esRH) {
                  baseEgresosMensual += monto;
                  totalEgresosFormales += monto; // 100% a formal
              } else {
                  totalEgresosInformales += monto;
              }

              detallesEgresosMes.push({
                  id: eg.id,
                  concepto: eg.descripcion || eg.concepto || eg.proveedorNombre || 'Gasto',
                  comprobante: eg.comprobanteTipo || eg.comprobante || 'Ninguno',
                  monto: monto,
                  esFactura: esFactura,
                  esRH: esRH,
                  igv: itemIGV,
                  fechaPago: fechaCruce || ''
              });
          }

          if (isPagoEsteAnio) {
              anualEgresosTotales += monto;
              const m = fechaCruce.slice(5, 7);
              if (esFactura) {
                  const rate = eg.igv ?? 18;
                  const baseEg = monto / (1 + (rate / 100));
                  const igvEg = monto - baseEg;
                  if(desgloseAnualObj[m]) {
                      desgloseAnualObj[m].egresoFormal += baseEg;
                      desgloseAnualObj[m].igvCompras += igvEg;
                  }
              } else if (esRH) {
                  if(desgloseAnualObj[m]) desgloseAnualObj[m].egresoFormal += monto;
              }
          }
      }
  });

  anualIngresosFormalesBase = 0;
  anualEgresosFormalesBase = 0;
  anualAdelantoRenta = 0;

  let anualCofreGenerado = 0;
  Object.keys(desgloseAnualObj).forEach(m => {
      const data = desgloseAnualObj[m];
      const igvAPagarMensual = Math.max(0, data.igvVentas - data.igvCompras);
      const baseImponibleDelMes = data.ingresoBruto - igvAPagarMensual;

      const baseLegalDelMes = baseImponibleDelMes - (data.egresoFormal + (data.igvCompras || 0));
      const reservaDelMes = baseLegalDelMes > 0 ? (baseLegalDelMes * 0.09) : 0;
      anualCofreGenerado += reservaDelMes;

      data.ingresoCalculado = baseImponibleDelMes;
      data.egresoCalculado = data.egresoFormal;

      anualIngresosFormalesBase += baseImponibleDelMes;
      anualEgresosFormalesBase += data.egresoFormal;
      anualAdelantoRenta += (baseImponibleDelMes * 0.01);
  });

  const igvAPagarMes = igvCobradoMensual - igvPagadoMensual;
  const ingresosFormalesMes = totalFacturadoMes;
  baseImponibleMensual = ingresosFormalesMes - Math.max(0, igvAPagarMes);
  const rentaMensual1Pct = baseImponibleMensual * 0.01;
  const utilidadBrutaMes = totalRecaudadoMes - totalGastadoMes;
  const ingresosInformalesMes = totalRecaudadoMes - totalFacturadoMes;
  const utilidadBrutaLegal = baseImponibleMensual - totalEgresosFormales;
  const utilidadBrutaInformal = ingresosInformalesMes - totalEgresosInformales;
  
  // El 9% se reserva estrictamente sobre la Utilidad Bruta Formal
  const reservaRenta9Pct = utilidadBrutaLegal > 0 ? (utilidadBrutaLegal * 0.09) : 0;
  
  // Renta Anual Calcs
  const anualBaseRentaMype = Math.max(0, anualIngresosFormalesBase - anualEgresosFormalesBase);
  const anualImpuesto10Pct = anualBaseRentaMype * 0.10;
  const anualRegularizacion = Math.max(0, anualImpuesto10Pct - anualAdelantoRenta);
  
  const anualCofreIdeal = anualCofreGenerado;
  const balanceFinalAhorroVsDeuda = anualCofreGenerado - anualRegularizacion;

  const downloadTaxReport = () => {
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
     
     doc.setTextColor(234, 179, 8); // Gold / amber
     doc.setFontSize(12);
     doc.setFont("helvetica", "bold");
     let titleReport = activeTab === 'igv' ? 'RESUMEN MENSUAL DE IGV' : activeTab === 'renta' ? 'BASE IMPONIBLE Y RENTA' : 'CIERRE ANUAL MYPE';
     doc.text(titleReport, pageWidth - 15, 19, { align: 'right' });
     
     // SUBHEADER
     doc.setTextColor(30, 41, 59);
     doc.setFontSize(11);
     doc.setFont("helvetica", "bold");
     let subTitle = activeTab === 'rentaanual' ? `AÑO FISCAL: ${anioDashboard}` : `PERIODO DECLARADO: ${mesSeleccionado}`;
     doc.text(subTitle, 15, 40);
     
     doc.setFontSize(9);
     doc.setFont("helvetica", "normal");
     doc.text(`Generado el: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - 15, 40, { align: 'right' });
     // ----------------------------------------------------------------------
     
     if (activeTab === 'igv') {
         autoTable(doc, {
             startY: 48,
             head: [['Resumen de la Recaudación Bruta (Informativo)', 'Monto (S/)']],
             body: [
                 ['Ingresos Informales (Caja Libre No Declarada)', formatCurrency(ingresosInformalesMes)],
                 ['Ingresos Formales Brutos (Facturas Emitidas)', formatCurrency(ingresosFormalesMes)],
                 ['INGRESO EFECTIVO TOTAL (CAJA)', formatCurrency(totalRecaudadoMes)],
                 ['---', '---'],
                 ['Egresos Informales (Gastos sin sustento SUNAT)', formatCurrency(totalEgresosInformales)],
                 ['Egresos Formales Brutos (Gastos sustentados)', formatCurrency(totalEgresosFormales)],
                 ['EGRESO EFECTIVO TOTAL (CAJA)', formatCurrency(totalGastadoMes)]
             ],
             headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
             alternateRowStyles: { fillColor: [248, 250, 252] }
         });

         autoTable(doc, {
             startY: doc.lastAutoTable.finalY + 10,
             head: [['Desglose y Cálculo Matemático del IGV', 'Monto (S/)']],
             body: [
                 ['1. Total Bruto de Ventas Formales (Base Imponible + IGV)', formatCurrency(ingresosFormalesMes)],
                 ['   > Base Imponible Pura de Ventas (Valor Real del Ingreso)', formatCurrency(baseImponibleMensual)],
                 ['   > IGV Generado (Impuesto de ley a favor del Estado)', formatCurrency(igvCobradoMensual)],
                 ['---', '---'],
                 ['2. Total de Escudo Fiscal por Compras Acumuladas', ''],
                 ['   > IGV Deducido (Escudo legal a favor de VINDEX)', formatCurrency(igvPagadoMensual)],
                 ['---', '---'],
                 ['3. LIQUIDACIÓN FINAL (IGV Generado menos Escudo Fiscal)', ''],
                 [igvAPagarMes > 0 ? '   > IGV NETO A PAGAR A LA SUNAT' : '   > CRÉDITO FISCAL A FAVOR (Saldo para el próximo mes)', formatCurrency(Math.abs(igvAPagarMes))]
             ],
             headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
             alternateRowStyles: { fillColor: [248, 250, 252] }
         });

         autoTable(doc, {
             startY: doc.lastAutoTable.finalY + 10,
             head: [['Desglose: Facturas Emitidas (Ventas)', 'Tipo', 'Fecha Pago', 'Recaudado', 'Estado SUNAT', 'Genera IGV']],
             body: detallesIngresosMes.map(i => [
                 i.expediente, 
                 i.origen, 
                 i.fechaPago,
                 formatCurrency(i.monto),
                 i.facturado ? 'Afecto' : 'Inafecto',
                 i.facturado ? formatCurrency(i.igv) : '-'
             ]),
             headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
             alternateRowStyles: { fillColor: [248, 250, 252] }
         });

         autoTable(doc, {
             startY: doc.lastAutoTable.finalY + 10,
             head: [['Desglose: Compras y Gastos Acumulados', 'Comprobante', 'Fecha Pago', 'Gastado', 'Estado SUNAT', 'Deduce IGV']],
             body: detallesEgresosMes.map(e => [
                 e.concepto,
                 e.comprobante,
                 e.fechaPago,
                 formatCurrency(e.monto),
                 e.esFactura ? 'Afecto Escudo' : e.esRH ? 'Afecto Renta' : 'Inafecto', 
                 e.esFactura ? formatCurrency(e.igv) : '-'
             ]),
             headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
             alternateRowStyles: { fillColor: [248, 250, 252] }
         });
         
         doc.setFontSize(8);
         doc.text(`Guía sobre IGV:`, 14, doc.lastAutoTable.finalY + 10);
         const igvText = `El Impuesto General a las Ventas (IGV) es un impuesto que pagan tus clientes, no tú. Tu negocio recauda ese dinero y debe entregarlo al Estado. Sin embargo, la ley permite restar el IGV de las compras que hiciste con factura para el negocio (IGV Deducido o Crédito). Sólo se declara y paga la diferencia resultante. Se paga mensualmente en la fecha de vencimiento que le corresponda al último dígito de tu RUC.`;
         doc.text(doc.splitTextToSize(igvText, 180), 14, doc.lastAutoTable.finalY + 16);
         
     } else if (activeTab === 'renta') {
         autoTable(doc, {
             startY: 48,
             head: [['Métricas Globales', 'Montos (S/)']],
             body: [
                 ['Ingreso Total', formatCurrency(totalRecaudadoMes)],
                 ['Ingresos Formales', formatCurrency(ingresosFormalesMes)],
                 ['Ingresos Informales', formatCurrency(ingresosInformalesMes)],
                 ['Base Imponible', formatCurrency(baseImponibleMensual)],
                 ['Egresos Formales', formatCurrency(totalEgresosFormales)],
                 ['Egresos Informales', formatCurrency(totalEgresosInformales)]
             ],
             headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
             alternateRowStyles: { fillColor: [248, 250, 252] }
         });

         autoTable(doc, {
             startY: doc.lastAutoTable.finalY + 10,
             head: [['Resumen de Utilidades', 'Utilidad (S/)']],
             body: [
                 ['Utilidad Bruta Formal', formatCurrency(utilidadBrutaLegal)],
                 ['Utilidad Bruta Informal', formatCurrency(utilidadBrutaInformal)],
                 ['Gran Utilidad Líquida (Libre de Todo)', formatCurrency(utilidadBrutaMes - Math.max(0, igvAPagarMes) - rentaMensual1Pct - reservaRenta9Pct)],
                 ['Utilidad Legal Libre de Todo', formatCurrency(utilidadBrutaLegal - rentaMensual1Pct - reservaRenta9Pct)]
             ],
             headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
             alternateRowStyles: { fillColor: [248, 250, 252] }
         });

         autoTable(doc, {
             startY: doc.lastAutoTable.finalY + 10,
             head: [['Impuestos y Reservas a Separar de la Caja', 'Montos a Pagar/Reservar (S/)']],
             body: [
                 ['Renta Exigida (1% A la SUNAT)', formatCurrency(rentaMensual1Pct)],
                 [`Cofre Reserva (9% Al Sistema VINDEX) - Sobre Base Neta: ${formatCurrency(utilidadBrutaLegal)}`, formatCurrency(reservaRenta9Pct)],
                 [igvAPagarMes > 0 ? 'IGV a Pagar (A la SUNAT)' : 'IGV a Favor', formatCurrency(Math.abs(igvAPagarMes))]
             ],
             headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
             alternateRowStyles: { fillColor: [248, 250, 252] }
         });

         doc.setFontSize(8);
         doc.text(`Conceptos de Liquidación:`, 14, doc.lastAutoTable.finalY + 10);
         const rentaText = `Fondo Base Neta para Provisión: Consiste en restar sus Egresos Formales brutos reales contra su Base Imponible de ingresos mensual. Representa la caja neta residual a los ojos puramente formales de SUNAT y sobre el cual nosotros extraemos rigurosamente una reserva preventiva del 9% para enviarla al Cofre.\n\nUtilidad Legal Promedio: Es la ganancia final formal de su caja luego de descontar sus compras y de pagar/provisionar tanto el IGV como las rentas. Estos fondos se pueden depositar al banco o convertirse en dividendos ya que fueron declarados 100%.`;
         doc.text(doc.splitTextToSize(rentaText, 180), 14, doc.lastAutoTable.finalY + 16);

     } else if (activeTab === 'rentaanual') {
         autoTable(doc, {
             startY: 48,
             head: [['Dashboard Anual Fiscal', 'Montos (S/)']],
             body: [
                 ['Total Base Imponible Promedio (Ingresos - IGV a Pagar)', formatCurrency(anualIngresosFormalesBase)],
                 ['Total Egresos Formales Brutos', formatCurrency(anualEgresosFormalesBase)],
                 ['Utilidad Imponible Anual', formatCurrency(anualBaseRentaMype)]
             ],
             headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
             alternateRowStyles: { fillColor: [248, 250, 252] }
         });

         autoTable(doc, {
             startY: doc.lastAutoTable.finalY + 10,
             head: [['Matemática de Regularización Anual', 'Montos (S/)']],
             body: [
                 ['Impuesto Renta (10% sobre la Utilidad)', formatCurrency(anualImpuesto10Pct)],
                 ['(-) Adelantos Renta Mensual 1%', `- ${formatCurrency(anualAdelantoRenta)}`],
                 ['Deuda a cancelar en la declaración anual de Marzo', formatCurrency(anualRegularizacion)]
             ],
             headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
             alternateRowStyles: { fillColor: [248, 250, 252] }
         });

         autoTable(doc, {
             startY: doc.lastAutoTable.finalY + 10,
             head: [['Balance Excedente Final de Caja', 'Montos (S/)']],
             body: [
                 ['Ahorro Protector en Cofre Acumulado (9%)', formatCurrency(anualCofreIdeal)],
                 [balanceFinalAhorroVsDeuda >= 0 ? 'BALANCE FINAL (EXCEDENTE)' : 'BALANCE FINAL (FALTANTE)', formatCurrency(Math.abs(balanceFinalAhorroVsDeuda))]
             ],
             headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
             alternateRowStyles: { fillColor: [248, 250, 252] }
         });

         const bodyDesglose = [];
         const mesesStr = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
         let totalIngresosDesglose = 0;
         let totalEgresosDesglose = 0;

         ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].forEach(m => {
             const data = desgloseAnualObj[m];
             if(data) {
                 totalIngresosDesglose += data.ingresoCalculado;
                 totalEgresosDesglose += data.egresoCalculado;
                 bodyDesglose.push([
                     mesesStr[Number(m)-1],
                     formatCurrency(data.ingresoCalculado),
                     formatCurrency(data.egresoCalculado),
                     formatCurrency(data.ingresoCalculado - data.egresoCalculado)
                 ]);
             }
         });
         
         autoTable(doc, {
             startY: doc.lastAutoTable.finalY + 10,
             head: [['Mes', 'Ingresos Netos (Base Imponible)', 'Egresos Netos Formales', 'Flujo Base PerCápita']],
             body: bodyDesglose,
             foot: [['TOTAL ANUAL', formatCurrency(totalIngresosDesglose), formatCurrency(totalEgresosDesglose), formatCurrency(totalIngresosDesglose - totalEgresosDesglose)]],
             headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
             footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
             alternateRowStyles: { fillColor: [248, 250, 252] }
         });
     }
     
     doc.save(`Reporte_${activeTab.toUpperCase()}_VINDEX.pdf`);
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-4 animate-in fade-in duration-500">
      
      {/* HEADER COMPACTO */}
      <div className="flex flex-col md:flex-row items-center justify-between border-b border-brand-200 dark:border-slate-800 pb-3 shrink-0 gap-3">
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
           <h1 className="text-lg md:text-xl font-black text-brand-900 dark:text-white tracking-tight flex items-center gap-2">
             <Landmark className="text-brand-600 dark:text-brand-400" size={24} />
             Inteligencia Tributaria
           </h1>
           {(activeTab === 'igv' || activeTab === 'renta') && (
               <input 
                   type="month" 
                   value={mesSeleccionado}
                   onChange={e => setMesSeleccionado(e.target.value)}
                   className="font-black text-brand-900 dark:text-white bg-brand-50 dark:bg-slate-950 border border-brand-200 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-inner text-xs cursor-pointer"
               />
           )}
           <button 
             onClick={downloadTaxReport}
             className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-colors shadow-sm ml-2"
           >
             <Download size={14}/> Reporte
           </button>
        </div>
        
        <div className="bg-white dark:bg-slate-900 border border-brand-200 dark:border-slate-800 p-1 rounded-lg shadow-sm flex flex-wrap gap-1 text-[10px] font-bold uppercase tracking-wider w-full md:w-auto justify-center">
           <button 
             onClick={() => setActiveTab('igv')} 
             className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${activeTab === 'igv' ? 'bg-indigo-600 text-white shadow-sm' : 'text-brand-600 dark:text-brand-400 hover:bg-indigo-50 dark:hover:bg-slate-800'}`}
           >
             <PieChart size={14}/> IGV
           </button>
           <button 
             onClick={() => setActiveTab('renta')} 
             className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${activeTab === 'renta' ? 'bg-amber-600 text-white shadow-sm' : 'text-brand-600 dark:text-brand-400 hover:bg-amber-50 dark:hover:bg-slate-800'}`}
           >
             <BookOpen size={14}/> Renta
           </button>
           <button 
             onClick={() => setActiveTab('rentaanual')} 
             className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${activeTab === 'rentaanual' ? 'bg-violet-600 text-white shadow-sm' : 'text-brand-600 dark:text-brand-400 hover:bg-violet-50 dark:hover:bg-slate-800'}`}
           >
             <Landmark size={14}/> Renta Anual
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 pr-2">
         
         {/* TAB 1: IGV */}
         {activeTab === 'igv' && (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
               <div className="flex flex-col sm:flex-row bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit mx-auto mb-2 gap-1 text-center">
                   <button onClick={() => setMatrizView('ingresos')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${matrizView === 'ingresos' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                       <TrendingUp size={14}/> Matriz de Ingresos
                   </button>
                   <button onClick={() => setMatrizView('egresos')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${matrizView === 'egresos' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                       <TrendingDown size={14}/> Matriz de Egresos
                   </button>
               </div>
               
               <div className="mx-auto max-w-4xl">
                   
                   {/* Columna Ingresos (Recaudado) */}
                   {matrizView === 'ingresos' && (
                   <div className="bg-white dark:bg-slate-900 border border-brand-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm flex flex-col relative h-full">
                       <div className="p-4 border-b border-brand-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/20">
                          <div>
                            <h3 className="text-sm font-black text-brand-900 dark:text-indigo-400 flex items-center gap-1.5"><TrendingUp size={16} className="text-indigo-500"/> Ingresos (Ventas) del Mes</h3>
                            <p className="text-[10px] text-brand-500 uppercase font-bold tracking-wider mt-0.5">Recaudación Total: {formatCurrency(totalRecaudadoMes)}</p>
                          </div>
                       </div>
                       <div className="p-0 flex-1 overflow-x-auto">
                           <table className="w-full min-w-[600px] text-left border-collapse">
                              <thead>
                                <tr className="bg-brand-50/50 dark:bg-slate-800/50 text-[10px] uppercase font-bold text-brand-500 border-b border-brand-200 dark:border-slate-800">
                                   <th className="p-3 font-bold pl-4">Concepto</th>
                                   <th className="p-3 font-bold">Tipo</th>
                                   <th className="p-3 font-bold">Fecha Pago</th>
                                   <th className="p-3 font-bold">Monto</th>
                                   <th className="p-3 font-bold">Estado Sunat</th>
                                   <th className="p-3 font-bold text-indigo-700 dark:text-indigo-400">Genera IGV</th>
                                </tr>
                              </thead>
                              <tbody>
                                 {detallesIngresosMes.length === 0 ? (
                                   <tr><td colSpan="6" className="text-center p-4 text-xs font-bold text-brand-400">Sin ingresos este mes.</td></tr>
                                 ) : (
                                   detallesIngresosMes.map(item => (
                                     <tr key={item.id} onClick={() => setSelectedTransaction(item)} className="cursor-pointer border-b border-brand-50 dark:border-slate-800/50 text-xs font-medium text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-800/50">
                                        <td className="p-3 pl-4 truncate max-w-[120px]" title={item.expediente}>{item.expediente}</td>
                                        <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${item.origen === 'Fijo' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{item.origen}</span></td>
                                        <td className="p-3 font-bold text-slate-500 whitespace-nowrap">{item.fechaPago}</td>
                                        <td className="p-3 font-bold text-brand-900 dark:text-white">{formatCurrency(item.monto)}</td>
                                        <td className="p-3">
                                          {item.facturado 
                                            ? <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Facturado</span>
                                            : <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Informal</span>
                                          }
                                        </td>
                                        <td className="p-3 font-black text-indigo-600 dark:text-indigo-400">{item.facturado ? formatCurrency(item.igv) : '-'}</td>
                                     </tr>
                                   ))
                                 )}
                              </tbody>
                           </table>
                       </div>
                       <div className="p-4 bg-brand-50/50 dark:bg-slate-800/30 border-t border-brand-200 dark:border-slate-800 flex justify-between items-center">
                          <span className="text-xs font-bold text-brand-600 dark:text-slate-400 uppercase tracking-wider">Total IGV Percibido</span>
                          <span className="text-lg font-black text-indigo-700 dark:text-indigo-400">{formatCurrency(igvCobradoMensual)}</span>
                       </div>
                   </div>
                   )}

                   {/* Columna Egresos (Compras) */}
                   {matrizView === 'egresos' && (
                   <div className="bg-white dark:bg-slate-900 border border-brand-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm flex flex-col relative h-full">
                       <div className="p-4 border-b border-brand-100 dark:border-slate-800 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-950/20">
                          <div>
                            <h3 className="text-sm font-black text-brand-900 dark:text-emerald-400 flex items-center gap-1.5"><TrendingDown size={16} className="text-emerald-500"/> Egresos (Compras) del Mes</h3>
                            <p className="text-[10px] text-brand-500 uppercase font-bold tracking-wider mt-0.5">Gasto Efectivo: {formatCurrency(totalGastadoMes)}</p>
                          </div>
                       </div>
                       <div className="p-0 flex-1 overflow-x-auto">
                           <table className="w-full min-w-[600px] text-left border-collapse">
                              <thead>
                                <tr className="bg-brand-50/50 dark:bg-slate-800/50 text-[10px] uppercase font-bold text-brand-500 border-b border-brand-200 dark:border-slate-800">
                                   <th className="p-3 font-bold pl-4">Concepto</th>
                                   <th className="p-3 font-bold">Fecha Pago</th>
                                   <th className="p-3 font-bold">Monto</th>
                                   <th className="p-3 font-bold">Comprobante</th>
                                   <th className="p-3 font-bold text-emerald-700 dark:emerald-400">Deduce IGV</th>
                                </tr>
                              </thead>
                              <tbody>
                                 {detallesEgresosMes.length === 0 ? (
                                   <tr><td colSpan="5" className="text-center p-4 text-xs font-bold text-brand-400">Sin compras este mes.</td></tr>
                                 ) : (
                                   detallesEgresosMes.map(item => (
                                     <tr key={item.id} onClick={() => setSelectedTransaction(item)} className="cursor-pointer border-b border-brand-50 dark:border-slate-800/50 text-xs font-medium text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-800/50">
                                        <td className="p-3 pl-4 truncate max-w-[120px]" title={item.concepto}>{item.concepto}</td>
                                        <td className="p-3 font-bold text-slate-500 whitespace-nowrap">{item.fechaPago}</td>
                                        <td className="p-3 font-bold text-brand-900 dark:text-white">{formatCurrency(item.monto)}</td>
                                        <td className="p-3">
                                          {item.esFactura 
                                            ? <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Factura</span>
                                            : <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider truncate block max-w-[80px]">{item.comprobante}</span>
                                          }
                                        </td>
                                        <td className="p-3 font-black text-emerald-600 dark:text-emerald-400">{item.esFactura ? formatCurrency(item.igv) : '-'}</td>
                                     </tr>
                                   ))
                                 )}
                              </tbody>
                           </table>
                       </div>
                       <div className="p-4 bg-brand-50/50 dark:bg-slate-800/30 border-t border-brand-200 dark:border-slate-800 flex justify-between items-center">
                          <span className="text-xs font-bold text-brand-600 dark:text-slate-400 uppercase tracking-wider">Total IGV Deducido (A favor)</span>
                          <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(igvPagadoMensual)}</span>
                       </div>
                   </div>
                   )}
               </div>

               {/* RESULTADO FINAL IGV */}
               <div className={`p-8 rounded-3xl border-2 flex flex-col items-center text-center shadow-sm transition-colors mt-8 ${igvAPagarMes > 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'}`}>
                  <h3 className={`text-xl font-black uppercase tracking-widest ${igvAPagarMes > 0 ? 'text-red-900 dark:text-red-400' : 'text-emerald-900 dark:text-emerald-400'}`}>
                     {igvAPagarMes > 0 ? 'Liquidación IGV Mensual - A Pagar a SUNAT' : 'Crédito Fiscal a Favor VINDEX'}
                  </h3>
                  <div className={`my-5 px-16 py-4 rounded-[2rem] bg-white dark:bg-slate-900 shadow-md border-2 ${igvAPagarMes > 0 ? 'text-red-600 border-red-200 dark:border-red-800' : 'text-emerald-600 border-emerald-200 dark:border-emerald-800'}`}>
                     <span className="text-[11px] font-black uppercase tracking-widest block mb-1 text-slate-500">Monto Base de Liquidación</span>
                     <span className="text-5xl font-black tracking-tight">{formatCurrency(Math.abs(igvAPagarMes))}</span>
                  </div>
                  <p className={`text-sm font-bold leading-relaxed max-w-3xl mx-auto ${igvAPagarMes > 0 ? 'text-red-800/80 dark:text-red-400' : 'text-emerald-800/80 dark:text-emerald-400'}`}>
                     El Impuesto General a las Ventas (IGV) es un impuesto indirecto trasladable pagado por el consumidor final. La recaudación de tus ventas no es tuya, sino del Estado. Sin embargo, se te permite deducir o "cruzar" el IGV de las compras que hiciste para el negocio (Facturas soportadas). Operación: IGV Percibido menos IGV Deducido.
                  </p>
               </div>
            </div>
         )}

         {/* TAB 2: RENTA */}
         {activeTab === 'renta' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
               
               {/* Resumen Superior Renta */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                   <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-3 flex flex-col justify-center shadow-sm">
                      <span className="text-[9px] font-bold text-blue-900 dark:text-blue-400 uppercase tracking-widest mb-0.5">Ingreso Total</span>
                      <span className="text-lg font-black text-blue-700 dark:text-blue-300">{formatCurrency(totalRecaudadoMes)}</span>
                      <p className="text-[8px] leading-tight text-blue-600/80 font-bold mt-1">Todo el dinero neto a caja (formal e informal).</p>
                   </div>
                   <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-3 flex flex-col justify-center shadow-sm">
                      <span className="text-[9px] font-bold text-indigo-900 dark:text-indigo-400 uppercase tracking-widest mb-0.5">Ingresos Formales</span>
                      <span className="text-lg font-black text-indigo-700 dark:text-indigo-300">{formatCurrency(ingresosFormalesMes)}</span>
                      <p className="text-[8px] leading-tight text-indigo-600/80 font-bold mt-1">Dinero con comprobante.</p>
                   </div>
                   <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-3 flex flex-col justify-center shadow-sm">
                      <span className="text-[9px] font-bold text-purple-900 dark:text-purple-400 uppercase tracking-widest mb-0.5">Ingresos Informales</span>
                      <span className="text-lg font-black text-purple-700 dark:text-purple-300">{formatCurrency(ingresosInformalesMes)}</span>
                      <p className="text-[8px] leading-tight text-purple-600/80 font-bold mt-1">Dinero SIN comprobante SUNAT.</p>
                   </div>
                   <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-2xl p-3 flex flex-col justify-center shadow-sm">
                      <span className="text-[9px] font-bold text-cyan-900 dark:text-cyan-400 uppercase tracking-widest mb-0.5">Base Imponible</span>
                      <span className="text-lg font-black text-cyan-700 dark:text-cyan-300">{formatCurrency(baseImponibleMensual)}</span>
                      <p className="text-[8px] leading-tight text-cyan-600/80 font-bold mt-1">Ingresos formales menos IGV a Pagar.</p>
                   </div>
                   <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-3 flex flex-col justify-center shadow-sm">
                      <span className="text-[9px] font-bold text-red-900 dark:text-red-400 uppercase tracking-widest mb-0.5">Egresos Formales</span>
                      <span className="text-lg font-black text-red-700 dark:text-red-300">{formatCurrency(totalEgresosFormales)}</span>
                      <p className="text-[8px] leading-tight text-red-600/80 font-bold mt-1">Gastos con Factura / Recibo.</p>
                   </div>
                   <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-3 flex flex-col justify-center shadow-sm">
                      <span className="text-[9px] font-bold text-orange-900 dark:text-orange-400 uppercase tracking-widest mb-0.5">Egresos Informales</span>
                      <span className="text-lg font-black text-orange-700 dark:text-orange-300">{formatCurrency(totalEgresosInformales)}</span>
                      <p className="text-[8px] leading-tight text-orange-600/80 font-bold mt-1">Gastos en comprobantes simples.</p>
                   </div>
                </div>

                <div className="mb-8">
                   <h4 className="text-xs font-black text-brand-800 dark:text-brand-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <TrendingUp size={16}/> Resumen de Utilidades
                   </h4>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-5 flex flex-col justify-center shadow-sm">
                         <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-400 uppercase tracking-widest mb-1">Utilidad Bruta Formal</span>
                         <span className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(utilidadBrutaLegal)}</span>
                         <p className="text-[10px] leading-tight text-emerald-600/80 font-bold mt-2">Base Imponible menos Egresos Formales.</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl p-5 flex flex-col justify-center shadow-sm">
                         <span className="text-[11px] font-bold text-amber-900 dark:text-amber-400 uppercase tracking-widest mb-1">Utilidad Bruta Informal</span>
                         <span className="text-3xl font-black text-amber-700 dark:text-amber-300">{formatCurrency(utilidadBrutaInformal)}</span>
                         <p className="text-[10px] leading-tight text-amber-600/80 font-bold mt-2">Ingresos Informales menos Egresos Informales.</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                      <div className="bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900 border-2 rounded-3xl p-6 flex flex-col justify-center shadow-sm relative overflow-hidden">
                         <div className="absolute -top-4 -right-4 opacity-10"><TrendingUp size={100} /></div>
                         <span className="text-xs font-bold text-emerald-900 dark:text-emerald-500 uppercase tracking-widest mb-1 flex items-center justify-between z-10 relative">
                            <span><TrendingUp size={14} className="inline mr-1"/> Gran Utilidad Líquida (Libre de Todo)</span>
                         </span>
                         <span className="text-4xl font-black text-emerald-800 dark:text-emerald-400 z-10 relative">{formatCurrency(utilidadBrutaMes - Math.max(0, igvAPagarMes) - rentaMensual1Pct - reservaRenta9Pct)}</span>
                         <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-500/80 mt-2 leading-tight z-10 relative max-w-sm">La suma del mundo legal e informal. Ganancia pura real descontando egresos e impuestos.</p>
                      </div>

                      <div className="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/50 border-2 rounded-3xl p-6 flex flex-col justify-center shadow-sm relative overflow-hidden">
                         <div className="absolute -bottom-4 -right-4 opacity-5"><Landmark size={80} /></div>
                         <span className="text-xs font-bold text-teal-900 dark:text-teal-500 uppercase tracking-widest mb-1 flex items-center justify-between z-10 relative">
                            <span><Landmark size={14} className="inline mr-1"/> Utilidad Legal Libre de Todo</span>
                         </span>
                         <span className="text-4xl font-black text-teal-800 dark:text-teal-400 z-10 relative">{formatCurrency(utilidadBrutaLegal - rentaMensual1Pct - reservaRenta9Pct)}</span>
                         <p className="text-[10px] font-bold text-teal-700 dark:text-teal-500/80 mt-2 leading-tight z-10 relative max-w-sm">Utilidad bruta formal menos reservas de Renta y Cofre. 100% blanqueada frente a SUNAT.</p>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                   <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-3xl p-5 flex flex-col justify-center shadow-sm">
                      <span className="text-[10px] font-bold text-blue-900 dark:text-blue-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                         <BookOpen size={12}/> Renta Exigida (1%)
                      </span>
                      <span className="text-2xl font-black text-blue-700 dark:text-blue-300">{formatCurrency(rentaMensual1Pct)}</span>
                      <p className="text-[9px] font-bold text-blue-600 mt-1 leading-tight">Obligatorio mensual adelantado a SUNAT.</p>
                   </div>
                   <div className="bg-slate-900 dark:bg-slate-950 border border-brand-800 rounded-3xl p-5 flex flex-col justify-center shadow-md">
                      <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                         <ShieldCheck size={12}/> Cofre Reserva (9%)
                      </span>
                      <span className="text-2xl font-black text-white">{formatCurrency(reservaRenta9Pct)}</span>
                      <div className="bg-slate-800 rounded-md py-0.5 px-2 w-max mt-1">
                         <span className="text-[8px] text-brand-200 uppercase font-black tracking-wider">Utilidad Bruta Formal: {formatCurrency(utilidadBrutaLegal)}</span>
                      </div>
                      <p className="text-[9px] font-bold text-brand-300 mt-1.5 leading-tight">Provisión retenida sobre tu Utilidad Libre de IGV.</p>
                   </div>
                   <div className={`rounded-3xl border-2 p-5 flex flex-col justify-center shadow-sm transition-colors ${igvAPagarMes > 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50' : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50'}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5 ${igvAPagarMes > 0 ? 'text-red-900 dark:text-red-500' : 'text-green-900 dark:text-green-500'}`}>
                         <PieChart size={12}/> {igvAPagarMes > 0 ? 'IGV a Pagar' : 'IGV a Favor'}
                      </span>
                      <span className={`text-2xl font-black ${igvAPagarMes > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{formatCurrency(Math.abs(igvAPagarMes))}</span>
                      <p className={`text-[9px] font-bold mt-1 leading-tight ${igvAPagarMes > 0 ? 'text-red-700/80' : 'text-green-700/80'}`}>Liquidez por cruce de facturas.</p>
                   </div>
                </div>

               {/* Lista de Transacciones que impactan renta */}
               <div className="bg-white dark:bg-slate-900 border border-brand-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                   <div className="p-4 border-b border-brand-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
                       <div>
                         <h3 className="text-sm font-black text-brand-900 dark:text-white flex items-center gap-2"><BookOpen size={16}/> Matriz de Transacciones</h3>
                         <p className="text-[10px] text-brand-500 font-medium mt-1">Sustento detallado de todas las transacciones que abonan a su base imponible.</p>
                       </div>
                       <div className="flex gap-2">
                         <button 
                            onClick={() => setMatrizView('ingresos')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${matrizView === 'ingresos' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                            Matriz de Ingresos
                         </button>
                         <button 
                            onClick={() => setMatrizView('egresos')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${matrizView === 'egresos' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                            Matriz de Egresos
                         </button>
                       </div>
                   </div>
                   <div className="overflow-x-auto">
                   {matrizView === 'ingresos' ? (
                       <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-brand-50/50 dark:bg-slate-800/50 text-[10px] uppercase font-bold text-brand-500 border-b border-brand-200 dark:border-slate-800">
                               <th className="p-3 pl-4">Cliente / Expediente</th>
                               <th className="p-3">Tipo</th>
                               <th className="p-3">Fecha Pago</th>
                               <th className="p-3">Recaudado</th>
                               <th className="p-3">Estado SUNAT</th>
                               <th className="p-3 text-brand-800 dark:text-brand-400">Base Imponible</th>
                               <th className="p-3 text-amber-700 dark:text-amber-500">Provoca Renta (1%)</th>
                            </tr>
                          </thead>
                          <tbody>
                             {detallesIngresosMes.length === 0 ? (
                               <tr><td colSpan="7" className="text-center p-6 text-sm font-bold text-brand-400">Sin ingresos reportados.</td></tr>
                             ) : (
                               detallesIngresosMes.map(item => (
                                 <tr key={item.id} onClick={() => setSelectedTransaction(item)} className="cursor-pointer border-b border-brand-50 dark:border-slate-800/50 text-xs font-medium text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-800/50">
                                    <td className="p-3 pl-4 font-bold truncate max-w-[150px]" title={item.expediente}>{item.expediente}</td>
                                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${item.origen === 'Fijo' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{item.origen}</span></td>
                                    <td className="p-3">{item.fechaPago}</td>
                                    <td className="p-3 font-black text-indigo-600">{formatCurrency(item.monto)}</td>
                                    <td className="p-3">
                                      {item.facturado 
                                        ? <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Afecto</span>
                                        : <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Inafecto</span>
                                      }
                                    </td>
                                    <td className="p-3 font-black">{item.facturado ? formatCurrency(item.base) : '-'}</td>
                                    <td className="p-3 font-black text-amber-600 dark:text-amber-500">{item.facturado ? formatCurrency(item.renta1) : '-'}</td>
                                 </tr>
                               ))
                             )}
                          </tbody>
                       </table>
                   ) : (
                       <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-rose-50/50 dark:bg-rose-900/10 text-[10px] uppercase font-bold text-rose-500 border-b border-rose-200 dark:border-rose-900/50">
                               <th className="p-3 pl-4">Concepto / Proveedor</th>
                               <th className="p-3">Comprobante</th>
                               <th className="p-3">Fecha Pago</th>
                               <th className="p-3">Gastado</th>
                               <th className="p-3">Estado SUNAT</th>
                               <th className="p-3 text-emerald-700 dark:text-emerald-500">Deduce IGV</th>
                            </tr>
                          </thead>
                          <tbody>
                             {detallesEgresosMes.length === 0 ? (
                               <tr><td colSpan="6" className="text-center p-6 text-sm font-bold text-brand-400">Sin egresos reportados.</td></tr>
                             ) : (
                               detallesEgresosMes.map(item => (
                                 <tr key={item.id} onClick={() => setSelectedTransaction(item)} className="cursor-pointer border-b border-brand-50 dark:border-slate-800/50 text-xs font-medium text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-800/50">
                                    <td className="p-3 pl-4 font-bold truncate max-w-[200px]" title={item.concepto}>{item.concepto}</td>
                                    <td className="p-3"><span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">{item.comprobante}</span></td>
                                    <td className="p-3">{item.fechaPago}</td>
                                    <td className="p-3 font-black text-rose-600">{formatCurrency(item.monto)}</td>
                                    <td className="p-3">
                                      {item.esFactura 
                                        ? <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Afecto Escudo</span>
                                        : item.esRH
                                        ? <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Afecto Renta</span>
                                        : <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Inafecto</span>
                                      }
                                    </td>
                                    <td className="p-3 font-black text-emerald-600 dark:text-emerald-500">{item.esFactura ? formatCurrency(item.igv) : '-'}</td>
                                 </tr>
                               ))
                             )}
                          </tbody>
                       </table>
                   )}
                   </div>
               </div>
            </div>
         )}

         {/* TAB 3: RENTA ANUAL LÍQUIDA */}
         {activeTab === 'rentaanual' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white dark:bg-slate-900 border border-brand-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-brand-100 dark:border-slate-800 pb-4">
                       <h3 className="text-xl font-black text-brand-900 dark:text-white flex items-center gap-2"><Landmark className="text-violet-500" size={24}/> Dashboard Anual Fiscal</h3>
                       <select 
                          className="bg-brand-50 dark:bg-slate-800 border border-brand-200 dark:border-slate-700 text-brand-900 dark:text-white font-bold rounded-xl px-4 py-2"
                          value={anioDashboard}
                          onChange={(e) => setAnioDashboard(e.target.value)}
                       >
                          {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                             <option key={y} value={y.toString()}>Año {y}</option>
                          ))}
                       </select>
                    </div>

                    <div className="flex gap-2 mb-6">
                       <button onClick={() => setDesgloseView(desgloseView === 'ingresos' ? null : 'ingresos')} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${desgloseView === 'ingresos' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Desglose Mensual Ingresos</button>
                       <button onClick={() => setDesgloseView(desgloseView === 'egresos' ? null : 'egresos')} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${desgloseView === 'egresos' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Desglose Mensual Gastos</button>
                    </div>

                    {desgloseView && (
                       <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in duration-300">
                          {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => {
                             const mesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                             const v = desgloseView === 'ingresos' ? desgloseAnualObj[m].ingresoCalculado : desgloseAnualObj[m].egresoCalculado;
                             return (
                                <div key={m} className={`p-3 rounded-xl border ${desgloseView === 'ingresos' ? 'bg-indigo-50 border-indigo-100 text-indigo-900 dark:bg-indigo-900/20 dark:border-indigo-800/50 dark:text-indigo-200' : 'bg-rose-50 border-rose-100 text-rose-900 dark:bg-rose-900/20 dark:border-rose-800/50 dark:text-rose-200'}`}>
                                   <span className="text-[10px] uppercase font-bold opacity-70 mb-1 block">{mesNombres[parseInt(m, 10)-1]}</span>
                                   <span className="text-sm font-black whitespace-nowrap">{formatCurrency(v)}</span>
                                </div>
                             )
                          })}
                       </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-3">
                           <div className="flex justify-between items-center bg-brand-50/50 dark:bg-slate-800 p-3 rounded-lg">
                               <span className="text-xs font-bold text-brand-600">Total Base Imponible Promedio (Ingresos - IGV a Pagar)</span>
                               <span className="text-sm font-black text-brand-900 dark:text-white">{formatCurrency(anualIngresosFormalesBase)}</span>
                           </div>
                           <div className="flex flex-col items-center justify-center p-1 text-slate-400"><TrendingDown size={14}/></div>
                           <div className="flex justify-between items-center bg-red-50/50 dark:bg-red-900/10 p-3 rounded-lg">
                               <span className="text-xs font-bold text-red-600">Total Egresos Formales Brutos</span>
                               <span className="text-sm font-black text-red-700">{formatCurrency(anualEgresosFormalesBase)}</span>
                           </div>
                           <div className="flex flex-col items-center justify-center p-1 text-slate-400"><TrendingDown size={14} className="rotate-180"/></div>
                           <div className="flex justify-between items-center bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg shadow-sm">
                               <span className="text-sm font-bold text-amber-800 dark:text-amber-500 uppercase">Utilidad Imponible Anual</span>
                               <span className="text-lg font-black text-amber-700">{formatCurrency(anualBaseRentaMype)}</span>
                           </div>
                        </div>

                        <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900/50 rounded-2xl p-5 flex flex-col justify-center shadow-sm">
                           <span className="text-xs font-bold text-violet-900 dark:text-violet-500 uppercase tracking-widest mb-1 items-center gap-1.5">
                              Matemática de Regularización
                           </span>
                           <div className="space-y-2 mt-4 flex-1 flex flex-col justify-center">
                               <div className="flex justify-between items-center text-xs">
                                  <span className="text-violet-600 font-bold">Impuesto Renta (10% sobre la Utilidad)</span>
                                  <span className="text-violet-900 dark:text-violet-300 font-black">{formatCurrency(anualImpuesto10Pct)}</span>
                               </div>
                               <div className="flex justify-between items-center text-xs pb-3 border-b border-violet-200 dark:border-violet-800/50">
                                  <span className="text-brand-500 font-bold">(-) Adelantos Renta Mensual 1%</span>
                                  <span className="text-brand-700 font-black text-red-500">- {formatCurrency(anualAdelantoRenta)}</span>
                               </div>
                           </div>
                           <div className="flex justify-between items-end mt-4">
                               <p className="text-[10px] font-bold text-violet-600 leading-tight pr-4">Deuda a cancelar en la declaración anual de Marzo.</p>
                               <span className="text-3xl font-black text-violet-800 dark:text-violet-400">{formatCurrency(anualRegularizacion)}</span>
                           </div>
                        </div>
                    </div>

                    <div className={`p-6 rounded-3xl border-2 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm transition-colors ${balanceFinalAhorroVsDeuda >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'}`}>
                        <div>
                           <h3 className={`text-lg font-black uppercase tracking-widest ${balanceFinalAhorroVsDeuda >= 0 ? 'text-emerald-900 dark:text-emerald-400' : 'text-red-900 dark:text-red-400'}`}>
                              {balanceFinalAhorroVsDeuda >= 0 ? 'Excedente de Caja a Favor' : 'Faltante de Caja Anual'}
                           </h3>
                           <p className={`text-[10px] font-bold mt-1 max-w-lg ${balanceFinalAhorroVsDeuda >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              Al provisionar el <b>9%</b> de su base legal mes a mes, usted ahorró <span className="font-black">{formatCurrency(anualCofreIdeal)}</span>. A la deuda tributaria le restamos ese ahorro para encontrar su liquidez acumulada neta.
                           </p>
                        </div>
                        <div className={`text-right px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border ${balanceFinalAhorroVsDeuda >= 0 ? 'text-emerald-600 border-emerald-200 dark:border-emerald-800' : 'text-red-600 border-red-200 dark:border-red-800'}`}>
                           <span className="text-[10px] font-black uppercase tracking-widest block mb-1">BALANCE FINAL (EXCEDENTE)</span>
                           <span className="text-3xl font-black">{formatCurrency(Math.abs(balanceFinalAhorroVsDeuda))}</span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-blue-50/50 dark:bg-blue-950/20 p-5 rounded-2xl border border-blue-200 dark:border-blue-900/50 text-center flex flex-col justify-center shadow-sm">
                            <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest block mb-1">Total Cofre Ahorrado</span>
                            <span className="text-2xl font-black text-blue-900 dark:text-blue-400 block mb-2">{formatCurrency(anualCofreGenerado)}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">La suma de todos tus 9% positivos del año</span>
                        </div>
                        <div className={`p-5 rounded-2xl border text-center flex flex-col justify-center shadow-sm ${balanceFinalAhorroVsDeuda >= 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50' : 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'}`}>
                            <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${balanceFinalAhorroVsDeuda >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {balanceFinalAhorroVsDeuda >= 0 ? 'Excedente Para Retirar' : 'Faltante P/ Regularización'}
                            </span>
                            <span className={`text-2xl font-black block mb-2 ${balanceFinalAhorroVsDeuda >= 0 ? 'text-emerald-900 dark:text-emerald-400' : 'text-red-900 dark:text-red-400'}`}>
                                {formatCurrency(Math.abs(balanceFinalAhorroVsDeuda))}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Saldo final de restar el impuesto 10% al Costo Cofre</span>
                        </div>
                    </div>
                </div>
            </div>
         )}
      </div>

      {/* MODAL DETALLES DE TRANSACCIÓN TRIBUTARIA */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-brand-200 dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 flex justify-between items-start border-b border-brand-100 dark:border-slate-800">
               <div>
                  <h3 className="text-xl font-black text-brand-900 dark:text-white flex items-center gap-2">
                     <FileText size={20} className="text-brand-500"/> Detalle de Operación
                  </h3>
                  <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mt-1">Origen: {selectedTransaction.origen || 'Egreso / Compra'}</p>
               </div>
               <button onClick={() => setSelectedTransaction(null)} className="text-brand-400 hover:text-red-500 transition-colors p-1 bg-white dark:bg-slate-800 rounded-full shadow-sm"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                  <label className="block text-[10px] font-black uppercase text-brand-400 mb-1">Concepto / Expediente</label>
                  <p className="font-bold text-sm text-brand-800 dark:text-slate-200 leading-snug">{selectedTransaction.concepto || selectedTransaction.expediente}</p>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-brand-50 dark:bg-slate-800/50 p-3 rounded-xl border border-brand-100 dark:border-slate-700">
                     <label className="block text-[10px] font-black uppercase text-brand-500 mb-1">Monto Total Real</label>
                     <p className="font-black text-lg text-brand-900 dark:text-white">{formatCurrency(selectedTransaction.monto)}</p>
                  </div>
                  <div className="bg-brand-50 dark:bg-slate-800/50 p-3 rounded-xl border border-brand-100 dark:border-slate-700">
                     <label className="block text-[10px] font-black uppercase text-brand-500 mb-1">Fecha de Pago/Cruce</label>
                     <p className="font-bold text-sm text-brand-800 dark:text-slate-300">{selectedTransaction.fechaPago || 'No especificada'}</p>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-[10px] font-black uppercase text-brand-400 mb-1">Comprobante / Sustento</label>
                     <p className="font-bold text-xs text-brand-700 dark:text-slate-300">
                        {selectedTransaction.comprobante || (selectedTransaction.facturado ? 'Factura/Recibo Formal' : 'No Bancarizado / Informal')}
                     </p>
                  </div>
                  <div>
                     <label className="block text-[10px] font-black uppercase text-brand-400 mb-1">Impacto Deducible IGV</label>
                     <p className="font-black text-xs text-indigo-600 dark:text-indigo-400">{selectedTransaction.igv > 0 ? formatCurrency(selectedTransaction.igv) : 'Inafecto / S/ 0.00'}</p>
                  </div>
               </div>
               
               {/* Metadata Cruda Oculta para Debugger Frontend */}
               {selectedTransaction.originalData && (
                  <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2 border-b border-slate-200 dark:border-slate-700 pb-1 flex items-center gap-1.5"><ShieldCheck size={12}/> Trazabilidad de Metadata</p>
                      <pre className="text-[9px] text-slate-600 dark:text-slate-400 font-mono overflow-auto max-h-32 custom-scrollbar">
                         {JSON.stringify(selectedTransaction.originalData, null, 2)}
                      </pre>
                  </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TributacionView() {
  return (
    <ErrorBoundary>
       <TributacionViewContent />
    </ErrorBoundary>
  );
}
