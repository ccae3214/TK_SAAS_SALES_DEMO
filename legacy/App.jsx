import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Languages, Monitor, Play,
  Smartphone, Zap, CreditCard, ChevronRight, Layout,
  Shield, Star, Users, ArrowLeft, Briefcase, Palette, Layers, ShoppingBag, Globe
} from 'lucide-react';
import './App.css';

// --- Demo Pages Imports ---
import EcommerceDemo from './pages/EcommerceDemo.jsx';
import CorporateDemo from './pages/CorporateDemo.jsx';
import CreativeDemo from './pages/CreativeDemo.jsx';
import SaasDemo from './pages/SaasDemo.jsx';

import VideoModal from './components/VideoModal.jsx';
import ContactModal from './components/ContactModal.jsx';

import { LanguageProvider, useLanguage } from './context/LanguageContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

const baseThemesData = [
  {
    id: 1,
    image: "/ecommerce_ui.png",
    icon: <ShoppingBag size={20} />,
    path: "/demo/ecommerce",
    catKey: "Store"
  },
  {
    id: 2,
    image: "/corporate_ui.png",
    icon: <Briefcase size={20} />,
    path: "/demo/corporate",
    catKey: "Business"
  },
  {
    id: 3,
    image: "/creative_ui.png",
    icon: <Palette size={20} />,
    path: "/demo/creative",
    catKey: "Portfolio"
  },
  {
    id: 4,
    image: "/saas_ui.png",
    icon: <Zap size={20} />,
    path: "/demo/saas",
    catKey: "Software"
  }
];

const categoryKeys = ["All", "Store", "Business", "Portfolio", "Software"];

