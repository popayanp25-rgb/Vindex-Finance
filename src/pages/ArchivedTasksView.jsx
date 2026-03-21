import React, { useState, useEffect } from 'react';
import { Search, Loader2, Calendar as CalendarIcon, FileText, Download, Archive, CheckCircle2 } from 'lucide-react';
import { collection, query, where, getDocs, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ArchivedTasksView() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Calculamos la fecha límite (hace 15 días)
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const fifteenDaysAgoStr = fifteenDaysAgo.toISOString();

    const q = query(
      collection(db, 'archivador_tareas'),
      where('deliveredAt', '>=', fifteenDaysAgoStr)
    );

    const unsubTasks = onSnapshot(q, (snapshot) => {
      const activeArchive = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenar por fecha de entrega más reciente
      activeArchive.sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt));
      setTasks(activeArchive);
      setIsLoading(false);
    });

    // Limpieza pasiva: buscar y eliminar los que tengan más de 15 días
    const cleanupOldTasks = async () => {
       try {
         const oldQ = query(
           collection(db, 'archivador_tareas'),
           where('deliveredAt', '<', fifteenDaysAgoStr)
         );
         const oldDocs = await getDocs(oldQ);
         oldDocs.forEach(async (d) => {
            await deleteDoc(doc(db, 'archivador_tareas', d.id));
         });
       } catch (err) {
         console.warn("Error en limpieza pasiva de archivador:", err);
       }
    };
    cleanupOldTasks();

    return () => unsubTasks();
  }, []);

  const filteredTasks = tasks.filter(t => 
    t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.assigneeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.caseInfo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownloadReport = (task) => {
    try {
      const docPdf = new jsPDF();
      
      const finishDateObj = new Date(task.deliveredAt);
      const day = finishDateObj.getDate().toString().padStart(2, '0');
      const month = (finishDateObj.getMonth() + 1).toString().padStart(2, '0');
      const year = finishDateObj.getFullYear();
      const safeAssignee = (task.assigneeName || 'USUARIO').split(' ')[0].toUpperCase();
      const trackingId = `#${year}-${month}-${day}-${safeAssignee}`;

      // Header
      docPdf.setFontSize(22);
      docPdf.setFont("helvetica", "bold");
      docPdf.setTextColor(15, 23, 42); 
      docPdf.text('VINDEX LEGAL GROUP', 105, 20, { align: "center" });
      
      docPdf.setFontSize(14);
      docPdf.text('REPORTE DE CUMPLIMIENTO DE TAREA', 105, 28, { align: "center" });
      
      docPdf.setFontSize(10);
      docPdf.setFont("helvetica", "normal");
      docPdf.text(`ID DE SEGUIMIENTO: ${trackingId}`, 105, 34, { align: "center" });

      docPdf.setDrawColor(200, 200, 200);
      docPdf.line(14, 38, 196, 38);

      const reportDateStr = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      const reportTimeStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute:'2-digit' });

      docPdf.setFontSize(9);
      docPdf.text(`Documento generado por: VINDEX Intranet`, 14, 46);
      docPdf.text(`Fecha y hora de emisión de la copia de archivo: ${reportDateStr} – ${reportTimeStr} horas`, 14, 51);

      // Seccion 1
      docPdf.setFontSize(11);
      docPdf.setFont("helvetica", "bold");
      docPdf.text('I. INFORMACIÓN GENERAL DEL EXPEDIENTE', 14, 62);

      const taskDataArray = [
        ['Título de la Tarea', task.title || ''],
        ['Expediente / Cliente', task.caseInfo || ''],
        ['Responsable Asignado', task.assigneeName || ''],
        ['Fecha Límite', `${task.dueDate || ''} – ${task.dueTime || ''} horas`],
        ['Estado Actual', 'FINALIZADA']
      ];
      
      autoTable(docPdf, {
        startY: 65,
        head: [['Dato', 'Detalle']],
        body: taskDataArray,
        theme: 'grid',
        headStyles: { fillColor: [40, 40, 40] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, fillColor: [245, 245, 245] } }
      });

      // Seccion 2
      let lastY = docPdf.lastAutoTable.finalY + 12;
      docPdf.setFontSize(11);
      docPdf.setFont("helvetica", "bold");
      docPdf.text('II. DESCRIPCIÓN DE LA GESTIÓN REALIZADA', 14, lastY);

      lastY += 8;
      docPdf.setFontSize(9);
      docPdf.text('Descripción original de la tarea:', 14, lastY);
      docPdf.setFont("helvetica", "normal");
      
      const descLines = docPdf.splitTextToSize(task.description || 'Sin descripción.', 180);
      docPdf.text(descLines, 14, lastY + 5);
      
      lastY += 5 + (descLines.length * 4) + 6;
      
      docPdf.setFont("helvetica", "bold");
      docPdf.text('Fecha de finalización de la tarea:', 14, lastY);
      docPdf.setFont("helvetica", "normal");
      const finishDateStr = finishDateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      const finishTimeStr = finishDateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute:'2-digit' });
      docPdf.text(`${finishDateStr} – ${finishTimeStr} horas`, 14, lastY + 5);

      lastY += 15;

      // Seccion 3
      docPdf.setFontSize(11);
      docPdf.setFont("helvetica", "bold");
      docPdf.text('III. HISTORIAL DE AVANCES Y BITÁCORA', 14, lastY);
      
      docPdf.setFontSize(9);
      docPdf.setFont("helvetica", "normal");
      docPdf.text('Registro cronológico de las actuaciones efectuadas en el marco del encargo profesional:', 14, lastY + 6);

      const commentsArray = (task.comments || []).map(c => {
        const cDate = new Date(c.date);
        const dateStr = `${cDate.toLocaleDateString('es-ES')} – ${cDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute:'2-digit' })}`;
        return [dateStr, c.author, c.text];
      });

      if (commentsArray.length > 0) {
        autoTable(docPdf, {
          startY: lastY + 10,
          head: [['Fecha y Hora', 'Autor', 'Detalle del Avance']],
          body: commentsArray,
          theme: 'grid',
          headStyles: { fillColor: [40, 40, 40] },
          styles: { fontSize: 8, cellPadding: 3 }
        });
        lastY = docPdf.lastAutoTable.finalY + 15;
      } else {
        docPdf.setFont("helvetica", "italic");
        docPdf.text('Sin registros en la bitácora.', 14, lastY + 12);
        lastY += 20;
      }

      if (lastY > 220) {
        docPdf.addPage();
        lastY = 20;
      }

      // Seccion 4
      docPdf.setFontSize(11);
      docPdf.setFont("helvetica", "bold");
      docPdf.text('IV. CERTIFICACIÓN DE CUMPLIMIENTO', 14, lastY);
      
      docPdf.setFontSize(9);
      docPdf.setFont("helvetica", "normal");
      const text4 = `Mediante el presente documento, se deja constancia que la tarea denominada "${task.title || ''}", vinculada al expediente ${task.caseInfo || ''}, ha sido ejecutada conforme a los estándares internos del estudio y dentro del plazo establecido.`;
      const text4Lines = docPdf.splitTextToSize(text4, 180);
      docPdf.text(text4Lines, 14, lastY + 6);
      
      lastY += 6 + (text4Lines.length * 4) + 8;

      // Seccion 5
      docPdf.setFontSize(11);
      docPdf.setFont("helvetica", "bold");
      docPdf.text('V. CONSTANCIA DEL SISTEMA', 14, lastY);
      docPdf.setFontSize(9);
      docPdf.setFont("helvetica", "normal");
      const text5 = `El presente reporte constituye una constancia digital de cumplimiento, recuperada del Archivo de VINDEX Intranet, demostrando la ejecución íntegra y cronológica de este requerimiento, con sus respectivas horas de acreditación.`;
      const text5Lines = docPdf.splitTextToSize(text5, 180);
      docPdf.text(text5Lines, 14, lastY + 6);

      lastY += 6 + (text5Lines.length * 4) + 15;
      
      docPdf.setFont("helvetica", "bold");
      docPdf.text('VINDEX LEGAL GROUP', 14, lastY);
      docPdf.setFont("helvetica", "normal");
      docPdf.text('Área de Control y Seguimiento de Procesos', 14, lastY + 5);

      const safeTitleObj = (task.title || 'Tarea').replace(/\s+/g, '_');
      const pdfTitleFile = `Copia_Archivo_Reporte_${safeTitleObj}_${safeAssignee}.pdf`;
      docPdf.save(pdfTitleFile);

    } catch (err) {
      console.error(err);
      alert("Error al regenerar el PDF del archivo.");
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
      <div className="p-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
               Archivo de Tareas Completadas
               {isLoading && <Loader2 size={18} className="animate-spin text-slate-400" />}
             </h1>
             <p className="text-slate-500 text-xs mt-0.5 font-bold uppercase tracking-wider">Retención automática por 15 días</p>
          </div>
          <div className="flex gap-3">
             <div className="relative">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Buscar en el archivo..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-9 pr-4 py-2.5 border border-slate-300 bg-slate-50 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full md:w-72 transition-all font-medium text-slate-700"
               />
             </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
        <div className="space-y-4 max-w-5xl mx-auto">
          {filteredTasks.map(task => (
            <div key={task.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md hover:border-slate-300">
              
              <div className="flex items-start gap-4 flex-1">
                <div className="mt-1 rounded-full p-1 bg-slate-100 text-slate-400">
                  <Archive size={20} strokeWidth={2.5} />
                </div>
                <div className="w-full">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-700">{task.title}</h3>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">Archivada</span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                      <CheckCircle2 size={12}/> Entregada: {new Date(task.deliveredAt).toLocaleString()}
                    </span>
                    {task.caseInfo && (
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <FileText size={12}/> {task.caseInfo}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6 shrink-0 justify-between md:justify-end border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6 mt-3 md:mt-0">
                <div className="flex flex-col items-center md:items-end">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Responsable</span>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 border border-slate-200">
                      {task.assigneeName?.charAt(0) || '?'}
                    </div>
                    <span className="text-sm font-bold text-slate-700 block leading-tight">{task.assigneeName}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleDownloadReport(task)}
                  className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors shadow-sm"
                >
                  <Download size={14} /> Descargar PDF
                </button>
              </div>

            </div>
          ))}
          
          {!isLoading && filteredTasks.length === 0 && (
             <div className="text-center py-16 border-2 border-dashed border-slate-300 rounded-2xl bg-white/50">
               <Archive size={48} className="mx-auto text-slate-300 mb-4" />
               <p className="text-slate-600 font-bold text-lg mb-1">Archivador Vacío</p>
               <p className="text-slate-500 font-medium text-sm">No hay tareas entregadas en los últimos 15 días registradas.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
