"use client";
import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X, PlayCircle } from 'lucide-react';

const VideoModal = ({ isOpen, onClose, lang }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={onClose}
        >
          <Motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              width: '100%',
              maxWidth: '1000px',
              aspectRatio: '16/9',
              background: '#000',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)',
              position: 'relative',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <X size={24} />
            </button>

            {/* Mock Video Placeholder */}
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              background: 'linear-gradient(45deg, #0f172a 0%, #1e293b 100%)',
              textAlign: 'center',
              padding: '40px'
            }}>
              <Motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{ color: 'var(--accent-primary)', marginBottom: '24px' }}
              >
                <PlayCircle size={80} />
              </Motion.div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '16px' }}>
                {lang === 'zh' ? '克雷迅網頁設計 展示影片' : '克雷迅網頁設計 Showreel 2026'}
              </h2>
              <p style={{ color: '#94a3b8', maxWidth: '500px', lineHeight: 1.6, fontSize: '1.1rem' }}>
                {lang === 'zh' 
                  ? '在此處嵌入您的 YouTube 或 Vimeo 影片。這是一個演示視窗，展示如何整合專業的影片收錄功能。' 
                  : 'Embed your YouTube or Vimeo showreel here. This is a mockup video placeholder showing a professional modal integration.'}
              </p>
              
              <div style={{ marginTop: '40px', display: 'flex', gap: '20px' }}>
                <div style={{ padding: '8px 16px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: 600 }}>4K Ultra HD</div>
                <div style={{ padding: '8px 16px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: 600 }}>Dolby Atmos</div>
              </div>
            </div>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoModal;
