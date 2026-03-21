import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "../firebase";

// Iniciamos una app secundaria de Firebase para no entrar en conflicto con la principal.
// De este modo, la función createUserWithEmailAndPassword iniciará la sesión "ahí",
// sin afectar la sesión real del administrador que usa la intranet.
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);
