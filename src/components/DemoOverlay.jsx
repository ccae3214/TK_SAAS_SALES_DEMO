"use client";
import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function DemoOverlay({ title }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const demos = [
    { name: 'Ecommerce', path: '/demo/ecommerce' },
    { name: 'Corporate', path: '/demo/corporate' },
    { name: 'Creative', path: '/demo/creative' },
    { name: 'SaaS', path: '/demo/saas' }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'white',
      padding: '8px 16px',
      borderRadius: '30px',
      border: '1px solid rgba(0,0,0,0.1)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
    }}>
      <button 
        onClick={() => router.push('/')}
        style={{
          background: '#f1f5f9',
          border: 'none',
          color: '#0f172a',
          padding: '8px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
      >
        <ArrowLeft size={16} />
      </button>
      <div style={{ position: 'relative' }}>
        <div 
          onClick={() => setIsOpen(!isOpen)}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ fontSize: '0.7rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {t.overlay.preview}
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {title} <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
          </div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <Motion.div 
               initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
               style={{ position: 'absolute', top: '100%', right: 0, marginTop: '10px', background: 'white', borderRadius: '12px', padding: '8px', minWidth: '180px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9' }}
            >
               {demos.map(d => (
                 <div 
                    key={d.path} 
                    onClick={() => { router.push(d.path); setIsOpen(false); }}
                    style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: pathname === d.path ? '#2563eb' : '#475569', background: pathname === d.path ? '#f5f3ff' : 'transparent' }}
                 >
                    {d.name}
                 </div>
               ))}
            </Motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
