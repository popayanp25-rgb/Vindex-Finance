import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, CheckCircle2, Clock, AlertCircle, Loader2, Calendar as CalendarIcon, FileText, Send, FileDown } from 'lucide-react';
import { collection, onSnapshot, updateDoc, doc, arrayUnion, query, where, deleteDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MyTasksView() {
  const { userData } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    if (!userData?.uid && !userData?.id) return;
    const userId = userData.uid || userData.id;
    
    const q = query(collection(db, 'tareas'), where('assigneeId', '==', userId));
    const unsubTasks = onSnapshot(q, (snapshot) => {
      const sortedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const valA = a.dueDate ? new Date(a.dueTime ? `${a.dueDate}T${a.dueTime}` : a.dueDate).getTime() : Infinity;
          const valB = b.dueDate ? new Date(b.dueTime ? `${b.dueDate}T${b.dueTime}` : b.dueDate).getTime() : Infinity;
          return valA - valB;
        });
      setTasks(sortedTasks);
      setIsLoading(false);
    });

    return () => unsubTasks();
  }, [userData]);

  const filteredTasks = tasks.filter(t => 
    t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.caseInfo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await updateDoc(doc(db, 'tareas', taskId), { status: newStatus });
    } catch(err) {
      console.error("Error al cambiar estado:", err);
    }
  };

  const handleAddComment = async (taskId) => {
    if (!commentText.trim()) return;
    try {
      const newComment = {
        id: Date.now().toString(),
        text: commentText.trim(),
        date: new Date().toISOString(),
        author: userData.nombre
      };
      
      await updateDoc(doc(db, 'tareas', taskId), {
        comments: arrayUnion(newComment)
      });
      
      setCommentText('');
    } catch(err) {
      console.error("Error al añadir comentario:", err);
    }
  };

  const handleFinalizeAndReport = async (task) => {
    if(!confirm("¿Deseas marcar esta tarea como 'Finalizada y Entregada'? Esto generará tu comprobante PDF localmente y enviará la tarea al archivador temporal.")) return;
    setIsGeneratingPdf(true);

    try {
      const docPdf = new jsPDF();
      
      const finishDateObj = new Date();
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
      docPdf.text(`Fecha y hora de emisión del reporte: ${reportDateStr} – ${reportTimeStr} horas`, 14, 51);

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
      const text5 = `El presente reporte constituye una constancia digital de cumplimiento, emitida por el sistema interno de gestión VINDEX Intranet, incluyendo la fecha y hora exacta de su generación, con fines de control de calidad, trazabilidad y supervisión de actividades del estudio jurídico.`;
      const text5Lines = docPdf.splitTextToSize(text5, 180);
      docPdf.text(text5Lines, 14, lastY + 6);

      lastY += 6 + (text5Lines.length * 4) + 15;
      
      docPdf.setFont("helvetica", "bold");
      docPdf.text('VINDEX LEGAL GROUP', 14, lastY);
      docPdf.setFont("helvetica", "normal");
      docPdf.text('Área de Control y Seguimiento de Procesos', 14, lastY + 5);

      const safeTitleObj = (task.title || 'Tarea').replace(/\s+/g, '_');
      const pdfTitleFile = `Reporte_Cumplimiento_${safeTitleObj}_${safeAssignee}.pdf`;
      docPdf.save(pdfTitleFile);

      await addDoc(collection(db, 'archivador_tareas'), {
        title: task.title,
        description: task.description || '',
        caseInfo: task.caseInfo,
        assigneeName: task.assigneeName,
        dueDate: task.dueDate,
        dueTime: task.dueTime || '',
        createdAt: task.createdAt || new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
        comments: task.comments || [],
        status: 'Finalizada'
      });

      await deleteDoc(doc(db, 'tareas', task.id));
      const q = query(collection(db, 'agenda'), where('taskId', '==', task.id));
      const snapshot = await getDocs(q);
      snapshot.forEach(async (d) => { await deleteDoc(doc(db, 'agenda', d.id)); });

    } catch (err) {
      console.error(err);
      alert("Error al intentar generar el PDF o archivar la tarea.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Pendiente': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'En Proceso': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'En Revisión': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Finalizada': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-brand-200 overflow-hidden relative">
      <div className="p-6 border-b border-brand-200 bg-brand-50 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-xl font-black text-brand-900 tracking-tight flex items-center gap-2">
               Mis Tareas
               {(isLoading || isGeneratingPdf) && <Loader2 size={18} className="animate-spin text-brand-500" />}
             </h1>
             <p className="text-brand-600 text-xs mt-0.5 font-bold uppercase tracking-wider">Panel personal de autogestión e historial</p>
          </div>
          <div className="flex gap-3">
             <div className="relative">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
               <input 
                 type="text" 
                 placeholder="Buscar tarea o expediente..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-9 pr-4 py-2.5 border border-brand-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 w-full md:w-64 transition-all font-medium"
               />
             </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
        <div className="space-y-4 max-w-4xl mx-auto">
          {filteredTasks.map(task => {
            const isCompleted = task.status === 'Finalizada' || task.status === 'completed';
            const displayStatus = task.status === 'completed' || task.status === 'pending' ? (task.status === 'completed' ? 'Finalizada' : 'Pendiente') : task.status;
            
            return (
            <div key={task.id} className={`bg-white border rounded-xl overflow-hidden transition-all hover:shadow-md ${isCompleted ? 'border-emerald-200' : 'border-brand-200'}`}>
              
              <div className={`p-5 flex flex-col md:flex-row justify-between gap-4 ${isCompleted ? 'bg-emerald-50/30' : ''}`}>
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-full">
                    <h3 className={`font-bold text-base ${isCompleted ? 'text-slate-500 line-through' : 'text-brand-900'}`}>{task.title}</h3>
                    {task.description && (
                      <p className={`text-sm mt-1 ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      {task.caseInfo && (
                        <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-1 rounded-md border border-brand-200 flex items-center gap-1">
                          <FileText size={12}/> {task.caseInfo}
                        </span>
                      )}
                      {(task.dueDate || task.dueTime) && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${isCompleted ? 'text-slate-400' : 'text-rose-600'}`}>
                           <CalendarIcon size={12} /> Límite: {task.dueDate} {task.dueTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:w-64 shrink-0 justify-center border-t md:border-t-0 md:border-l border-brand-100 pt-3 md:pt-0 md:pl-6 mt-3 md:mt-0">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Estado Actual</span>
                    <select 
                      value={displayStatus}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                      className={`text-xs font-bold px-3 py-2 rounded-lg border outline-none cursor-pointer transition-colors ${getStatusColor(displayStatus)}`}
                    >
                       <option value="Pendiente">Pendiente</option>
                       <option value="En Proceso">En Proceso</option>
                       <option value="En Revisión">En Revisión</option>
                       <option value="Finalizada">Finalizada (Aprobación)</option>
                    </select>
                  </div>
                  
                  {isCompleted && (
                     <button 
                       onClick={() => handleFinalizeAndReport(task)}
                       className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-lg transition-colors shadow-md my-1"
                     >
                        <FileDown size={14} />
                        Finalizado y Entregado
                     </button>
                  )}

                  <button 
                    onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 hover:bg-brand-100 py-2 rounded-lg transition-colors border border-brand-200"
                  >
                    <MessageSquare size={14} />
                    Bitácora {task.comments?.length > 0 ? `(${task.comments.length})` : ''}
                  </button>
                </div>
              </div>

              {/* Bitácora Dropdown */}
              {expandedTaskId === task.id && (
                <div className="bg-slate-50 border-t border-brand-100 p-5 animate-in slide-in-from-top-2 duration-200">
                  <h4 className="text-xs font-bold text-brand-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <MessageSquare size={14} /> Historial y Avances
                  </h4>
                  
                  <div className="space-y-4 mb-4 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                    {(!task.comments || task.comments.length === 0) ? (
                       <p className="text-xs text-slate-400 font-medium italic text-center py-4">No hay avances registrados aún.</p>
                    ) : (
                       task.comments.map(c => (
                         <div key={c.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                           <div className="flex justify-between items-center mb-1">
                             <span className="text-[11px] font-bold text-brand-700">{c.author}</span>
                             <span className="text-[9px] font-bold uppercase text-slate-400">{new Date(c.date).toLocaleString()}</span>
                           </div>
                           <p className="text-sm text-slate-700">{c.text}</p>
                         </div>
                       ))
                    )}
                  </div>

                  {!isCompleted && (
                    <div className="flex gap-2 relative mt-4">
                      <input 
                        type="text" 
                        placeholder="Escribir avance o pegar un Enlace externo (Drive)..." 
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment(task.id)}
                        className="flex-1 bg-white border border-brand-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 transition-all font-medium pr-12"
                      />
                      <button 
                        onClick={() => handleAddComment(task.id)}
                        disabled={!commentText.trim()}
                        className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square bg-brand-900 hover:bg-brand-800 text-white rounded-md flex items-center justify-center transition-all disabled:opacity-50"
                      >
                         <Send size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          )})}
          
          {!isLoading && filteredTasks.length === 0 && (
             <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
               <CheckCircle2 size={48} className="mx-auto text-brand-300 mb-4" />
               <p className="text-brand-900 font-bold text-lg mb-1">¡Todo limpio!</p>
               <p className="text-brand-500 font-medium text-sm">No tienes tareas asignadas por el momento.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
