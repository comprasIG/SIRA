//C:\SIRA\sira-front\src\firebase\firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBmZB7lXpzhmYPu8rxp7a0xc7xYoQcbmvI",
  authDomain: "sira-grupo-ig-a44ce.firebaseapp.com",
  projectId: "sira-grupo-ig-a44ce",
  storageBucket: "sira-grupo-ig-a44ce.firebasestorage.app",
  messagingSenderId: "420614047978",
  appId: "1:420614047978:web:d39eaa10d458c462ebef93",
  measurementId: "G-CMET6HWB88"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
