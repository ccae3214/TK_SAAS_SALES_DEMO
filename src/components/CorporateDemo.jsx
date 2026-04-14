import React, { useState } from 'react';
import { 
  Building2, ArrowRight, BarChart3, ShieldCheck, 
  Users, Globe, CheckCircle2, TrendingUp, Quote,
  Phone, Mail, MapPin, Linkedin, Twitter, Facebook,
  Plus, Minus, Calendar, Tag, User, Send, ExternalLink
} from 'lucide-react';
import { DemoOverlay } from '@/components/DemoOverlay';
import { useLanguage } from '@/context/LanguageContext';
import { motion as Motion, AnimatePresence } from 'framer-motion';

function CorporateDemo() {
  const { t, lang } = useLanguage(); 
  const c = t?.themes?.[2] || { 
    title: 'Corporate Pro',
    hero: { tag: '', title1: '', title2: '', subtitle: '', btn1: '', btn2: '' }, 
    innovation: { tag: '', title: '', desc: '', stats: [] }, 
    values: [], 
    leadership: { title: '', subtitle: '', members: [] }, 
    insights: { title: '', subtitle: '', posts: [] },
    services: { title: '', subtitle: '', items: [] },
    mission: { title: '', desc: '' },
    faq: { title: '', items: [] }, 
    partners: { title: '', subtitle: '' }, 
    contact: { title: '', subtitle: '', btn: '', success: '', fields: [] } 
  };
  const [activeFaq, setActiveFaq] = useState(null);
  const [formStatus, setFormStatus] = useState('idle');
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '' });

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 100;
      const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const menuItems = [
    { label: lang === 'zh' ? '解決方案' : 'Solutions', id: 'services' },
    { label: lang === 'zh' ? '產業應用' : 'Industries', id: 'innovation' },
    { label: lang === 'zh' ? '最新洞察' : 'Insights', id: 'insights' },
    { label: lang === 'zh' ? '關於我們' : 'About', id: 'mission' }
  ];

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormStatus('submitting');
    
    try {
      const response = await fetch('http://localhost:3001/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          type: 'Corporate Inquiry'
        })
      });
      
      if (response.ok) {
        setFormStatus('success');
        setFormData({ name: '', email: '', company: '', message: '' });
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
    <div style={{ background: '#ffffff', minHeight: '100vh', color: '#0f172a', fontFamily: "'Inter', sans-serif" }}>
      <DemoOverlay title={c.title} />
      
      {/* Header */}
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', padding: '20px 60px',
        alignItems: 'center', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 100
      }}>
        <div 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', cursor: 'pointer' }}
        >
          <div style={{ width: 36, height: 36, background: '#2563eb', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={20} color="white" />
          </div>
          <span style={{ letterSpacing: '-0.5px' }}>Nexus<span style={{ color: '#2563eb' }}>Corp</span></span>
        </div>
        <nav style={{ display: 'flex', gap: '32px', fontSize: '0.95rem', fontWeight: 600, color: '#475569' }}>
          {menuItems.map(item => (
            <span 
              key={item.id} 
              onClick={() => scrollToSection(item.id)}
              style={{ cursor: 'pointer', transition: 'color 0.2s', padding: '10px 0' }} 
              onMouseOver={e => e.currentTarget.style.color = '#2563eb'} 
              onMouseOut={e => e.currentTarget.style.color = '#475569'}
            >
              {item.label}
            </span>
          ))}
        </nav>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button style={{ background: 'transparent', color: '#0f172a', border: 'none', padding: '10px 0', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
            {lang === 'zh' ? '登入' : 'Login'}
          </button>
          <button 
            onClick={() => scrollToSection('contact')}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
          >
            {lang === 'zh' ? '聯繫銷售' : 'Contact Sales'}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section id="hero" style={{ 
        position: 'relative', overflow: 'hidden', padding: '120px 20px', 
        background: 'radial-gradient(circle at 10% 20%, rgba(37, 99, 235, 0.05) 0%, transparent 40%)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
            <div style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 700, marginBottom: '24px', fontSize: '0.85rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '8px 16px', borderRadius: '20px', display: 'inline-block' }}>
              {c.hero.tag}
            </div>
            <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '28px', color: '#0f172a', maxWidth: '900px', letterSpacing: '-1.5px' }}>
              {c.hero.title1} <br />
              <span style={{ color: '#2563eb' }}>{c.hero.title2}</span>
            </h1>
            <p style={{ fontSize: '1.25rem', color: '#475569', marginBottom: '48px', lineHeight: 1.6, maxWidth: '700px' }}>
              {c.hero.subtitle}
            </p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
              <button 
                onClick={() => scrollToSection('contact')}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '18px 40px', borderRadius: '10px', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px rgba(37, 99, 235, 0.2)' }}
              >
                {c.hero.btn1} <ArrowRight size={20} />
              </button>
              <button onClick={() => scrollToSection('services')} style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', padding: '18px 40px', borderRadius: '10px', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer' }}>
                {c.hero.btn2}
              </button>
            </div>
          </Motion.div>

          <Motion.div 
            initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.4 }}
            style={{ width: '100%', maxWidth: '1000px', height: '500px', background: '#f1f5f9', borderRadius: '24px', marginTop: '80px', boxShadow: '0 30px 60px -15px rgba(0,0,0,0.1)', overflow: 'hidden', position: 'relative' }}
          >
            <img src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=1200&auto=format&fit=crop" alt="Corporate Office" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15, 23, 42, 0.3), transparent 60%)' }}></div>
          </Motion.div>
        </div>
      </section>

      {/* Partners Bar */}
      <section style={{ padding: '60px 0', background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '40px' }}>
            {c.partners.title}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '60px', opacity: 0.4 }}>
            {['Microsoft', 'Google Cloud', 'AWS', 'Salesforce', 'Oracle', 'SAP'].map(name => (
              <div key={name} style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Innovation Section */}
      <section id="innovation" style={{ padding: '120px 20px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '80px', alignItems: 'center' }}>
          <Motion.div 
            initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
            style={{ flex: 1, borderRadius: '24px', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.1)' }}
          >
            <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1000&auto=format&fit=crop" alt="Innovation" style={{ width: '100%', display: 'block' }} />
          </Motion.div>
          
          <Motion.div 
            initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
            style={{ flex: 1 }}
          >
            <div style={{ color: '#2563eb', fontWeight: 700, marginBottom: '16px', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {c.innovation.tag}
            </div>
            <h2 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '24px', lineHeight: 1.2 }}>{c.innovation.title}</h2>
            <p style={{ fontSize: '1.15rem', color: '#64748b', lineHeight: 1.7, marginBottom: '40px' }}>{c.innovation.desc}</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              {c.innovation.stats.map((stat, idx) => (
                <div key={idx}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a' }}>{stat.val}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8', marginTop: '4px' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </Motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" style={{ padding: '120px 20px', background: '#ffffff' }}>
        <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <h2 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '20px', letterSpacing: '-1px' }}>
              {c.services.title}
            </h2>
            <p style={{ fontSize: '1.2rem', color: '#64748b', maxWidth: '600px', margin: '0 auto' }}>
              {c.services.subtitle}
            </p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px' }}>
            {c.services.items.map((service, idx) => (
              <Motion.div 
                key={idx} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
                style={{ background: '#fff', padding: '48px', borderRadius: '24px', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.3s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.05)'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ width: 64, height: 64, background: '#eff6ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px', color: '#2563eb' }}>
                   {idx === 0 ? <BarChart3 size={32} /> : idx === 1 ? <ShieldCheck size={32} /> : <TrendingUp size={32} />}
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '16px' }}>{service.title}</h3>
                <p style={{ color: '#64748b', lineHeight: 1.6, fontSize: '1rem' }}>{service.desc}</p>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section id="mission" style={{ padding: '120px 20px', background: '#0f172a', color: '#ffffff', textAlign: 'center' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
           <h2 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '32px' }}>{c.mission.title}</h2>
           <p style={{ fontSize: '1.5rem', lineHeight: 1.6, color: '#94a3b8', marginBottom: '48px' }}>{c.mission.desc}</p>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px' }}>
              {c.values.map((v, i) => (
                <div key={i} style={{ padding: '30px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                   <div style={{ color: '#2563eb', marginBottom: '16px' }}><CheckCircle2 size={32} /></div>
                   <h4 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>{v.title}</h4>
                   <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>{v.desc}</p>
                </div>
              ))}
           </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" style={{ padding: '120px 20px', background: '#ffffff' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '16px' }}>{c.faq.title}</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {c.faq.items.map((item, idx) => (
              <div key={idx} style={{ border: '1px solid #f1f5f9', borderRadius: '16px', overflow: 'hidden' }}>
                <button 
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  style={{ width: '100%', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{item.q}</span>
                  {activeFaq === idx ? <Minus size={20} color="#2563eb" /> : <Plus size={20} color="#2563eb" />}
                </button>
                <AnimatePresence>
                  {activeFaq === idx && (
                    <Motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                      <div style={{ padding: '0 24px 24px', color: '#64748b', lineHeight: 1.6 }}>
                        {item.a}
                      </div>
                    </Motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" style={{ padding: '120px 20px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '80px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '24px' }}>
              {c.contact.title}
            </h2>
            <p style={{ fontSize: '1.2rem', color: '#64748b', marginBottom: '48px' }}>
              {c.contact.subtitle}
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, background: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}><Mail size={20} /></div>
                <div>
                   <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Email Us</div>
                   <div style={{ color: '#64748b' }}>solutions@nexuscorp.com</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, background: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}><Phone size={20} /></div>
                <div>
                   <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Call Support</div>
                   <div style={{ color: '#64748b' }}>+1 (555) Nexus-IT</div>
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ flex: 1.2 }}>
            <form onSubmit={handleFormSubmit} style={{ background: '#fff', padding: '48px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
              {formStatus === 'success' ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                   <CheckCircle2 size={64} color="#16a34a" style={{ marginBottom: '20px' }} />
                   <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{c.contact.success}</h3>
                   <button onClick={() => setFormStatus('idle')} style={{ color: '#2563eb', fontWeight: 700, background: 'transparent', border: 'none', cursor: 'pointer', marginTop: '20px' }}>
                     {lang === 'zh' ? '再送一則訊息' : 'Send another inquiry'}
                   </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder={c.contact.fields[0]} style={{ padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }} />
                    <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder={c.contact.fields[1]} style={{ padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }} />
                  </div>
                  <input type="text" required value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} placeholder={c.contact.fields[2]} style={{ padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }} />
                  <textarea rows="4" required value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} placeholder={c.contact.fields[3]} style={{ padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', resize: 'none' }}></textarea>
                  <button disabled={formStatus === 'submitting'} type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
                    {formStatus === 'submitting' ? '...' : <><Send size={18} /> {c.contact.btn}</>}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#ffffff', padding: '100px 60px 40px', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between' }}>
            <div 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.4rem', fontWeight: 800, cursor: 'pointer' }}
            >
               <Building2 size={24} color="#2563eb" /> NexusCorp
            </div>
            <div style={{ display: 'flex', gap: '40px', fontSize: '0.9rem', color: '#64748b' }}>
               <span onClick={() => scrollToSection('services')} style={{ cursor: 'pointer' }}>Global Solutions</span>
               <span onClick={() => scrollToSection('insights')} style={{ cursor: 'pointer' }}>Industry Insights</span>
               <span onClick={() => scrollToSection('mission')} style={{ cursor: 'pointer' }}>Our Mission</span>
               <span onClick={() => scrollToSection('contact')} style={{ cursor: 'pointer' }}>Contact</span>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <Twitter size={20} color="#94a3b8" />
              <Linkedin size={20} color="#94a3b8" />
            </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '60px', color: '#94a3b8', fontSize: '0.85rem' }}>
          {t.footer.text}
        </div>
      </footer>
    </div>
  );
}

export default CorporateDemo;
