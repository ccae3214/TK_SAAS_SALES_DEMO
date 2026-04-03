/* eslint-disable react-refresh/only-export-components */
"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react';

const AuthContext = createContext({
  userProfile: null,
  setUserProfile: () => {},
  login: () => {},
  logout: () => {},
  signInWithGoogle: () => {},
});

export const AuthProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);
  const { data: session, status } = useSession();

  // Safe client-side loading
  useEffect(() => {
    const saved = localStorage.getItem('tk_user');
    if (saved) {
      setUserProfile(JSON.parse(saved));
      return;
    }

    if (status === 'authenticated' && session?.user) {
      const user = {
        name: session.user.name || '',
        email: session.user.email || '',
        image: session.user.image || '',
      };
      setUserProfile(user);
    }
  }, [status, session]);

  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('tk_user', JSON.stringify(userProfile));
    } else {
      localStorage.removeItem('tk_user');
    }
  }, [userProfile]);

  const login = (user) => {
    setUserProfile(user);
  };

  const logout = async () => {
    await nextAuthSignOut({ redirect: false });
    setUserProfile(null);
  };

  const signInWithGoogle = () => {
    nextAuthSignIn('google');
  };

  return (
    <AuthContext.Provider value={{ userProfile, setUserProfile, login, logout, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  // Remove the throw error to prevent build crashes in Next.js SSG
  return context || { userProfile: null, setUserProfile: () => {}, login: () => {}, logout: () => {} };
};
