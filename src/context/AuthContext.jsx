import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { createUserProfile } from '../lib/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signInWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    await createUserProfile(result.user.uid, {
      displayName: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL,
    });
    return result.user;
  }

  async function signInEmail(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  }

  async function signUpEmail(email, password, displayName) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    await createUserProfile(result.user.uid, {
      displayName,
      email,
      photoURL: '',
    });
    return result.user;
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInEmail, signUpEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
