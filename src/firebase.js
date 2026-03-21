import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyA2sprmAuNxF89TuLo-rfhmZdPWfsibREk",
  authDomain: "vindez-intranet.firebaseapp.com",
  projectId: "vindez-intranet",
  storageBucket: "vindez-intranet.firebasestorage.app",
  messagingSenderId: "834753072461",
  appId: "1:834753072461:web:81b0d81703d186f650fb04",
  measurementId: "G-V707EFL8VX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