// --- Home Component ---
import AdminDashboard from './pages/AdminDashboard.jsx';
function Home() {
  const { lang, setLang, t } = useLanguage();
  const { userProfile } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");
  const [scrolled, setScrolled] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const themesData = baseThemesData.map(theme => ({
    ...theme,
    title: t.themes[theme.id].title,
    categoryName: t.themes[theme.id].category,
    description: t.themes[theme.id].desc,
    features: t.themes[theme.id].features
  }));

  const filteredThemes = activeCategory === "All" 
    ? themesData 
    : themesData.filter(t => t.catKey === activeCategory);

  return (
    <>
      <header className={scrolled ? "scrolled" : ""}>
        <div className="container header-content">
          <a href="#" className="logo">
            <div className="logo-icon">
              <Layers color="white" size={24} />
            </div>
            克雷迅網頁設計
          </a>
          <nav className="nav-links" style={{ alignItems: 'center' }}>
            <a href="#home">{t.nav.home}</a>
            <a href="#themes">{t.nav.themes}</a>
            <a 
              href="#contact" 
              className="text-gradient" 
              style={{fontWeight: 700}}
              onClick={(e) => {
                e.preventDefault();
                setIsContactOpen(true);
              }}
            >
              {t.nav.contact}
            </a>
            {userProfile ? (
              <div 
                onClick={() => navigate('/demo/ecommerce')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 700 }}
              >
                <User size={16} /> {userProfile.name}
              </div>
            ) : (
              <a 
                href="/demo/ecommerce" 
                style={{fontWeight: 700, color: 'var(--text-secondary)'}}
              >
                {t.nav.login || (lang === 'en' ? 'Login' : '登錄')}
              </a>
            )}
            <button 
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '20px',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                transition: 'all 0.3s ease'
              }}
            >
              <Languages size={16} />
              {lang === 'en' ? '中文' : 'EN'}
            </button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section id="home" className="hero-section">
          <div className="hero-bg-accent"></div>
          
          <Motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="container"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <div className="tagline">{t.hero.tagline}</div>
            <h1 className="hero-title">
              {t.hero.titleTop} <br />
              <span className="text-gradient">{t.hero.titleBottom}</span>
            </h1>
            <p className="hero-subtitle">
              {t.hero.subtitle}
            </p>
            
            <div className="hero-buttons">
              <a href="#themes" className="btn-primary" style={{ textDecoration: 'none' }}>
                {t.hero.btnExplore} <ArrowRight size={18} />
              </a>
              <button 
                className="btn-secondary"
                onClick={() => setIsVideoOpen(true)}
              >
                <Play size={18} /> {t.hero.btnWatch}
              </button>
            </div>
          </Motion.div>
        </section>

        {/* Gallery Section */}
        <section id="themes" className="gallery-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">{t.gallery.title}</h2>
              <p className="section-subtitle">{t.gallery.subtitle}</p>
            </div>

            <div className="filter-container">
              {categoryKeys.map(catKey => (
                <button 
                  key={catKey} 
                  className={`filter-btn ${activeCategory === catKey ? 'active' : ''}`}
                  onClick={() => setActiveCategory(catKey)}
                >
                  {t.gallery.cats[catKey]}
                </button>
              ))}
            </div>

            <Motion.div layout className="themes-grid">
              <AnimatePresence>
                {filteredThemes.map(theme => (
                  <Motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4 }}
                    key={theme.id} 
                    className="theme-card glass-panel"
                  >
                    <div className="theme-image-container">
                      <img src={theme.image} alt={theme.title} className="theme-image" />
                      <div className="theme-overlay">
                        <button 
                          className="btn-primary" 
                          style={{ transform: 'scale(1)' }}
                          onClick={() => navigate(theme.path)}
                        >
                          <Monitor size={16} /> {t.gallery.btnDemo}
                        </button>
                      </div>
                    </div>
                    
                    <div className="theme-content">
                      <div className="theme-header">
                        <div>
                          <h3 className="theme-title">{theme.title}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {theme.icon}
                            <span className="theme-category" style={{ padding: '0', background: 'transparent' }}>{theme.categoryName}</span>
                          </div>
                        </div>
                      </div>
                      
                      <p className="theme-desc">{theme.description}</p>
                      
                      <ul className="theme-features">
                        {theme.features.map((feature, idx) => (
                          <li key={idx}>
                            <Check size={16} className="feature-icon" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      
                      <div className="theme-footer">
                        <button 
                          className="btn-secondary demo-btn"
                          onClick={() => navigate(theme.path)}
                        >
                          {t.gallery.btnDetails} <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </Motion.div>
                ))}
              </AnimatePresence>
            </Motion.div>
          </div>
        </section>

        {/* Process Section */}
        <section className="section" style={{ background: 'var(--surface-color)', borderRadius: '60px', margin: '60px 20px', padding: '100px 40px' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <h2 className="section-title">{t.process.title}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '40px', marginTop: '60px' }}>
              {t.process.items.map((item, i) => (
                <Motion.div 
                  key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  style={{ textAlign: 'left', padding: '30px', background: 'white', borderRadius: '30px', border: '1px solid var(--glass-border)' }}
                >
                  <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--accent-primary)', opacity: 0.15, marginBottom: '-20px' }}>0{i+1}</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>{item.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{item.desc}</p>
                </Motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="section">
           <div className="container">
              <div style={{ textAlign: 'center', marginBottom: '80px' }}>
                 <h2 className="section-title">{t.testimonials.title}</h2>
                 <p className="section-subtitle">{t.testimonials.subtitle}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
                 {t.testimonials.items.map((item, i) => (
                   <Motion.div 
                     key={i} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                     style={{ padding: '40px', background: 'var(--surface-color)', borderRadius: '32px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column' }}
                   >
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
                         {[1, 2, 3, 4, 5].map(s => <Star key={s} size={16} fill="var(--accent-secondary)" color="var(--accent-secondary)" />)}
                      </div>
                      <p style={{ fontStyle: 'italic', fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '30px', flex: 1 }}>"{item.content}"</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                         <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{item.name[0]}</div>
                         <div>
                            <div style={{ fontWeight: 700 }}>{item.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.role}</div>
                         </div>
                      </div>
                   </Motion.div>
                 ))}
              </div>
           </div>
        </section>

        {/* CTA Section */}
        <section id="contact" className="cta-section">
          <div className="container">
            <Motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="cta-box glass-panel"
            >
              <h2 className="section-title">{t.cta.title}</h2>
              <p className="section-subtitle" style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                {t.cta.subtitle}
              </p>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button 
                  className="btn-primary"
                  onClick={() => setIsContactOpen(true)}
                >
                  {t.cta.btnStart}
                </button>
                <button 
                  className="btn-secondary"
                  onClick={() => setIsContactOpen(true)}
                >
                  {t.cta.btnSchedule}
                </button>
              </div>
            </Motion.div>
          </div>
        </section>
      </main>

      <VideoModal 
        isOpen={isVideoOpen} 
        onClose={() => setIsVideoOpen(false)} 
        lang={lang}
      />
      <ContactModal 
        isOpen={isContactOpen} 
        onClose={() => setIsContactOpen(false)} 
        lang={lang}
      />

      <footer>
        <div className="container">
          <div style={{ padding: '60px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
             <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '16px' }}>{lang === 'zh' ? '訂閱我們的電子報' : 'Subscribe to Newsletter'}</h3>
             <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{lang === 'zh' ? '獲得最新的設計靈感與優惠資訊。' : 'Get the latest design insights and exclusive offers.'}</p>
             <form 
               onSubmit={async (e) => {
                 e.preventDefault();
                 const email = e.target.email.value;
                 const res = await fetch('http://localhost:3001/api/newsletter', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ email })
                 });
                 if (res.ok) {
                   alert(lang === 'zh' ? '感謝訂閱！' : 'Subscribed successfully!');
                   e.target.reset();
                 } else {
                   alert(lang === 'zh' ? '此信箱已訂閱。' : 'Already subscribed.');
                 }
               }}
               style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '400px' }}
             >
                <input name="email" type="email" required placeholder="name@example.com" style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--glass-border)', fontSize: '0.9rem' }} />
                <button type="submit" style={{ background: 'var(--text-primary)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>{lang === 'zh' ? '訂閱' : 'Join'}</button>
             </form>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
            <Globe size={20} color="var(--accent-primary)" />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>克雷迅網頁設計 Demo</span>
          </div>
          <p>{t.footer.text}</p>
          <p style={{ marginTop: '12px' }}>
            <Link to="/admin" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textDecoration: 'none', opacity: 0.5 }}>
              Admin Access
            </Link>
          </p>
        </div>
      </footer>
    </>
  );
}

// Global Demo Back Button Overlay Component
export function DemoOverlay({ title }) {
  const navigate = useNavigate();
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
        onClick={() => navigate('/')}
        style={{
          background: 'var(--surface-hover)',
          border: 'none',
          color: 'var(--text-primary)',
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
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {t.overlay.preview}
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                    onClick={() => { navigate(d.path); setIsOpen(false); }}
                    style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: location.pathname === d.path ? 'var(--accent-primary)' : '#475569', background: location.pathname === d.path ? '#f5f3ff' : 'transparent' }}
                    onMouseOver={e => !location.pathname.includes(d.path) && (e.currentTarget.style.background = '#f8fafc')}
                    onMouseOut={e => !location.pathname.includes(d.path) && (e.currentTarget.style.background = 'transparent')}
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

// --- Main App Wrapper with i18n Context ---
function AppWrapper() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/demo/ecommerce" element={<EcommerceDemo />} />
            <Route path="/demo/corporate" element={<CorporateDemo />} />
            <Route path="/demo/creative" element={<CreativeDemo />} />
            <Route path="/demo/saas" element={<SaasDemo />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default AppWrapper;
