"use client";
import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X, Send, CheckCircle, Mail, Phone, MapPin } from 'lucide-react';

const ContactModal = ({ isOpen, onClose, lang }) => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '', type: 'Consultation' });
  const [formStatus, setFormStatus] = useState('idle'); // idle, submitting, success, error

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormStatus('submitting');
    
    try {
      const response = await fetch('http://localhost:3001/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form) // Use 'form' state
      });
      
      if (response.ok) {
        setFormStatus('success');
        setSubmitted(true);
        setTimeout(() => {
          onClose();
          setSubmitted(false);
          setForm({ name: '', email: '', message: '', type: 'Consultation' });
          setFormStatus('idle'); // Reset status after successful submission and modal close
        }, 3000);
      } else {
        throw new Error('Failed to submit');
      }
    } catch (err) {
      console.error(err);
      alert(lang === 'zh' ? '提交失敗，請稍後再試。' : 'Submission failed. Please try again later.');
      setFormStatus('idle');
    }
  };

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
            background: 'rgba(0,0,0,0.4)',
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
              maxWidth: '850px',
              background: '#ffffff',
              borderRadius: '32px',
              overflow: 'hidden',
              boxShadow: '0 50px 100px -20px rgba(0,0,0,0.15)',
              position: 'relative',
              display: 'flex',
              flexWrap: 'wrap'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Decorative Section */}
            <div style={{
              flex: '1 1 300px',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
              color: '#fff',
              padding: '60px 40px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '24px', lineHeight: 1.1 }}>
                  {lang === 'zh' ? '開啟您的' : 'Launch your'} <br />
                  <span style={{ opacity: 0.8 }}>{lang === 'zh' ? '下一個專案' : 'next project'}</span>
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', marginBottom: '48px', lineHeight: 1.6 }}>
                  {lang === 'zh' 
                    ? '與我們的頂級團隊合作，將您的數位品牌願景轉化為現實。' 
                    : 'Work with the world class team to turn your digital vision into reality.'}
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px' }}><Mail size={20} /></div>
                      <div>
                         <div style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase' }}>{lang === 'zh' ? '電子信箱' : 'Email'}</div>
                         <div style={{ fontWeight: 600 }}>hello@tkwebstudio.co</div>
                      </div>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px' }}><Phone size={20} /></div>
                      <div>
                         <div style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase' }}>{lang === 'zh' ? '聯絡電話' : 'Phone'}</div>
                         <div style={{ fontWeight: 600 }}>+886 (2) 2345 6789</div>
                      </div>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px' }}><MapPin size={20} /></div>
                      <div>
                         <div style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase' }}>{lang === 'zh' ? '所在地' : 'Location'}</div>
                         <div style={{ fontWeight: 600 }}>Taipei, Taiwan</div>
                      </div>
                   </div>
                </div>
            </div>

            {/* Right Form Section */}
            <div style={{ flex: '1 1 500px', padding: '60px 50px', background: '#ffffff', position: 'relative' }}>
               <button
                  onClick={onClose}
                  style={{
                    position: 'absolute', top: '30px', right: '30px', background: 'transparent',
                    border: 'none', color: '#64748b', cursor: 'pointer', zIndex: 10
                  }}
                >
                  <X size={24} />
               </button>

               {submitted ? (
                 <Motion.div
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
                 >
                    <CheckCircle size={80} color="#22c55e" style={{ marginBottom: '24px' }} />
                    <h3 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: '16px' }}>
                      {lang === 'zh' ? '感謝您的聯絡！' : 'Message Sent!'}
                    </h3>
                    <p style={{ color: '#64748b', lineHeight: 1.6 }}>
                      {lang === 'zh' 
                        ? '我們已收到您的請求，團隊將在 24 小時內與您聯繫。' 
                        : "We've received your request. Our team will get back to you within 24 hours."}
                    </p>
                 </Motion.div>
               ) : (
                 <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                      {lang === 'zh' ? '預約免費諮詢' : 'Book Free Consultation'}
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                       <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang === 'zh' ? '您的姓名' : 'Full Name'}</label>
                          <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #f1f5f9', background: '#f8fafc', fontSize: '1rem', outlineColor: 'var(--accent-primary)' }} placeholder={lang === 'zh' ? '例如：約翰 · 威克' : 'John Doe'} />
                       </div>
                       <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang === 'zh' ? '電子信箱' : 'Email Address'}</label>
                          <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #f1f5f9', background: '#f8fafc', fontSize: '1rem', outlineColor: 'var(--accent-primary)' }} placeholder="hello@example.com" />
                       </div>
                    </div>

                    <div>
                       <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang === 'zh' ? '諮詢類型' : 'Service Type'}</label>
                       <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #f1f5f9', background: '#f8fafc', fontSize: '1rem', fontWeight: 600 }}>
                          <option value="Consultation">{lang === 'zh' ? '免費諮詢 (Consultation)' : 'Free Consultation'}</option>
                          <option value="Custom">{lang === 'zh' ? '客製化專案 (Custom Project)' : 'Custom Project Build'}</option>
                          <option value="Enterprise">{lang === 'zh' ? '企業級解決方案 (Enterprise)' : 'Enterprise Solutions'}</option>
                       </select>
                    </div>

                    <div>
                       <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang === 'zh' ? '訊息內容' : 'How can we help?'}</label>
                       <textarea rows="4" value={form.message} onChange={e => setForm({...form, message: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #f1f5f9', background: '#f8fafc', fontSize: '1rem', outlineColor: 'var(--accent-primary)', resize: 'none' }} placeholder={lang === 'zh' ? '告訴我們您的專案目標...' : 'Tell us about your project or business goals...'}></textarea>
                    </div>

                    <button disabled={formStatus === 'submitting'} type="submit" style={{ width: '100%', background: '#0f172a', color: '#ffffff', padding: '18px', borderRadius: '12px', border: 'none', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s', marginTop: '8px', opacity: formStatus === 'submitting' ? 0.7 : 1 }} onMouseOver={e => e.currentTarget.style.background = 'var(--accent-primary)'} onMouseOut={e => e.currentTarget.style.background = '#0f172a'}>
                      {formStatus === 'submitting' ? '...' : <><Send size={20} /> {lang === 'zh' ? '提交訊息' : 'Send Message'}</>}
                    </button>
                 </form>
               )}
            </div>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContactModal;
