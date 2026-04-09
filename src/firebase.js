import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyAMGiKVdHU8V1AAat1zJ1Bsvz76Q3DZhfQ",
  authDomain: "vindex-finance-bd566.firebaseapp.com",
  projectId: "vindex-finance-bd566",
  storageBucket: "vindex-finance-bd566.firebasestorage.app",
  messagingSenderId: "549665157718",
  appId: "1:549665157718:web:1b216154fefa3eb87c41f7",
  measurementId: "G-4RC6ELXD33"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
