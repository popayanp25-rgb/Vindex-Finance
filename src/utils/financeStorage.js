import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const INGRESOS_COLLECTION = "ingresos";
const EGRESOS_COLLECTION = "egresos";
const SERVICIOS_COLLECTION = "servicios";
const SOCIOS_COLLECTION = "socios";

// Ingresos (Acuerdos de Pago con Cronograma)
export const subscribeToIngresos = (callback) => {
  const q = collection(db, INGRESOS_COLLECTION);
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (error) => {
    console.error("Error subscribing to ingresos:", error);
  });
};

export const addIngreso = async (ingreso) => {
  try {
    const data = {
      ...ingreso,
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, INGRESOS_COLLECTION), data);
  } catch (error) {
    console.error("Error adding ingreso:", error);
    throw error;
  }
};

export const updateIngreso = async (id, updates) => {
  try {
    const docRef = doc(db, INGRESOS_COLLECTION, id);
    const data = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Error updating ingreso:", error);
    throw error;
  }
};

export const deleteIngreso = async (id) => {
  try {
    const docRef = doc(db, INGRESOS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting ingreso:", error);
    throw error;
  }
};

// Egresos (Gastos y Cuentas por Pagar)
export const subscribeToEgresos = (callback) => {
  const q = collection(db, EGRESOS_COLLECTION);
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (error) => {
    console.error("Error subscribing to egresos:", error);
  });
};

export const addEgreso = async (egreso) => {
  try {
    const data = {
      ...egreso,
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, EGRESOS_COLLECTION), data);
  } catch (error) {
    console.error("Error adding egreso:", error);
    throw error;
  }
};

export const updateEgreso = async (id, updates) => {
  try {
    const docRef = doc(db, EGRESOS_COLLECTION, id);
    const data = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Error updating egreso:", error);
    throw error;
  }
};

export const deleteEgreso = async (id) => {
  try {
    const docRef = doc(db, EGRESOS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting egreso:", error);
    throw error;
  }
};

// Servicios (Catálogo de Tipos de Obligación)
export const subscribeToServicios = (callback) => {
  const q = collection(db, SERVICIOS_COLLECTION);
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (error) => {
    console.error("Error subscribing to servicios:", error);
  });
};

export const addServicio = async (servicio) => {
  try {
    const data = {
      ...servicio,
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, SERVICIOS_COLLECTION), data);
  } catch (error) {
    console.error("Error adding servicio:", error);
    throw error;
  }
};

export const updateServicio = async (id, updates) => {
  try {
    const docRef = doc(db, SERVICIOS_COLLECTION, id);
    const data = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Error updating servicio:", error);
    throw error;
  }
};

export const deleteServicio = async (id) => {
  try {
    const docRef = doc(db, SERVICIOS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting servicio:", error);
    throw error;
  }
};

// Socios (Directorio Ejecutivo)
export const subscribeToSocios = (callback) => {
  const q = collection(db, SOCIOS_COLLECTION);
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (error) => {
    console.error("Error subscribing to socios:", error);
  });
};

export const addSocio = async (socio) => {
  try {
    const data = {
      ...socio,
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, SOCIOS_COLLECTION), data);
  } catch (error) {
    console.error("Error adding socio:", error);
    throw error;
  }
};

export const updateSocio = async (id, updates) => {
  try {
    const docRef = doc(db, SOCIOS_COLLECTION, id);
    const data = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Error updating socio:", error);
    throw error;
  }
};

export const deleteSocio = async (id) => {
  try {
    const docRef = doc(db, SOCIOS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting socio:", error);
    throw error;
  }
};
