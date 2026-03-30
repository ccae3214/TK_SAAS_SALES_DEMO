/* eslint-disable react-refresh/only-export-components */
"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext({
  userProfile: null,
  setUserProfile: () => {},
  login: () => {},
  logout: () => {}
});

export const AuthProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);

  // Safe client-side loading
  useEffect(() => {
    const saved = localStorage.getItem('tk_user');
    if (saved) setUserProfile(JSON.parse(saved));
  }, []);

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

  const logout = () => {
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ userProfile, setUserProfile, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  // Remove the throw error to prevent build crashes in Next.js SSG
  return context || { userProfile: null, setUserProfile: () => {}, login: () => {}, logout: () => {} };
};
