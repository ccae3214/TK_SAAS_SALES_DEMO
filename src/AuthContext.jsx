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
  const [hydrated, setHydrated] = useState(false);
  const { data: session, status } = useSession();

  // 還原登入狀態：Google session 優先，其次是帳號密碼登入存在 localStorage 的資料
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated' && session?.user) {
      setUserProfile((prev) => ({
        // 若先前是同一個 email（例如已有點數資料），保留其餘欄位
        ...(prev?.email === session.user.email ? prev : {}),
        name: session.user.name || '',
        email: session.user.email || '',
        image: session.user.image || '',
        provider: 'google',
      }));
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem('tk_user') || 'null');
        // Google 的 session 已失效時，不要再還原舊的 Google 資料
        if (saved && saved.provider !== 'google') setUserProfile(saved);
        else setUserProfile(null);
      } catch {
        setUserProfile(null);
      }
    }
    setHydrated(true);
  }, [status, session]);

  // 還原完成後才寫回，避免一開始就把 localStorage 清空
  useEffect(() => {
    if (!hydrated) return;
    if (userProfile) {
      localStorage.setItem('tk_user', JSON.stringify(userProfile));
    } else {
      localStorage.removeItem('tk_user');
    }
  }, [userProfile, hydrated]);

  const login = (user) => {
    setUserProfile({ ...user, provider: user?.provider || 'email' });
  };

  const logout = async () => {
    try {
      await nextAuthSignOut({ redirect: false });
    } catch (err) {
      console.error('Sign out failed:', err);
    }
    setUserProfile(null);
  };

  // 登入後一律回首頁
  const signInWithGoogle = (callbackUrl = '/') => {
    nextAuthSignIn('google', { callbackUrl });
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
  return context || { userProfile: null, setUserProfile: () => {}, login: () => {}, logout: () => {}, signInWithGoogle: () => {} };
};
