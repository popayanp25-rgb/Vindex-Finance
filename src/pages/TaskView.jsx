import React, { useState, useEffect } from 'react';
import { Plus, Search, MessageSquare, CheckCircle2, Clock, AlertCircle, Loader2, X, Trash2, Calendar as CalendarIcon, FileText, Mail, Edit2, FileDown } from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function TaskModal({ isOpen, onClose, onSave, users, casos, initialData }) {
  const { register, handleSubmit, reset } = useForm();
  
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({ ...initialData });
      } else {
        reset({ title: '', description: '', assigneeId: '', caseId: '', dueDate: '', dueTime: '' });
      }
    }
  }, [isOpen, initialData, reset]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col border border-brand-200 overflow-hidden">
        <div className="p-5 border-b border-brand-200 flex justify-between items-center bg-brand-50">
          <h2 className="text-lg font-black text-brand-900 flex items-center gap-2">
            {initialData ? <Edit2 size={18}/> : <Plus size={18}/>} 
            {initialData ? 'Editar Tarea' : 'Nueva Tarea'}
          </h2>
          <button type="button" onClick={onClose} className="text-brand-400 hover:text-brand-900 p-1.5 bg-brand-100 hover:bg-brand-200 rounded-full transition-colors"><X size={18}/></button>
        </div>
        
        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <form id="taskForm" onSubmit={handleSubmit(onSave)} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Título de la Tarea <span className="text-rose-500">*</span></label>
              <input {...register('title')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 transition-all font-medium text-brand-900" placeholder="Ej. Redactar contestación de demanda" required/>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Descripción (Opcional)</label>
              <textarea {...register('description')} rows={3} className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 transition-all font-medium text-brand-900 custom-scrollbar" placeholder="Detalles u observaciones de la tarea..."></textarea>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Asignado A <span className="text-rose-500">*</span></label>
                <select {...register('assigneeId')} className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 transition-all font-bold text-brand-900" required>
                  <option value="">Seleccione personal...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Expediente / Cliente <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  {...register('caseId')}
                  list="cases-list" 
                  className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 transition-all font-bold text-brand-900" 
                  placeholder="Buscar expediente..." 
                  autoComplete="off"
                  required
                />
                <datalist id="cases-list">
                  {casos.map(c => (
                    <option key={c.id} value={`${c.title} - ${c.clientName}`} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-brand-100 pt-4">
              <div>
                <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Fecha de Entrega <span className="text-rose-500">*</span></label>
                <input {...register('dueDate')} type="date" className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 transition-all font-bold text-brand-900" required/>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-1.5">Hora (Opcional)</label>
                <input {...register('dueTime')} type="time" className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-900 transition-all font-bold text-brand-900" />
              </div>
            </div>

            <p className="text-[10px] text-brand-400 font-bold italic text-center">La tarea se centralizará automáticamente en la Agenda Judicial y se preparará el enlace de GCal.</p>
          </form>
        </div>
        
        <div className="p-5 border-t border-brand-200 bg-brand-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 border border-brand-300 rounded-lg text-brand-700 hover:bg-brand-200 font-bold transition-colors text-xs uppercase tracking-wider">Cancelar</button>
          <button type="submit" form="taskForm" className="px-6 py-2.5 bg-brand-900 hover:bg-brand-800 text-white rounded-lg font-bold transition-all shadow-md shadow-brand-900/20 text-xs uppercase tracking-wider flex items-center gap-2">
            {initialData ? 'Guardar Cambios' : 'Crear y Notificar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TaskView() {
  const { userData } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [casos, setCasos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    const unsubTasks = onSnapshot(collection(db, 'tareas'), (snapshot) => {
      const sortedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const valA = a.dueDate ? new Date(a.dueTime ? `${a.dueDate}T${a.dueTime}` : a.dueDate).getTime() : Infinity;
          const valB = b.dueDate ? new Date(b.dueTime ? `${b.dueDate}T${b.dueTime}` : b.dueDate).getTime() : Infinity;
          return valA - valB;
        });
      setTasks(sortedTasks);
      setIsLoading(false);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCasos = onSnapshot(collection(db, 'casos'), (snapshot) => {
      setCasos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubTasks(); unsubUsers(); unsubCasos(); };
  }, []);

  const filteredTasks = tasks.filter(t => 
    t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.assigneeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.caseInfo?.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const getGCalLink = (taskTitle, date, time, description) => {
    const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
    const text = `&text=${encodeURIComponent('VINDEX Tarea: ' + taskTitle)}`;
    const details = `&details=${encodeURIComponent(description || 'Tarea asignada desde VINDEX Plataforma Legal.')}`;
    let dates = '';
    if (date) {
      const dt = date.replace(/-/g, '');
      dates = `&dates=${dt}/${dt}`;
    }
    return base + text + details + dates;
  };

  const createNotificationMessage = (task, assignedUser, isEmail = false) => {
    const firstName = assignedUser.nombre.split(' ')[0];
    const gcal = getGCalLink(task.title, task.dueDate, task.dueTime, task.description);
    const portalUrl = window.location.origin;
    
    let msg = isEmail 
      ? `Hola ${firstName},\n\nTienes una tarea asignada en VINDEX Legal Group:\n\n` 
      : `*VINDEX Legal Group*\n\nHola ${firstName}, tienes una tarea asignada:\n\n`;
    
    msg += isEmail ? `Título: ${task.title}\n` : `📌 *${task.title}*\n`;
    msg += isEmail ? `Expediente: ${task.caseInfo}\n` : `📁 *Expediente:* ${task.caseInfo}\n`;
    msg += isEmail ? `Límite: ${task.dueDate} ${task.dueTime}\n` : `⏳ *Fecha límite:* ${task.dueDate} ${task.dueTime}\n`;
    
    if (task.description) {
      msg += isEmail ? `Detalles: ${task.description}\n\n` : `\n📝 *Detalles:* ${task.description}\n\n`;
    } else {
      msg += '\n';
    }

    msg += isEmail 
      ? `📅 Añadir a Google Calendar: ${gcal}\n\n` 
      : `📅 *Google Calendar:* ${gcal}\n\n`;

    msg += isEmail
      ? `▶️ Abrir Intranet VINDEX: ${portalUrl}/mis-tareas`
      : `▶️ *Abrir Intranet VINDEX:* ${portalUrl}/mis-tareas`;

    return msg;
  };

  const notifyWhatsApp = (phone, msg) => {
    if (!phone) return alert("Este usuario no tiene un número de teléfono válido registrado.");
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const notifyEmail = (email, subject, msg) => {
    if (!email) {
       alert("Este usuario no tiene correo registrado.");
       return;
    }
    const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
    window.open(gmailLink, '_blank');
  };

  const handleSaveTask = async (data) => {
    setIsModalOpen(false);

    const assignedUser = users.find(u => u.id === data.assigneeId);
    const selectedCaseString = data.caseId;
    const relatedCase = casos.find(c => `${c.title} - ${c.clientName}` === selectedCaseString);

    if (!assignedUser || !relatedCase) {
      alert("Error: Usuario o Expediente seleccionado no es válido.");
      return;
    }

    const taskData = {
      title: data.title,
      description: data.description || '',
      assigneeId: assignedUser.id,
      assigneeName: assignedUser.nombre,
      assigneePhone: assignedUser.telefono,
      caseId: relatedCase.id,
      caseInfo: `${relatedCase.title} - ${relatedCase.clientName}`,
      dueDate: data.dueDate,
      dueTime: data.dueTime || '',
    };

    try {
      if (editingTask) {
        taskData.updatedAt = new Date().toISOString();
        taskData.updatedBy = userData?.nombre || 'Admin';
        
        await updateDoc(doc(db, 'tareas', editingTask.id), taskData);
        
        const q = query(collection(db, 'agenda'), where('taskId', '==', editingTask.id));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (d) => {
           await updateDoc(doc(db, 'agenda', d.id), {
             title: `T: ${data.title} (${assignedUser.nombre.split(' ')[0]})`,
             date: data.dueDate,
           });
        });

      } else {
        taskData.status = 'Pendiente';
        taskData.createdAt = new Date().toISOString();
        taskData.createdBy = userData?.nombre || 'Admin';

        const docRef = await addDoc(collection(db, 'tareas'), taskData);

        await addDoc(collection(db, 'agenda'), {
          taskId: docRef.id,
          title: `T: ${data.title} (${assignedUser.nombre.split(' ')[0]})`,
          date: data.dueDate,
          color: '#d97706',
        });

        if(confirm("¿Deseas notificar la creación de esta tarea vía WhatsApp al asignado?")) {
           const wMsg = createNotificationMessage(taskData, assignedUser, false);
           notifyWhatsApp(assignedUser.telefono, wMsg);
        }
      }
    } catch(err) {
      console.error(err);
      alert("Error al procesar la tarea.");
    }
  };

  const handleDeleteTask = async (task) => {
    if(confirm("¿Seguro que deseas eliminar esta tarea permanentemente? (Se eliminará también del calendario)")) {
      try {
        await deleteDoc(doc(db, 'tareas', task.id));
        const q = query(collection(db, 'agenda'), where('taskId', '==', task.id));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (d) => { await deleteDoc(doc(db, 'agenda', d.id)); });
      } catch(err){ console.error(err); }
    }
  };

  const handleFinalizeAndReport = async (task) => {
    if(!confirm("¿Deseas marcar esta tarea como 'Finalizada y Entregada'? Esto generará tu comprobante PDF localmente y eliminará la tarea permanentemente del sistema.")) return;
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

      // Eliminar tarea de Firestore
      await deleteDoc(doc(db, 'tareas', task.id));
      const q = query(collection(db, 'agenda'), where('taskId', '==', task.id));
      const snapshot = await getDocs(q);
      snapshot.forEach(async (d) => { await deleteDoc(doc(db, 'agenda', d.id)); });

    } catch (err) {
      console.error(err);
      alert("Error al intentar generar el PDF o eliminar la tarea.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-brand-200 overflow-hidden relative">
      <div className="p-6 border-b border-brand-200 bg-brand-50 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-xl font-black text-brand-900 tracking-tight flex items-center gap-2">
               Delegador de Tareas
               {(isLoading || isGeneratingPdf) && <Loader2 size={18} className="animate-spin text-brand-500" />}
             </h1>
             <p className="text-brand-600 text-xs mt-0.5 font-bold uppercase tracking-wider">Asignación estructurada y notificaciones multicanal</p>
          </div>
          <div className="flex gap-3">
             <div className="relative">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
               <input 
                 type="text" 
                 placeholder="Buscar tarea, usuario o expediente..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-9 pr-4 py-2.5 border border-brand-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 w-full md:w-72 transition-all font-medium"
               />
             </div>
             <button onClick={openNewModal} className="flex items-center gap-2 bg-brand-900 hover:bg-brand-800 text-white px-5 py-2.5 rounded-lg font-bold shadow-md shadow-brand-900/20 transition-all text-xs tracking-wide uppercase whitespace-nowrap">
               <Plus size={16} strokeWidth={3} />
               Nueva Tarea
             </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
        <div className="space-y-4 max-w-5xl mx-auto">
          {filteredTasks.map(task => {
            const displayStatus = task.status === 'completed' || task.status === 'pending' ? (task.status === 'completed' ? 'Finalizada' : 'Pendiente') : task.status;
            const isCompleted = displayStatus === 'Finalizada';
            return (
            <div key={task.id} className={`bg-white border rounded-xl overflow-hidden transition-all hover:shadow-md ${isCompleted ? 'border-emerald-200' : 'border-brand-200'}`}>
              
              <div className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${isCompleted ? 'bg-emerald-50/30' : ''}`}>
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-full">
                    <div className="flex items-center gap-2">
                       <h3 className={`font-bold text-base ${isCompleted ? 'text-brand-900' : 'text-brand-900'}`}>{task.title}</h3>
                       <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                         displayStatus === 'Pendiente' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                         displayStatus === 'En Proceso' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                         displayStatus === 'En Revisión' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                         'bg-emerald-100 text-emerald-700 border-emerald-200'
                       }`}>{displayStatus}</span>
                    </div>
                    {task.description && (
                      <p className={`text-sm mt-1 ${isCompleted ? 'text-slate-600' : 'text-slate-600'}`}>{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      {task.caseInfo && (
                        <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-1 rounded-md border border-brand-200 flex items-center gap-1">
                          <FileText size={12}/> {task.caseInfo}
                        </span>
                      )}
                      {(task.dueDate || task.dueTime) && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${isCompleted ? 'text-emerald-700' : 'text-amber-600'}`}>
                           <CalendarIcon size={12} /> Límite: {task.dueDate} {task.dueTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 md:w-[420px] shrink-0 justify-between md:justify-end border-t md:border-t-0 md:border-l border-brand-100 pt-3 md:pt-0 md:pl-6 mt-3 md:mt-0">
                  <div className="flex flex-col items-center md:items-end">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Responsable</span>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center text-[11px] font-black text-brand-800 border border-brand-200">
                        {task.assigneeName?.charAt(0) || '?'}
                      </div>
                      <span className="text-sm font-bold text-brand-900 block leading-tight">{task.assigneeName}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                     <div className="flex space-x-1 justify-center">
                       {isCompleted ? (
                         <button onClick={() => handleFinalizeAndReport(task)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-bold text-xs shadow-md flex items-center gap-2 uppercase tracking-wide">
                            <FileDown size={16} />
                            Finalizado y Entregado
                         </button>
                       ) : (
                         <>
                           <button onClick={() => {
                               const user = users.find(u => u.id === task.assigneeId);
                               if(user) notifyWhatsApp(user.telefono, createNotificationMessage(task, user, false));
                           }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="WhatsApp">
                             <MessageSquare size={16} />
                           </button>
                           <button onClick={() => {
                               const user = users.find(u => u.id === task.assigneeId);
                               if(user) notifyEmail(user.email, "Asignación de Tarea: " + task.title, createNotificationMessage(task, user, true));
                           }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Correo Electrónico">
                             <Mail size={16} />
                           </button>
                           <button onClick={() => openEditModal(task)} className="p-2 text-brand-500 hover:bg-brand-50 rounded-lg transition-colors" title="Editar">
                             <Edit2 size={16} />
                           </button>
                           <button onClick={() => handleDeleteTask(task)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar">
                             <Trash2 size={16} />
                           </button>
                         </>
                       )}
                     </div>
                     <button 
                       onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                       className="w-full text-[10px] font-bold uppercase py-1.5 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition-colors"
                     >
                        Ver Bitácora {task.comments?.length > 0 ? `(${task.comments.length})` : ''}
                     </button>
                  </div>
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
                       <p className="text-xs text-slate-400 font-medium italic text-center py-4">No hay avances registrados aún por el empleado.</p>
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
                </div>
              )}

            </div>
          )})}
          
          {!isLoading && filteredTasks.length === 0 && (
             <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
               <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
               <p className="text-slate-600 font-bold text-lg mb-1">Cero tareas asignadas</p>
               <p className="text-slate-500 font-medium text-sm">El equipo está al día con sus procesos.</p>
             </div>
          )}
        </div>
      </div>

      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveTask} users={users} casos={casos} initialData={editingTask} />
    </div>
  );
}
