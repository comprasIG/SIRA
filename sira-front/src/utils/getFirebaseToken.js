// src/utils/getFirebaseToken.js
import { auth } from "../firebase/firebase";

export const getFirebaseToken = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("No hay usuario autenticado");
  return await user.getIdToken();
};
