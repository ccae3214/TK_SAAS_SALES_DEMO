import React, { useState, useEffect } from 'react';
import { 
  Rocket, Shield, Zap, BarChart3, 
  ChevronRight, CheckCircle2, Star,
  Globe, Layout, Sparkles, Box, Mail, Newspaper
} from 'lucide-react';
import { DemoOverlay } from '@/components/DemoOverlay';
import { useLanguage } from '@/context/LanguageContext';
import { motion as Motion, AnimatePresence } from 'framer-motion';

function SaasDemo() {
  const { t, lang } = useLanguage(); 
  const c = t?.saas || { nav: {}, hero: {}, dashboard: {}, features: {}, pricing: {} };
  const [news, setNews] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/news')
      .then(res => res.json())
      .then(data => setNews(data || []))
      .catch(err => console.log('News fetch error', err));
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { 
        staggerChildren: 0.15,
        delayChildren: 0.3
      } 
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 30 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  const floatingVariants = {
    initial: { y: 0 },
    animate: {
      y: [-15, 15, -15],
      transition: { repeat: Infinity, duration: 6, ease: "easeInOut" }
    }
  };

  return (
    <div style={{ background: '#0a0b10', minHeight: '100vh', color: '#ffffff', fontFamily: "'Outfit', sans-serif", overflowX: 'hidden' }}>
      <DemoOverlay title="SaaS Platform" />
      
      {/* Dynamic Glow Background */}
      <div style={{ position: 'absolute', top: '-10%', left: '10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, #6366f122 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '0%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, #8b5cf611 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

      {/* Header */}
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', padding: '24px 60px',
        alignItems: 'center', background: 'rgba(10, 11, 16, 0.7)', backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Rocket size={20} color="white" />
          </div>
          Nexus<span style={{ color: '#6366f1' }}>Core</span>
        </div>
        <nav style={{ display: 'flex', gap: '32px', fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>
          <span style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#fff'} onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}>Features</span>
          <span style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#fff'} onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}>Pricing</span>
          <span style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#fff'} onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}>About</span>
        </nav>
        <Motion.button 
           whileHover={{ scale: 1.05 }}
           whileTap={{ scale: 0.95 }}
           style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', padding: '12px 28px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)' }}>
          {lang === 'zh' ? '立即探索' : 'Get Started'}
        </Motion.button>
      </header>

      {/* Hero Section */}
      <section style={{ 
        padding: '120px 60px 80px', textAlign: 'center', position: 'relative', 
        zIndex: 1,maxWidth: '1200px', margin: '0 auto' 
      }}>
        <Motion.div initial="hidden" animate="visible" variants={containerVariants}>
          <Motion.div variants={itemVariants} style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '8px 16px', borderRadius: '100px', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', display: 'inline-block', marginBottom: '24px' }}>
             🚀 Evolution 2.0 Just Released
          </Motion.div>
          <Motion.h1 variants={itemVariants} style={{ 
            fontSize: 'max(4.5rem, 6vw)', fontWeight: 900, lineHeight: 1, 
            letterSpacing: '-3px', margin: '0 0 32px' 
          }}>
            Accelerate <br />
            <span style={{ background: 'linear-gradient(90deg, #6366f1, #d946ef)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>Intelligence.</span>
          </Motion.h1>
          <Motion.p variants={itemVariants} style={{ fontSize: '1.4rem', color: '#94a3b8', maxWidth: '700px', margin: '0 auto 48px', lineHeight: 1.5, fontWeight: 500 }}>
             {c.hero.subtitle}
          </Motion.p>
          <Motion.div variants={itemVariants} style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button style={{ background: 'white', color: '#000', border: 'none', padding: '18px 40px', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.25s' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
              {lang === 'zh' ? '開始免費試用' : 'Start Free Trial'}
            </button>
            <button style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '18px 40px', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', fontSize: '1.1rem', backdropFilter: 'blur(10px)' }}>
              {lang === 'zh' ? '查看演示影片' : 'Watch Demo'}
            </button>
          </Motion.div>
        </Motion.div>

        {/* Dashboard Preview Animation */}
        <Motion.div 
           initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 0.8 }}
           style={{ marginTop: '100px', position: 'relative' }}>
           <div style={{ 
             background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '40px', 
             boxShadow: '0 40px 100px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
             overflow: 'hidden', backdropFilter: 'blur(20px)'
           }}>
             <img src="https://images.unsplash.com/photo-1551288049-bbbda5366ef9?q=80&w=2000" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '32px', filter: 'hue-rotate(240deg)' }} alt="" />
           </div>
           
           {/* Floating Cards Over Image */}
           <Motion.div variants={floatingVariants} initial="initial" animate="animate" style={{ position: 'absolute', top: '10%', left: '-10%', background: 'rgba(15, 23, 42, 0.9)', padding: '24px', borderRadius: '24px', border: '1px solid #6366f155', backdropFilter: 'blur(30px)', width: '220px', textAlign: 'left', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                 <div style={{ width: 40, height: 40, background: '#6366f122', color: '#6366f1', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={18} /></div>
                 <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Efficiency</div>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '4px' }}>+482%</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Performance Growth</div>
           </Motion.div>

           <Motion.div variants={floatingVariants} initial="initial" animate="animate" transition={{ duration: 5 }} style={{ position: 'absolute', bottom: '20%', right: '-5%', background: 'rgba(15, 23, 42, 0.9)', padding: '24px', borderRadius: '24px', border: '1px solid #d946ef55', backdropFilter: 'blur(30px)', width: '220px', textAlign: 'left', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                 <div style={{ width: 40, height: 40, background: '#d946ef22', color: '#d946ef', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={18} /></div>
                 <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Security</div>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '4px' }}>100%</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Data Protected</div>
           </Motion.div>
        </Motion.div>
      </section>

      {/* News Section with Stagger */}
      <section style={{ padding: '100px 60px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px', color: '#6366f1' }}>
             <Newspaper size={20} /> <span style={{ fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', fontSize: '0.85rem' }}>Announcements</span>
          </div>
          <h2 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '48px', letterSpacing: '-1.5px' }}>{lang === 'zh' ? '最新動態' : "What's New"}</h2>
        </Motion.div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '32px', maxWidth: '1200px', margin: '0 auto' }}>
          {news.slice(0, 3).map((item, i) => (
            <Motion.div 
               key={i} 
               initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }} 
               whileInView={{ opacity: 1, x: 0 }} 
               viewport={{ once: true }}
               transition={{ duration: 0.8, delay: i * 0.1 }}
               style={{ 
                 background: 'rgba(255,255,255,0.02)', padding: '40px', borderRadius: '30px', 
                 textAlign: 'left', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' 
               }}
            >
               <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, background: 'linear-gradient(135deg, #6366f133, transparent)', borderRadius: '0 0 0 60px' }} />
               <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 800, marginBottom: '16px' }}>{new Date(item.date).toLocaleDateString()}</div>
               <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '16px' }}>{item.title}</h3>
               <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>{item.content}</p>
            </Motion.div>
          ))}
        </div>
      </section>

      {/* Pricing Section - Staggered Cards */}
      <section style={{ padding: '120px 60px', background: '#07080d' }}>
         <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <h2 style={{ fontSize: '3.5rem', fontWeight: 950, letterSpacing: '-2px' }}>Simple <span style={{ color: '#6366f1' }}>Pricing</span></h2>
            <p style={{ color: '#64748b', fontSize: '1.25rem', marginTop: '16px' }}>Scale your intelligence with our flexible plans.</p>
         </div>
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', maxWidth: '1100px', margin: '0 auto' }}>
            {c.pricing.plans.map((plan, i) => (
               <Motion.div 
                  key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  style={{ 
                    background: i === 1 ? 'linear-gradient(180deg, #1e1b4b 0%, #0a0b10 100%)' : 'rgba(255,255,255,0.02)', 
                    padding: '48px', borderRadius: '32px', border: i === 1 ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.05)',
                    position: 'relative'
                  }}>
                  {i === 1 && <div style={{ position: 'absolute', top: 20, right: 20, background: '#6366f1', color: 'white', padding: '6px 14px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 900 }}>MOST POPULAR</div>}
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>{plan.name}</div>
                  <div style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '32px' }}>{plan.price}<span style={{ fontSize: '1rem', color: '#64748b' }}>/mo</span></div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 48px' }}>
                     {plan.features.map((f, j) => (
                        <li key={j} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: '#94a3b8', fontSize: '0.95rem' }}>
                           <CheckCircle2 size={18} color="#6366f1" /> {f}
                        </li>
                     ))}
                  </ul>
                  <button style={{ width: '100%', padding: '16px', borderRadius: '16px', border: 'none', background: i === 1 ? '#6366f1' : 'white', color: i === 1 ? 'white' : 'black', fontWeight: 800, fontSize: '1rem' }}>
                    Choose Plan
                  </button>
               </Motion.div>
            ))}
         </div>
      </section>

      {/* Footer... (keep as is or similar) */}
    </div>
  );
}

export default SaasDemo;
