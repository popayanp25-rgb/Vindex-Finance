import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { Plus, Filter, X, Loader2, Search, ExternalLink, Calendar as CalIcon, MessageCircle, Mail, FileText } from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useForm } from 'react-hook-form';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function EventModal({ isOpen, onClose, onSave, casos, abogados, initialData }) {
  const { register, handleSubmit, reset, watch, setValue } = useForm();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const watchLawyerId = watch('lawyerId');
  const watchCaseId = watch('caseId');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset(initialData);
        if (initialData.caseId && casos) {
          const selectedCase = casos.find(c => c.id === initialData.caseId);
          if (selectedCase) setSearchTerm(`${selectedCase.title} - ${selectedCase.clientName}`);
        }
      } else {
        reset({ color: '#1e3a8a', title: '', date: '', startTime: '09:00', endTime: '10:00', meetUrl: '', caseId: '', lawyerId: '', clientEmail: '', clientPhone: '', lawyerEmail: '', lawyerPhone: '' });
        setSearchTerm('');
      }
    }
  }, [isOpen, reset, initialData, casos]);

  // Autocompletar cuando se elige abogado
  useEffect(() => {
    if (watchLawyerId && abogados) {
      const selectedAbogado = abogados.find(a => a.id === watchLawyerId);
      if (selectedAbogado) {
        setValue('lawyerEmail', selectedAbogado.email || '');
        setValue('lawyerPhone', selectedAbogado.phone || '');
      }
    }
  }, [watchLawyerId, abogados, setValue]);

  if (!isOpen) return null;

  const filteredCasos = casos.filter(c => 
    `${c.title} ${c.clientName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectCase = (caso) => {
    setValue('caseId', caso.id);
    setValue('clientEmail', caso.email || '');
    setValue('clientPhone', caso.phone || '');
    setSearchTerm(`${caso.title} - ${caso.clientName}`);
    setIsDropdownOpen(false);
  };

  const onSubmit = (data) => {
    // Buscar referencias completas para guardarlas
    const selectedCase = casos.find(c => c.id === data.caseId);
    const selectedAbogado = abogados.find(a => a.id === data.lawyerId);
    
    onSave({
      ...data,
      id: initialData?.id,
      caseInfo: selectedCase ? `${selectedCase.title} - ${selectedCase.clientName}` : '',
      clientName: selectedCase ? selectedCase.clientName : '',
      lawyerName: selectedAbogado ? selectedAbogado.name : ''
    });
  };

  return (
    <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-brand-200">
        <div className="p-5 border-b border-brand-200 flex justify-between items-center bg-brand-50 shrink-0">
          <h2 className="text-xl font-black text-brand-900 flex items-center gap-2">
            <CalIcon size={20} className="text-brand-600"/> Nuevo Evento Estratégico
          </h2>
          <button type="button" onClick={onClose} className="text-brand-400 hover:text-brand-900 p-1.5 bg-brand-100 hover:bg-brand-200 rounded-full transition-colors"><X size={18}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="intelligentEventForm" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            
            {/* Título y Fechas */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-brand-700 mb-1">Título / Asunto <span className="text-brand-500">*</span></label>
                <input {...register('title')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 transition-shadow" placeholder="Ej. Audiencia de Conciliación" required/>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1">Fecha <span className="text-brand-500">*</span></label>
                  <input {...register('date')} type="date" className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 transition-shadow" required/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1">Hora Inicio <span className="text-brand-500">*</span></label>
                  <input {...register('startTime')} type="time" className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 transition-shadow" required/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-700 mb-1">Hora Fin <span className="text-brand-500">*</span></label>
                  <input {...register('endTime')} type="time" className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 transition-shadow" required/>
                </div>
              </div>
            </div>

            <div className="border-t border-brand-100 my-2"></div>

            {/* Referencia de Caso Inteligente */}
            <div className="relative">
              <label className="block text-xs font-bold text-brand-700 mb-1 flex items-center gap-1">
                <Search size={14}/> Buscar Cuaderno / Cliente <span className="text-brand-500">*</span>
              </label>
              <input 
                  type="text"
                  value={searchTerm}
                  placeholder="Escriba el N° o Nombre del Cliente..."
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (watchCaseId) setValue('caseId', ''); 
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                  className="w-full border border-brand-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-900 transition-all bg-brand-50"
                  required={!watchCaseId}
                />
                {isDropdownOpen && (
                  <div className="absolute top-[60px] left-0 w-full bg-white border border-brand-300 shadow-xl rounded-lg max-h-40 overflow-y-auto z-[100]">
                    {filteredCasos.length > 0 ? (
                      filteredCasos.map(c => (
                        <div key={c.id} className="px-4 py-2 hover:bg-brand-50 cursor-pointer border-b border-brand-100" onClick={() => handleSelectCase(c)}>
                          <div className="font-bold text-brand-900 text-sm">{c.title}</div>
                          <div className="text-xs text-brand-600 font-medium">{c.clientName}</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-brand-500 text-center">No se encontraron cuadernos de cobranza.</div>
                    )}
                  </div>
                )}
                <input type="hidden" {...register('caseId')} required />
            </div>

            {/* Abogado y Contactos Extrapolados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                 <label className="block text-xs font-bold text-brand-700 mb-1">Abogado Asignado <span className="text-brand-500">*</span></label>
                 <select {...register('lawyerId')} required className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 transition-shadow bg-white font-medium text-brand-900">
                   <option value="">Seleccionar Abogado del Catálogo...</option>
                   {abogados && abogados.map(a => (
                     <option key={a.id} value={a.id}>{a.name}</option>
                   ))}
                 </select>
              </div>

              {/* Emails y Teléfonos Listos para Google / WhatsApp */}
              <div className="space-y-3 bg-brand-50 p-3 rounded-xl border border-brand-100">
                 <h4 className="text-[10px] uppercase font-black tracking-widest text-brand-500 mb-2 border-b border-brand-200 pb-1">Contacto Cliente (Autofill)</h4>
                 <div>
                   <label className="block text-[10px] font-bold text-brand-700">Correo Cliente</label>
                   <input {...register('clientEmail')} type="email" className="w-full bg-white border border-brand-200 rounded md:px-2 md:py-1 text-xs" placeholder="Ej. cliente@mail.com"/>
                 </div>
                 <div>
                   <label className="block text-[10px] font-bold text-brand-700">Celular Cliente</label>
                   <input {...register('clientPhone')} type="tel" className="w-full bg-white border border-brand-200 rounded md:px-2 md:py-1 text-xs" placeholder="Ej. +51..."/>
                 </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                 <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2 border-b border-slate-200 pb-1">Contacto Abogado</h4>
                 <div>
                   <label className="block text-[10px] font-bold text-slate-700">Correo Institucional</label>
                   <input {...register('lawyerEmail')} type="email" className="w-full bg-white border border-slate-200 rounded md:px-2 md:py-1 text-xs" placeholder="Auto..."/>
                 </div>
                 <div>
                   <label className="block text-[10px] font-bold text-slate-700">Celular Abogado</label>
                   <input {...register('lawyerPhone')} type="tel" className="w-full bg-white border border-slate-200 rounded md:px-2 md:py-1 text-xs" placeholder="Auto..."/>
                 </div>
              </div>
            </div>

            {/* Meet Opcional y Color */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-brand-700 mb-1">Link</label>
                <input {...register('meetUrl')} type="text" className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 transition-shadow" placeholder="Opcional. Ej. enlace de audiencia..."/>
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-700 mb-1">Etiqueta (Color)</label>
                <select {...register('color')} className="w-full border border-brand-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-900 transition-shadow font-bold">
                  <option value="#1e3a8a">Azul (Audiencias/Principal)</option>
                  <option value="#e11d48">Rojo (Vencimientos Críticos)</option>
                  <option value="#047857">Verde (Reuniones Clientes)</option>
                  <option value="#d97706">Dorado (Escritos/Trámites)</option>
                </select>
              </div>
            </div>

          </form>
        </div>
        
        <div className="p-5 border-t border-brand-200 bg-brand-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 border border-brand-300 rounded-lg text-brand-700 hover:bg-brand-200 font-bold transition-colors text-xs uppercase tracking-wider bg-white">Cancelar</button>
          <button type="submit" form="intelligentEventForm" className="px-6 py-2.5 bg-brand-900 hover:bg-brand-800 text-white rounded-lg font-black transition-all shadow-md shadow-brand-900/20 text-xs uppercase tracking-wider flex items-center gap-2">
            {initialData ? 'Actualizar Evento' : 'Guardar y Sincronizar Google'} <ExternalLink size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// Componente para Eventos Post-creados (Acciones Rápidas)
function ActionModal({ isOpen, onClose, event, onDelete, onEdit }) {
  if (!isOpen || !event) return null;

  const notifyClientWhatsApp = () => {
    if(!event.clientPhone) return alert("El cliente no tiene un teléfono registrado.");
    const number = event.clientPhone.replace(/\D/g, '');
    let msg = `Estimado(a) ${event.clientName || 'Cliente'},\n\nLe informamos que se ha programado una diligencia legal de carácter obligatorio:\n\n⚖️ *Detalles de la Audiencia:*\n\n*Asunto:* ${event.title}\n\n*Cuaderno:* ${event.caseInfo}\n\n*Fecha:* ${event.date}\n\n*Hora:* ${event.startTime}`;
    if (event.meetUrl) msg += `\n\n*Link:* ${event.meetUrl}`;
    msg += `\n\n📌 *Acción requerida:* Por favor, confirme su asistencia respondiendo a este mensaje. Su presencia es fundamental para el proceso.\n\nAtentamente,\nVINDEX LEGAL GROUP`;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const notifyLawyerWhatsApp = () => {
    if(!event.lawyerPhone) return alert("El abogado no tiene un teléfono registrado.");
    const number = event.lawyerPhone.replace(/\D/g, '');
    let msg = `Hola, ${event.lawyerName || 'Doctor(a)'}. Se le informa que tiene un nuevo evento programado en su agenda:\n\n📂 *Información del Caso:*\n\n*Evento:* ${event.title}\n\n*Cuaderno:* ${event.caseInfo}\n\n*Fecha:* ${event.date}\n\n*Hora:* ${event.startTime}`;
    if(event.meetUrl) msg += `\n\n*Link:* ${event.meetUrl}`;
    msg += `\n\nSaludos,\nVINDEX LEGAL GROUP`;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const notifyClientEmail = () => {
    if(!event.clientEmail) return alert("El cliente no tiene un correo registrado.");
    const subject = encodeURIComponent(`Notificación de Audiencia: ${event.title}`);
    let body = `Estimado(a) ${event.clientName || 'Cliente'},\n\nLe informamos que se ha programado una diligencia legal de carácter obligatorio:\n\nDetalles de la Audiencia:\nAsunto: ${event.title}\nCuaderno: ${event.caseInfo}\nFecha: ${event.date}\nHora: ${event.startTime}`;
    if (event.meetUrl) body += `\nLink: ${event.meetUrl}`;
    body += `\n\nAcción requerida: Por favor, confirme su asistencia respondiendo a este mensaje. Su presencia es fundamental para el proceso.\n\nAtentamente,\nVINDEX LEGAL GROUP`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${event.clientEmail}&su=${subject}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  const notifyLawyerEmail = () => {
    if(!event.lawyerEmail) return alert("El abogado no tiene un correo registrado.");
    const subject = encodeURIComponent(`Nuevo Evento Asignado: ${event.title}`);
    let body = `Hola, ${event.lawyerName || 'Doctor(a)'}.\n\nSe le informa que tiene un nuevo evento programado en su agenda:\n\nInformación del Caso:\nEvento: ${event.title}\nCuaderno: ${event.caseInfo}\nFecha: ${event.date}\nHora: ${event.startTime}`;
    if(event.meetUrl) body += `\nLink: ${event.meetUrl}`;
    body += `\n\nSaludos,\nVINDEX LEGAL GROUP`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${event.lawyerEmail}&su=${subject}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-brand-900/40 backdrop-blur-[1px] flex items-center justify-center z-[150] p-4">
       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col border border-brand-200 p-6 space-y-3">
          <div>
            <h3 className="text-xl font-black text-brand-900">{event.title}</h3>
            <p className="text-xs text-brand-600 font-bold uppercase tracking-wider mt-1">{event.date} | {event.startTime} - {event.endTime}</p>
          </div>
          
           <div className="grid grid-cols-2 gap-3">
             <button onClick={notifyClientWhatsApp} className="flex flex-col items-center justify-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 p-4 rounded-xl border border-green-200 transition-colors shadow-sm text-xs font-bold text-center group">
               <MessageCircle size={22} className="group-hover:scale-110 transition-transform"/> WhatsApp Cliente
             </button>
             <button onClick={notifyLawyerWhatsApp} className="flex flex-col items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 p-4 rounded-xl border border-blue-200 transition-colors shadow-sm text-xs font-bold text-center group">
               <MessageCircle size={22} className="group-hover:scale-110 transition-transform"/> WhatsApp Abogado
             </button>
             <button onClick={notifyClientEmail} className="flex flex-col items-center justify-center gap-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 p-4 rounded-xl border border-brand-200 transition-colors shadow-sm text-xs font-bold text-center group">
               <Mail size={22} className="group-hover:scale-110 transition-transform"/> Correo Cliente
             </button>
             <button onClick={notifyLawyerEmail} className="flex flex-col items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 p-4 rounded-xl border border-slate-200 transition-colors shadow-sm text-xs font-bold text-center group">
               <Mail size={22} className="group-hover:scale-110 transition-transform"/> Correo Abogado
             </button>
             <button onClick={() => { onEdit(event); onClose(); }} className="flex flex-col items-center justify-center gap-1.5 bg-brand-900 hover:bg-brand-800 text-white p-3 rounded-xl border border-brand-800 transition-colors shadow-sm text-xs font-bold text-center group col-span-2">
               Editar Evento
             </button>
          </div>

          <div className="flex justify-between border-t border-brand-100 pt-4">
             <button onClick={() => {onDelete(event.id); onClose();}} className="text-xs text-red-500 font-bold hover:text-red-700">Eliminar Evento</button>
             <button onClick={onClose} className="text-xs text-brand-600 font-bold hover:text-brand-900">Cerrar Panel</button>
          </div>
       </div>
    </div>
  );
}

export default function CalendarView() {
  const [events, setEvents] = useState([]);
  const [casos, setCasos] = useState([]);
  const [abogados, setAbogados] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventToEdit, setEventToEdit] = useState(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  useEffect(() => {
    const unsubAgenda = onSnapshot(collection(db, 'agenda'), (snapshot) => {
      // Formatear para FullCalendar
      const formattedEvents = snapshot.docs.map(doc => {
        const d = doc.data();
        let startIso = `${d.date}T${d.startTime || '09:00'}:00`;
        let endIso = `${d.date}T${d.endTime || '10:00'}:00`;
        return { 
          id: doc.id, 
          title: d.title, 
          start: startIso,
          end: endIso,
          color: d.color,
          extendedProps: { ...d }
        };
      });
      setEvents(formattedEvents);
      setIsLoading(false);
    });

    const unsubCasos = onSnapshot(collection(db, 'casos'), snap => {
      setCasos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubAbogados = onSnapshot(collection(db, 'abogados'), snap => {
      setAbogados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubAgenda(); unsubCasos(); unsubAbogados(); };
  }, []);

  const handleCreateEvent = async (data) => {
    setIsModalOpen(false);
    try {
      if (data.id) {
        await updateDoc(doc(db, 'agenda', data.id), data);
      } else {
        await addDoc(collection(db, 'agenda'), data);
      }
      
      // Construir URL de Google Calendar
      const datePartLocalStr = data.date.replace(/-/g, '');
      const startTimeStr = data.startTime.replace(/:/g, '') + '00';
      const endTimeStr = data.endTime.replace(/:/g, '') + '00';
      // Aproximación a formato ISO sin Z (local timezone en GCal)
      const datesParam = `${datePartLocalStr}T${startTimeStr}/${datePartLocalStr}T${endTimeStr}`;
      
      let details = `**Cuaderno / Cliente:** ${data.caseInfo}\n**Abogado Asignado:** ${data.lawyerName}\n`;
      if (data.meetUrl) details += `\n**Link:** ${data.meetUrl}`;
      details += `\n\n--- Generado automáticamente por VINDEX LEGAL GROUP ---`;

      const emails = [data.clientEmail, data.lawyerEmail].filter(e => e && e.includes('@')).join(',');

      let gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(data.title)}&dates=${datesParam}&details=${encodeURIComponent(details)}&add=${encodeURIComponent(emails)}`;
      
      window.open(gcalUrl, '_blank');
      
    } catch(err) {
      console.error(err);
      alert("No se pudo agendar. Verifique su conexión.");
    }
  };

  const handleEventClick = (clickInfo) => {
    setSelectedEvent({ id: clickInfo.event.id, title: clickInfo.event.title, ...clickInfo.event.extendedProps });
    setIsActionModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm("¿Eliminar evento permanentemente?")) {
      try {
        await deleteDoc(doc(db, 'agenda', id));
      } catch(e) { console.error(e); }
    }
  };

  const exportCalendarPDF = () => {
    const doc = new jsPDF('landscape');
    
    const now = new Date();
    const currentMonthEvents = events.filter(e => {
       if (!e.extendedProps.date) return false;
       // Validar mes y año actual
       const d = new Date(e.extendedProps.date + 'T00:00:00'); 
       return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    
    currentMonthEvents.sort((a,b) => {
       const dateA = new Date(`${a.extendedProps.date}T${a.extendedProps.startTime || '00:00'}`);
       const dateB = new Date(`${b.extendedProps.date}T${b.extendedProps.startTime || '00:00'}`);
       return dateA - dateB;
    });

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42); 
    doc.text(`Agenda de Eventos VINDEX - ${now.toLocaleString('es-ES', {month: 'long', year: 'numeric'}).toUpperCase()}`, 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Total eventos en el mes: ${currentMonthEvents.length} | Generado: ${now.toLocaleString()}`, 14, 28);
    
    const tableData = currentMonthEvents.map(e => [
       e.extendedProps.date || '-',
       `${e.extendedProps.startTime || ''} - ${e.extendedProps.endTime || ''}`,
       e.title || '-',
       e.extendedProps.caseInfo || '-',
       e.extendedProps.lawyerName || '-',
       e.extendedProps.clientName || '-',
       e.extendedProps.clientPhone || e.extendedProps.clientEmail ? `${e.extendedProps.clientPhone || ''}\n${e.extendedProps.clientEmail || ''}`.trim() : '-'
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Fecha', 'Hora', 'Evento / Asunto', 'Cuaderno / Cliente', 'Abogado Asignado', 'Cliente', 'Contacto']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      columnStyles: {
        2: { cellWidth: 40 },
        3: { cellWidth: 50 },
        6: { cellWidth: 35 }
      },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    
    doc.save(`VINDEX_Agenda_${now.toLocaleString('es-ES', {month: 'long'})}_${now.getFullYear()}.pdf`);
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-brand-200 overflow-hidden relative">
      <div className="flex items-center justify-between p-6 border-b border-brand-200 bg-brand-50 shrink-0">
        <div>
           <h1 className="text-xl font-black text-brand-900 tracking-tight flex items-center gap-2">
             Agenda Estratégica
             {isLoading && <Loader2 size={18} className="animate-spin text-brand-500" />}
           </h1>
           <p className="text-brand-600 text-xs mt-0.5 font-bold uppercase tracking-wider">Planificación y Notificación Bilateral Inteligente</p>
        </div>
         <div className="flex gap-3">
          <button onClick={exportCalendarPDF} className="flex items-center gap-2 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 border border-rose-200 hover:border-rose-300 px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all text-xs tracking-wide uppercase">
            <FileText size={16} strokeWidth={2.5} />
            PDF Mes Actual
          </button>
          <button onClick={() => { setEventToEdit(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-brand-900 hover:bg-brand-800 text-white px-5 py-2.5 rounded-lg font-bold shadow-md shadow-brand-900/20 transition-all text-xs tracking-wide uppercase">
            <Plus size={16} strokeWidth={3} />
            Agendar Evento VINDEX
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar calendar-container">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          height="100%"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
          }}
          buttonText={{
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana'
          }}
          locale="es"
          firstDay={1}
          dayMaxEvents={3}
          eventDisplay="block"
          eventClassNames="cursor-pointer text-xs font-bold truncate rounded-md px-2 py-1 shadow-sm border border-black/5 mx-1"
          dayCellClassNames="hover:bg-brand-50/50 transition-colors"
          eventClick={handleEventClick}
        />
      </div>

      <EventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleCreateEvent} casos={casos} abogados={abogados} initialData={eventToEdit} />
      
      <ActionModal 
        isOpen={isActionModalOpen} 
        onClose={() => setIsActionModalOpen(false)} 
        event={selectedEvent} 
        onDelete={handleDelete} 
        onEdit={(e) => { setEventToEdit(e); setIsModalOpen(true); }}
      />

      <style jsx global>{`
        .calendar-container .fc {
          --fc-border-color: #e2e8f0;
          --fc-button-text-color: #1e293b;
          --fc-button-bg-color: #ffffff;
          --fc-button-border-color: #cbd5e1;
          --fc-button-hover-bg-color: #f1f5f9;
          --fc-button-hover-border-color: #94a3b8;
          --fc-button-active-bg-color: #e2e8f0;
          --fc-button-active-border-color: #64748b;
          --fc-today-bg-color: #eff6ff;
          font-family: inherit;
        }
        .calendar-container .fc-toolbar-title {
          font-weight: 900;
          color: #1e3a8a;
          letter-spacing: -0.02em;
          font-size: 1.5rem !important;
        }
        .calendar-container .fc-button {
          font-weight: 800;
          text-transform: capitalize;
          font-size: 0.8rem;
          padding: 0.5rem 1.2rem;
          border-radius: 0.6rem;
          transition: all 0.2s;
        }
        .calendar-container .fc-button-primary:not(:disabled).fc-button-active, 
        .calendar-container .fc-button-primary:not(:disabled):active {
          background-color: #1e3a8a !important;
          border-color: #1e3a8a !important;
          color: white !important;
          box-shadow: 0 4px 6px -1px rgba(30, 58, 138, 0.2) !important;
        }
        .calendar-container .fc-daygrid-day-number {
          font-weight: 800;
          color: #334155;
          padding: 0.6rem;
          font-size: 0.9rem;
        }
        .calendar-container .fc-col-header-cell-cushion {
          font-weight: 900;
          color: #1e3a8a;
          padding: 1rem 0.5rem;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        .calendar-container .fc-daygrid-day-frame {
          min-height: 120px !important;
        }
        .calendar-container .fc-theme-standard td, .calendar-container .fc-theme-standard th {
          border-color: #f1f5f9;
        }
        .calendar-container .fc-event {
          margin-bottom: 3px !important;
          transition: transform 0.1s ease;
        }
        .calendar-container .fc-event:hover {
          transform: translateY(-1px);
        }
        .calendar-container .fc-timegrid-slot-label-cushion {
          font-weight: 700;
          font-size: 11px;
        }
        .calendar-container .fc-view-harness {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
