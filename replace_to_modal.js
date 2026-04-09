import fs from 'fs';
import path from 'path';

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Need to add X from lucide-react if not imported? Standard VINDEX files usually have 'X' imported or I can use an HTML entity or svg. But let's assume 'X' is imported for modals. If not, I'll use a simple SVG or Check `import { X, ...`
  // Actually, both files already have 'X' imported for other modals!

  const startMarker = '{/* Pie Tarjeta / Acciones */}';
  const endMarker = '                   </div>\n                );\n             })}\n           </div>';

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.error("Markers not found in " + filePath);
    return;
  }

  // we replace the inline accordion with just a button that opens the modal,
  // and then outside the map loops we render the modal.

  const cardFooter = `                      {/* Pie Tarjeta / Acciones */}
                      <div className="p-4 pt-0 mt-auto border-t border-brand-50 dark:border-slate-800/50 pt-4">
                        <button 
                          onClick={() => setExpandedRow(ingreso.id)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          Ver Cuotas Programadas
                        </button>
                      </div>
                   </div>
                );
             })}
           </div>

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
                                 <div key={idx} className={\`flex flex-col gap-4 p-5 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md \${
                                   cuota.estado === 'Pagado' ? 'border-emerald-200 dark:border-emerald-900/50' : 
                                   isOverdue ? 'border-red-300 dark:border-red-900/50' : 'border-brand-200 dark:border-slate-700'
                                 }\`}>
                                   
                                   {/* Fila superior cuota */}
                                   <div className="flex items-start justify-between">
                                     <div className="flex items-center gap-3">
                                       <div className={\`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-black text-sm \${
                                         cuota.estado === 'Pagado' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                         isOverdue ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                                         'bg-brand-50 text-brand-900 dark:bg-slate-800 dark:text-white'
                                       }\`}>
                                         #{cuota.cuota}
                                       </div>
                                       <div>
                                         <div className="font-black text-brand-900 dark:text-white text-xl tracking-tight">
                                           {formatCurrency(cuota.monto)}
                                         </div>
                                         <div className="flex items-center gap-1.5 text-[10px] font-bold mt-1">
                                           <Calendar size={12} className={isOverdue ? "text-red-500" : "text-brand-500"}/>
                                           <span className={isOverdue ? "text-red-600" : "text-brand-600 dark:text-slate-400"}>Vence: {cuota.vencimiento}</span>
                                         </div>
                                       </div>
                                     </div>
                                     <span className={\`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border text-center \${
                                       cuota.estado === 'Pagado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                                       isOverdue ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' :
                                       'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                     }\`}>
                                       {isOverdue && cuota.estado === 'Pendiente' ? 'Vencido' : cuota.estado}
                                     </span>
                                   </div>
                                   
                                   {/* Acciones de cuota */}
                                   <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                   {cuota.estado !== 'Pagado' ? (
                                     <div className="flex items-center gap-2">
                                       {isOverdue && typeof handleWhatsAppReminder !== 'undefined' && (
                                         <button onClick={() => handleWhatsAppReminder(ingreso, cuota)} className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center items-center gap-1 shadow-sm" title="Enviar recordatorio por WhatsApp">
                                           <MessageCircle size={14} /> Recordar
                                         </button>
                                       )}
                                       <button onClick={() => handleUpdateCuotaStatus(ingreso, idx, 'Pagado')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center items-center gap-1 shadow-sm">
                                         <CheckCircle size={14} /> Marcar Pagado
                                       </button>
                                     </div>
                                   ) : (
                                     <div className="flex items-center gap-2">
                                       <button onClick={() => handleDownloadComprobante(ingreso, cuota, idx)} className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center items-center gap-1 shadow-sm" title="Descargar Comprobante de Pago">
                                         <FileText size={14} /> Comprobante
                                       </button>
                                       <button onClick={() => handleUpdateCuotaStatus(ingreso, idx, 'Pendiente')} className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors">
                                         Revertir
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
           })()}`;

  const newContent = content.substring(0, startIndex) + cardFooter + content.substring(endIndex + endMarker.length);
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log("Successfully extracted quotas to modal in " + path.basename(filePath));
}

const file1 = path.join(process.cwd(), 'src', 'pages', 'IngresosView.jsx');
const file2 = path.join(process.cwd(), 'src', 'pages', 'HonorariosVariablesView.jsx');

processFile(file1);
processFile(file2);
