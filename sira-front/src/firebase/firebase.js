//C:\SIRA\sira-front\src\firebase\firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// TU NUEVA CONFIGURACIÓN
const firebaseConfig = {
  apiKey: "AIzaSyCy4MiAnKayBWjqrs5i8KW_kW3lBlW_ZHA",
  authDomain: "sira-grupo-ig.firebaseapp.com",
  projectId: "sira-grupo-ig",
  storageBucket: "sira-grupo-ig.appspot.com", // Asegúrate que el storageBucket sea el correcto
  messagingSenderId: "386605754193",
  appId: "1:386605754193:web:cdce712e4ce9ca005bd570",
  measurementId: "G-D0B9Y36WJL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };