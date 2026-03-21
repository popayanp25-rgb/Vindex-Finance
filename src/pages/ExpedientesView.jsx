import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Paperclip, Clock, Filter, Plus, Loader2, Search } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { PrincipalModal, CautelarModal } from '../components/ExpedienteModals';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const STAGES = [
  { id: '1', title: 'Preparación', color: 'bg-brand-200 text-brand-800' },
  { id: '2', title: 'Ingreso Demanda', color: 'bg-brand-100 text-brand-800' },
  { id: '3', title: 'Calificación', color: 'bg-brand-300 text-brand-900' },
  { id: '4', title: 'Subsanación', color: 'bg-rose-100 text-rose-800' },
  { id: '5', title: 'En Trámite', color: 'bg-brand-100 text-brand-700' },
  { id: '6', title: 'Sentencia 1°', color: 'bg-brand-800 text-white' },
  { id: '7', title: 'Apelación', color: 'bg-orange-100 text-orange-800' },
  { id: '8', title: 'Sentencia 2°', color: 'bg-brand-900 text-brand-100' },
  { id: '9', title: 'Casación', color: 'bg-brand-600 text-white' },
  { id: '10', title: 'Ejecución', color: 'bg-emerald-100 text-emerald-800' },
  { id: '11', title: 'Concluido', color: 'bg-brand-300 text-brand-800' },
  { id: '12', title: 'Archivado', color: 'bg-gray-100 text-brand-400' }
];

