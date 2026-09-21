"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { clearSession } from '@/lib/store/store';

export type UserRole = 'patient' | 'nurse' | 'doctor' | 'admin' | null;

interface AuthContextType {
  currentUser: User | null;
  role: UserRole;
  loading: boolean;
  isAnonymous: boolean;
  refreshRole: () => Promise<UserRole>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  role: null,
  loading: true,
  isAnonymous: false,
  refreshRole: async () => null,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  // Force-fetches the latest custom claim from the ID token
  const fetchUserRole = useCallback(async (user: User | null, forceRefresh = false): Promise<UserRole> => {
    if (!user) {
      setRole(null);
      return null;
    }

    if (user.isAnonymous) {
      setRole(null);
      return null;
    }

    try {
      const tokenResult = await user.getIdTokenResult(forceRefresh);
      let userRole = (tokenResult.claims.role as UserRole) || null;
      
      // If no custom claim is found and user is not anonymous, default to patient
      if (!userRole && !user.isAnonymous) {
        userRole = 'patient';
      }
      
      setRole(userRole);
      return userRole;
    } catch (err) {
      console.error('Failed to retrieve user custom claims:', err);
      setRole(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserRole(user, true);
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserRole]);

  const refreshRole = async (): Promise<UserRole> => {
    if (!auth.currentUser) return null;
    return await fetchUserRole(auth.currentUser, true);
  };

  const logout = async () => {
    await signOut(auth);
    clearSession();
    setCurrentUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider 
      value={{ 
        currentUser, 
        role, 
        loading, 
        isAnonymous: currentUser?.isAnonymous || false,
        refreshRole, 
        logout 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
