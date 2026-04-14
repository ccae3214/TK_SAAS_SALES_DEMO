import React from 'react';
import { DemoOverlay } from '@/components/DemoOverlay';
import { useLanguage } from '@/context/LanguageContext';
import { motion as Motion } from 'framer-motion';
import { Mail, ArrowUpRight, Instagram, Twitter, Linkedin, MapPin, ArrowRight } from 'lucide-react';

function CreativeDemo() {
  const { t, lang } = useLanguage(); 
  const c = t?.themes?.[3] || { 
    title: 'Creative Canvas',
    hero: { title1: '', title2: '', subtitle: '' }, 
    agency: { tag: '', title1: '', title2: '', desc: '', btn: '' },
    work: { title: '', items: [] } 
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' });
    }
  };

  const workItems = c.work.items;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fff', fontFamily: "'Outfit', sans-serif" }}>
      <DemoOverlay title={c.title} />
      
      {/* Dynamic Header */}
      <Motion.header 
        initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 1, ease: 'easeOut' }}
        style={{ 
        display: 'flex', justifyContent: 'space-between', padding: '30px 60px',
        alignItems: 'center', position: 'fixed', top: 0, width: '100%', zIndex: 100,
        boxSizing: 'border-box', background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(30px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <Motion.div 
          whileHover={{ scale: 1.05 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ fontSize: '1.4rem', fontWeight: 950, letterSpacing: '6px', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Studio<span style={{color: '#ef4444'}}>X</span>
        </Motion.div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', display: 'flex', gap: '40px' }}>
          {[
            { label: lang === 'zh' ? '精選作品' : 'Work', id: 'work' },
            { label: lang === 'zh' ? '中心理念' : 'Agency', id: 'agency' },
            { label: lang === 'zh' ? '聯絡我們' : 'Contact', id: 'contact' }
          ].map(item => (
            <Motion.span 
              key={item.id} 
              whileHover={{ color: '#ef4444', x: 5 }}
              onClick={() => scrollToSection(item.id)}
              style={{ cursor: 'pointer', opacity: 0.8, transition: 'color 0.2s', position: 'relative' }}
            >
              {item.label}
            </Motion.span>
          ))}
        </div>
      </Motion.header>

      {/* Hero with Parallax Text */}
      <section id="hero" style={{ 
        height: '110vh', display: 'flex', alignItems: 'center', padding: '0 60px', position: 'relative', overflow: 'hidden' 
      }}>
        <Motion.div initial="hidden" animate="visible" variants={containerVariants} style={{ position: 'relative', zIndex: 2 }}>
          <Motion.h1 variants={itemVariants} style={{ 
            fontSize: 'max(9rem, 14vw)', fontWeight: 950, lineHeight: 0.8, 
            letterSpacing: '-8px', margin: 0, textTransform: 'uppercase'
          }}>
            {c.hero.title1} <br />
            <Motion.span 
               initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5, duration: 1 }}
               style={{ color: 'transparent', WebkitTextStroke: '2px #ef4444' }}>
               {c.hero.title2}
            </Motion.span>
          </Motion.h1>
          <Motion.div variants={itemVariants} style={{ display: 'flex', maxWidth: '500px', marginTop: '80px', gap: '40px' }}>
             <div style={{ width: 80, height: 4, background: '#ef4444', marginTop: 15 }}></div>
             <p style={{ fontSize: '1.4rem', lineHeight: 1.4, color: '#aaa', margin: 0, fontWeight: 500, letterSpacing: '-0.5px' }}>
                {c.hero.subtitle}
             </p>
          </Motion.div>
        </Motion.div>
        
        {/* Abstract Background Element */}
        <Motion.div 
          style={{ position: 'absolute', top: '20%', right: '-5%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, #ef444422 0%, transparent 70%)', zIndex: 1 }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 8 }}
        />
      </section>

      {/* Portfolio Grid with Hover and Scroll Animations */}
      <section id="work" style={{ padding: '100px 40px', background: '#080808' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '40px' }}>
          {workItems.map((item, i) => (
            <Motion.div 
               key={i}
               initial={{ opacity: 0, y: 80 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 1, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
               style={{ 
                 gridColumn: i === 0 ? '1 / 8' : (i === 1 ? '8 / 13' : '1 / 13'), 
                 height: i === 2 ? '600px' : '750px',
                 position: 'relative', overflow: 'hidden', borderRadius: '24px', cursor: 'pointer'
               }}
            >
              <Motion.img 
                whileHover={{ scale: 1.1, filter: 'grayscale(0)' }}
                src={item.img || "https://images.unsplash.com/photo-1549490349-8643362247b5?q=80&w=1200"} 
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(0.5)', transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1)' }} 
              />
              <div style={{ position: 'absolute', bottom: 40, left: 40, zIndex: 3 }}>
                 <div style={{ fontSize: '0.9rem', letterSpacing: '5px', textTransform: 'uppercase', color: '#ef4444', fontWeight: 900, marginBottom: '12px' }}>{item.cat}</div>
                 <h2 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 950, textTransform: 'uppercase', lineHeight: 0.9, letterSpacing: '-2px' }}>{item.title}</h2>
              </div>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)', zIndex: 2 }}></div>
            </Motion.div>
          ))}
        </div>
      </section>

      {/* Agency Section */}
      <section id="agency" style={{ padding: '160px 60px', textAlign: 'center' }}>
         <Motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5 }}>
            <h2 style={{ fontSize: 'max(4rem, 6vw)', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '-2px', marginBottom: '40px' }}>
              We transform <span style={{ color: '#ef4444' }}>ideas</span> into <br /> digital reality.
            </h2>
            <p style={{ maxWidth: '800px', margin: '0 auto', fontSize: '1.25rem', color: '#888', lineHeight: 1.6 }}>
               Nexus Studio is a cross-disciplinary design house that specializes in building high-end digital products for the world's most innovative brands.
            </p>
         </Motion.div>
      </section>

      {/* Footer */}
      <footer id="contact" style={{ padding: '100px 60px', borderTop: '1px solid rgba(255,255,255,0.05)', background: '#050505' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
           <div>
              <div style={{ fontSize: '3rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-1px' }}>Ready to <span style={{ color: '#ef4444' }}>Connect</span>?</div>
              <Motion.button 
                whileHover={{ scale: 1.05, background: '#fff', color: '#000' }}
                style={{ marginTop: '40px', padding: '24px 48px', borderRadius: '100px', border: '2px solid #fff', background: 'transparent', color: '#fff', fontWeight: 900, fontSize: '1.2rem', cursor: 'pointer', transition: 'all 0.3s' }}>
                HELLO@NEXUS.STUDIO
              </Motion.button>
           </div>
           <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '20px', color: '#666' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: '#fff' }}>FOLLOW US</div>
              <div style={{ display: 'flex', gap: '30px', fontSize: '1.2rem' }}>
                 <Motion.span whileHover={{ y: -5, color: '#fff' }} style={{ cursor: 'pointer' }}><Instagram /></Motion.span>
                 <Motion.span whileHover={{ y: -5, color: '#fff' }} style={{ cursor: 'pointer' }}><Twitter /></Motion.span>
                 <Motion.span whileHover={{ y: -5, color: '#fff' }} style={{ cursor: 'pointer' }}><Linkedin /></Motion.span>
              </div>
           </div>
        </div>
      </footer>
    </div>
  );
}

export default CreativeDemo;
