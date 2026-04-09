import fs from 'fs';
import path from 'path';

const fileToModify = path.join(process.cwd(), 'src', 'pages', 'IngresosView.jsx');
let content = fs.readFileSync(fileToModify, 'utf-8');

const startMarker = '{/* TABLA PRINCIPAL */}';
const endMarker = '{/* MODAL DE CREACIÓN / EDICIÓN */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found");
  process.exit(1);
}

const theReplacement = `      {/* GRID DE TARJETAS PRINCIPAL */}
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
                   <div key={ingreso.id} className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-brand-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-brand-300 dark:hover:border-slate-700 transition-all duration-300 rounded-3xl flex flex-col overflow-hidden group">
                      
                      {/* Cabecera Tarjeta */}
                      <div className="p-5 pb-4 border-b border-brand-50 dark:border-slate-800/50 flex justify-between items-start gap-4">
                         <div className="flex-1">
                           <span className={\`inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border rounded-md whitespace-nowrap mb-2 \${getTypeColor(ingreso.tipo)}\`}>
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
                               <span className={\`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm border \${
                                 ingreso.estado === 'Pagado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                                 ingreso.estado === 'Parcial' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' :
                                 ingreso.estado === 'Por Definir' ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' :
                                 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                               }\`}>
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
                      <div className="p-4 pt-0 mt-auto">
                        <button 
                          onClick={() => setExpandedRow(isExpanded ? null : ingreso.id)}
                          className={\`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all \${isExpanded ? 'bg-brand-900 text-white dark:bg-brand-600' : 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-brand-200 dark:border-slate-700'}\`}
                        >
                          {isExpanded ? 'Ocultar Cuotas' : 'Ver Cuotas'}
                          {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </button>
                      </div>

                      {/* AREA EXPANDIDA CRONOGRAMA */}
                      {isExpanded && (
                        <div className="bg-brand-900 dark:bg-slate-950 p-5 border-t border-brand-800 dark:border-slate-800">
                           <div className="flex justify-between items-center mb-4">
                             <h4 className="text-xs font-black text-white uppercase tracking-widest">Cronograma de Pagos</h4>
                             {(ingreso.cronograma || []).length > 0 && (
                               <button onClick={() => handleDownloadPDF(ingreso)} className="flex items-center gap-2 bg-brand-800 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm">
                                 <Download size={12} /> <span className="hidden sm:inline">Descargar PDF Global</span><span className="inline sm:hidden">PDF</span>
                               </button>
                             )}
                           </div>
                           
                           {(!ingreso.cronograma || ingreso.cronograma.length === 0) ? (
                             <div className="text-center py-6 border-2 border-dashed border-brand-700 dark:border-slate-800 rounded-xl">
                                <p className="text-xs font-bold text-brand-300">Sin cronograma definido.</p>
                                <p className="text-[10px] text-brand-400 mt-1">Edita el cuaderno para generarle cuotas.</p>
                             </div>
                           ) : (
                             <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                               {ingreso.cronograma.map((cuota, idx) => {
                                 const isOverdue = cuota.vencimiento < hoy && cuota.estado === 'Pendiente';

                                 return (
                                   <div key={idx} className={\`flex flex-col gap-3 p-4 rounded-xl border bg-brand-800/50 dark:bg-slate-900/50 \${
                                     cuota.estado === 'Pagado' ? 'border-emerald-500/30' : 
                                     isOverdue ? 'border-red-500/30' : 'border-brand-700 dark:border-slate-700'
                                   }\`}>
                                     <div className="flex items-center justify-between">
                                       <div className="flex items-center gap-3">
                                         <div className="w-8 h-8 shrink-0 rounded-full bg-brand-900 dark:bg-slate-800 flex items-center justify-center text-brand-300 dark:text-gray-400 font-black text-xs border border-brand-700 dark:border-slate-700 shadow-inner">
                                           #{cuota.cuota}
                                         </div>
                                         <div>
                                           <div className="font-black text-white text-base">
                                             {formatCurrency(cuota.monto)}
                                           </div>
                                           <div className="flex items-center gap-1.5 text-[10px] font-bold mt-1">
                                             <Calendar size={10} className={isOverdue ? "text-red-400" : "text-brand-400"}/>
                                             <span className={isOverdue ? "text-red-400" : "text-brand-300"}>Vence: {cuota.vencimiento}</span>
                                           </div>
                                         </div>
                                       </div>
                                       <span className={\`px-2 py-1 text-[9px] font-black uppercase tracking-wider rounded-md border text-center \${
                                         cuota.estado === 'Pagado' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                         isOverdue ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                         'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                       }\`}>
                                         {isOverdue && cuota.estado === 'Pendiente' ? 'Vencido' : cuota.estado}
                                       </span>
                                     </div>
                                     
                                     {cuota.estado !== 'Pagado' ? (
                                       <div className="flex items-center gap-2 pt-2 border-t border-brand-700/50 dark:border-slate-800">
                                         {isOverdue && (
                                           <button onClick={() => handleWhatsAppReminder(ingreso, cuota)} className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center items-center gap-1" title="Enviar recordatorio por WhatsApp">
                                             <MessageCircle size={14} /> Recordar
                                           </button>
                                         )}
                                         <button onClick={() => handleUpdateCuotaStatus(ingreso, idx, 'Pagado')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center items-center gap-1">
                                           <CheckCircle size={14} /> Cobrar
                                         </button>
                                       </div>
                                     ) : (
                                       <div className="flex items-center gap-2 pt-2 border-t border-brand-700/50 dark:border-slate-800">
                                         <button onClick={() => handleDownloadComprobante(ingreso, cuota, idx)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center items-center gap-1" title="Comprobante de Pago">
                                           <FileText size={14} /> Recibo
                                         </button>
                                         <button onClick={() => handleUpdateCuotaStatus(ingreso, idx, 'Pendiente')} className="bg-brand-700 hover:bg-brand-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors">
                                           Revertir
                                         </button>
                                       </div>
                                     )}
                                   </div>
                                 )
                               })}
                             </div>
                           )}
                        </div>
                      )}
                   </div>
                );
             })}
           </div>
        )}
      </div>

      `;

const newContent = content.substring(0, startIndex) + theReplacement + content.substring(endIndex);
fs.writeFileSync(fileToModify, newContent, 'utf-8');
console.log("Successfully replaced table with grid!");
