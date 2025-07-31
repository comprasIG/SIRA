import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { auth } from "./firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  if (checking) return <p>Cargando...</p>;

  return user ? <Dashboard user={user} /> : <Login />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