function DraggableCard({ card, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: card,
  });
  
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  const isPrincipal = card.type === 'principal';

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      onClick={() => onClick(card)}
      className={`bg-white p-4 rounded-xl shadow-sm border ${isDragging ? 'border-brand-900 scale-105 shadow-xl z-50' : 'border-brand-200 hover:border-brand-500 hover:shadow-md'} cursor-grab active:cursor-grabbing transition-all group relative`}
    >
      {/* Indicador visual de jerarquía */}
      <div className={`absolute top-0 left-0 bottom-0 w-1.5 rounded-l-xl ${isPrincipal ? 'bg-brand-900' : 'bg-brand-500/50'}`} />
      
      <div className="flex justify-between items-start mb-3 pointer-events-none pl-2">
        <span className={`text-xs font-bold px-2 py-1 rounded border ${isPrincipal ? 'text-brand-900 bg-brand-50 border-brand-200' : 'text-brand-700 bg-amber-50 border-amber-200'}`}>
          {card.title}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">{card.matter || (isPrincipal ? 'Civil' : 'Cautelar')}</span>
      </div>
      <p className="text-sm font-semibold text-brand-900 mb-4 leading-snug pointer-events-none pl-2">{card.clientName}</p>
      
      <div className="flex items-center justify-between text-brand-400 text-xs mt-auto pt-3 border-t border-brand-100 pointer-events-none pl-2">
        <div className="flex items-center gap-1.5 bg-brand-50 px-2 py-1 rounded-md text-brand-700 font-medium">
          <Clock size={12} />
          <span>{card.date || '-'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Paperclip size={14} />
          <span>0</span>
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({ stage, cards, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  return (
    <div className="w-[320px] bg-brand-50/50 rounded-2xl flex flex-col h-full border border-brand-200 shrink-0">
      <div className={`p-4 border-b border-brand-200 flex items-center justify-between rounded-t-2xl transition-colors ${isOver ? 'bg-brand-100/80 border-brand-300' : 'bg-white'}`}>
        <div className="flex items-center gap-2">
          <h3 className={`font-bold text-sm tracking-tight ${isOver ? 'text-brand-900' : 'text-brand-800'}`}>{stage.title}</h3>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${stage.color}`}>
            {cards.length}
          </span>
        </div>
        <button className="text-brand-400 hover:text-brand-600 p-1 rounded-md hover:bg-brand-100"><MoreHorizontal size={16} /></button>
      </div>
      
      <div 
        ref={setNodeRef}
        className={`p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar transition-all duration-200 ${isOver ? 'bg-brand-100/30' : ''}`}
      >
        {cards.map(card => (
          <DraggableCard key={card.id} card={card} onClick={onCardClick} />
        ))}
        
        {cards.length === 0 && (
          <div className={`h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-sm font-medium transition-colors pointer-events-none ${isOver ? 'border-brand-400 text-brand-600 bg-brand-100/50' : 'border-brand-200 text-brand-400 bg-brand-50/50'}`}>
            Arrastra tarjetas aquí
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExpedientesView() {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDragCard, setActiveDragCard] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isPrincipalOpen, setIsPrincipalOpen] = useState(false);
  const [isCautelarOpen, setIsCautelarOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);

  useEffect(() => {
    // Escuchar cambios en tiempo real desde Firestore
    const unsubscribe = onSnapshot(collection(db, 'casos'), (snapshot) => {
      const loadedCards = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCards(loadedCards);
      setIsLoading(false);
    }, (error) => {
      console.error("Error cargando casos: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const principals = cards.filter(c => c.type === 'principal');

  const displayCards = cards.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (c.title?.toLowerCase().includes(term) || c.clientName?.toLowerCase().includes(term));
  });

  const visibleStages = searchTerm 
    ? STAGES.filter(stage => displayCards.some(c => c.stageId === stage.id))
    : STAGES;

  const handleDragStart = (event) => {
    const { active } = event;
    const card = cards.find(c => c.id === active.id);
    setActiveDragCard(card);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (over && active.id && over.id) {
      const activeCardId = active.id;
      const newStageId = String(over.id);
      
      // Actualización optimista local
      setCards(prev => prev.map(card => {
        if (card.id === activeCardId) {
          return { ...card, stageId: newStageId };
        }
        return card;
      }));
      
      // Actualizar en Firestore
      try {
        await updateDoc(doc(db, 'casos', activeCardId), {
          stageId: newStageId
        });
      } catch(err) {
        console.error("Error al mover tarjeta: ", err);
      }
    }
    setActiveDragCard(null);
  };

  const handleCardClick = (card) => {
    setEditingCard(card);
    if (card.type === 'principal') {
      setIsPrincipalOpen(true);
    } else {
      setIsCautelarOpen(true);
    }
  };

  const closeModals = () => {
    setIsPrincipalOpen(false);
    setIsCautelarOpen(false);
    setEditingCard(null);
  };

  const handleSaveData = async (data) => {
    closeModals();
    if (editingCard) {
      // Editar existente
      try {
        await updateDoc(doc(db, 'casos', editingCard.id), data);
      } catch(err) {
        console.error("Error actualizando expediente: ", err);
      }
    } else {
      // Crear nuevo
      const newCardData = {
        ...data,
        stageId: data.stageId || '1',
        date: new Date().toISOString().split('T')[0]
      };
      try {
        await addDoc(collection(db, 'casos'), newCardData);
      } catch(err) {
        console.error("Error creando expediente: ", err);
      }
    }
  };

  const handleDelete = async (id) => {
    const cardToDelete = cards.find(c => c.id === id);
    if (!cardToDelete) return;
    closeModals();

    try {
      if (cardToDelete.type === 'principal') {
         // Borrado en cascada
         const q = query(collection(db, 'casos'), where('parentId', '==', id));
         const querySnapshot = await getDocs(q);
         
         const deletePromises = querySnapshot.docs.map(d => deleteDoc(d.ref));
         deletePromises.push(deleteDoc(doc(db, 'casos', id))); // borrar el padre
         
         await Promise.all(deletePromises);
      } else {
         // Borrar solo cautelar
         await deleteDoc(doc(db, 'casos', id));
      }
    } catch(err) {
      console.error("Error al borrar el expediente: ", err);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-8 shrink-0 gap-4">
        <div>
           <h1 className="text-2xl font-black text-brand-900 tracking-tight flex items-center gap-3">
             Control de Expedientes
             {isLoading && <Loader2 size={20} className="animate-spin text-brand-500" />}
           </h1>
           <p className="text-brand-500 text-sm mt-1 font-medium">Gestión integral de flujos judiciales VINDEX en la nube.</p>
        </div>
        <div className="flex flex-col lg:flex-row gap-3 w-full xl:w-auto">
          <div className="relative w-full lg:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input 
              type="text" 
              placeholder="Buscar por N° o Cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 w-full bg-white border border-brand-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-900 focus:border-brand-900 transition-all font-medium text-brand-900"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditingCard(null); setIsPrincipalOpen(true); }} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-brand-900 hover:bg-brand-800 text-white px-5 py-2.5 rounded-lg font-bold shadow-md shadow-brand-900/20 transition-all text-sm tracking-wide">
              <Plus size={18} strokeWidth={3} />
              <span className="hidden sm:inline">Nuevo Principal</span>
              <span className="sm:hidden">Principal</span>
            </button>
            <button onClick={() => { setEditingCard(null); setIsCautelarOpen(true); }} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white hover:bg-brand-50 text-brand-900 border border-brand-300 px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all text-sm tracking-wide hover:border-brand-500">
              <Plus size={18} strokeWidth={3} />
              <span className="hidden sm:inline">Nueva Cautelar</span>
              <span className="sm:hidden">Cautelar</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 custom-scrollbar">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners} 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-5 h-full w-max">
            {visibleStages.length > 0 ? (
              visibleStages.map(stage => (
                <DroppableColumn 
                  key={stage.id} 
                  stage={stage} 
                  cards={displayCards.filter(c => c.stageId === stage.id)} 
                  onCardClick={handleCardClick}
                />
              ))
            ) : (
                <div className="flex items-center justify-center w-[calc(100vw-300px)] h-64 text-brand-400">
                   <p className="font-bold text-lg select-none flex items-center gap-2">
                     <Search size={20} className="text-brand-300" />
                     No se encontró ningún expediente.
                   </p>
                </div>
            )}
          </div>

          <DragOverlay>
            {activeDragCard ? (
              <div className="bg-white p-4 rounded-xl shadow-2xl border-2 border-brand-900 rotate-3 w-[294px] cursor-grabbing">
                <div className="flex justify-between items-start mb-3 pl-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded border ${activeDragCard.type === 'principal' ? 'text-brand-900 bg-brand-50 border-brand-200' : 'text-brand-700 bg-amber-50 border-amber-200'}`}>
                    {activeDragCard.title}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">{activeDragCard.matter || (activeDragCard.type === 'principal' ? 'Civil' : 'Cautelar')}</span>
                </div>
                <p className="text-sm font-semibold text-brand-900 mb-4 leading-snug pl-2">{activeDragCard.clientName}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <PrincipalModal 
        isOpen={isPrincipalOpen} 
        onClose={closeModals} 
        onSave={handleSaveData} 
        onDelete={handleDelete}
        initialData={editingCard}
      />
      <CautelarModal 
        isOpen={isCautelarOpen} 
        onClose={closeModals} 
        onSave={handleSaveData} 
        onDelete={handleDelete}
        initialData={editingCard}
        principals={principals}
      />
    </div>
  );
}
