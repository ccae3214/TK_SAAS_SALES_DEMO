"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Languages, Monitor, Play,
  Smartphone, Zap, CreditCard, ChevronRight, Layout,
  Shield, Star, Users, ArrowLeft, Briefcase, Palette, Layers, ShoppingBag, Globe, User
} from 'lucide-react';

import VideoModal from '@/components/VideoModal';
import ContactModal from '@/components/ContactModal';

import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

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

export default function Home() {
  const { lang, setLang, t } = useLanguage();
  const { userProfile } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");
  const [scrolled, setScrolled] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const router = useRouter();

  // Fallback translations if needed
  const safeT = t || { 
    nav: { home: "Home", themes: "Our Themes", contact: "Get Started", login: "Login" },
    hero: { 
      tagline: "Premium Web Templates Studio",
      titleTop: "Elevate Your Brand With",
      titleBottom: "Next-Gen Web Design",
      subtitle: "Browse our exclusive templates",
      btnExplore: "Explore Themes",
      btnWatch: "Watch Showreel"
    },
    gallery: {
      cats: {
        "All": "All",
        "Store": "Store", 
        "Business": "Business",
        "Portfolio": "Portfolio",
        "Software": "Software"
      }
    },
    testimonials: { title: "Testimonials", subtitle: "What clients say", items: [] },
    cta: { title: "Get Started", subtitle: "Start your project today", btnStart: "Start Now", btnSchedule: "Schedule Demo" },
    process: { title: "Our Process", items: [] },
    footer: { text: "© 2026 All rights reserved" }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const themesData = baseThemesData.map(theme => {
    const themeData = safeT?.themes?.[theme.id] || {};
    return {
      ...theme,
      title: themeData.title || 'Theme',
      categoryName: themeData.category || 'Unknown',
      description: themeData.desc || '',
      features: themeData.features || []
    };
  });

  const filteredThemes = activeCategory === "All" 
    ? themesData 
    : themesData.filter(t => t.catKey === activeCategory);

  const activeUser = userProfile;

  return (
    <div>
      <div className="next-app-root">
      <header className={scrolled ? "scrolled" : ""}>
        <div className="container header-content">
          <Link href="/" className="logo">
            <div className="logo-icon">
              <Layers color="white" size={24} />
            </div>
            克雷迅網頁設計
          </Link>
          <nav className="nav-links" style={{ alignItems: 'center' }}>
            <a href="#home">{safeT.nav.home}</a>
            <a href="#themes">{safeT.nav.themes}</a>
            <button 
              className="text-gradient" 
              style={{fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer'}}
              onClick={() => setIsContactOpen(true)}
            >
              {safeT.nav.contact}
            </button>
            {activeUser ? (
              <div 
                onClick={() => router.push('/demo/ecommerce')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 700 }}
              >
                <User size={16} /> {activeUser.name}
              </div>
            ) : (
              <Link 
                href="/demo/ecommerce" 
                style={{fontWeight: 700, color: 'var(--text-secondary)', textDecoration: 'none'}}
              >
                {safeT.nav.login || (lang === 'en' ? 'Login' : '登錄')}
              </Link>
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
        {/* Same Hero content here... */}
        <section id="home" className="hero-section">
          <div className="hero-bg-accent"></div>
          <Motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="container"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <div className="tagline">{safeT.hero.tagline}</div>
            <h1 className="hero-title">
              {safeT.hero.titleTop} <br />
              <span className="text-gradient">{safeT.hero.titleBottom}</span>
            </h1>
            <p className="hero-subtitle">
              {safeT.hero.subtitle}
            </p>
            <div className="hero-buttons">
              <a href="#themes" className="btn-primary" style={{ textDecoration: 'none' }}>
                {safeT.hero.btnExplore} <ArrowRight size={18} />
              </a>
              <button 
                className="btn-secondary"
                onClick={() => setIsVideoOpen(true)}
              >
                <Play size={18} /> {safeT.hero.btnWatch}
              </button>
            </div>
          </Motion.div>
        </section>

        {/* Gallery Section */}
        <section id="themes" className="gallery-section">
          <div className="container">
            {/* Gallery rendering logic... */}
            <div className="filter-container">
              {categoryKeys.map(catKey => (
                <button 
                  key={catKey} 
                  className={`filter-btn ${activeCategory === catKey ? 'active' : ''}`}
                  onClick={() => setActiveCategory(catKey)}
                >
                  {safeT.gallery.cats[catKey]}
                </button>
              ))}
            </div>
            <Motion.div layout className="themes-grid">
                {filteredThemes.map(theme => (
                  <Motion.div key={theme.id} className="theme-card glass-panel">
                     <div className="theme-image-container">
                        <img src={theme.image} alt={theme.title} className="theme-image" />
                        <div className="theme-overlay">
                           <button className="btn-primary" onClick={() => router.push(theme.path)}>
                              <Monitor size={16} /> Demo
                           </button>
                        </div>
                     </div>
                     <div className="theme-content">
                        <h3 className="theme-title">{theme.title}</h3>
                        <p className="theme-desc">{theme.description}</p>
                        <button className="btn-secondary" onClick={() => router.push(theme.path)}>Details</button>
                     </div>
                  </Motion.div>
                ))}
            </Motion.div>
          </div>
        </section>
      </main>

        {/* Testimonials Section */}
        <section id="testimonials" className="testimonials-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">{safeT.testimonials?.title || 'Testimonials'}</h2>
              <p className="section-subtitle">{safeT.testimonials?.subtitle || ''}</p>
            </div>
            <Motion.div layout className="testimonials-grid">
              {(safeT.testimonials?.items || []).map((item, idx) => (
                <Motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="testimonial-card glass-panel"
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '6px' }}>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} fill="#fbbf24" color="#fbbf24" />
                    ))}
                  </div>
                  <p className="testimonial-content">"{item.content}"</p>
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(99, 102, 241, 0.1)' }}>
                    <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{item.name}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0' }}>{item.role}</p>
                  </div>
                </Motion.div>
              ))}
            </Motion.div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="pricing-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">{safeT.cta?.title || 'Get Started'}</h2>
              <p className="section-subtitle">{safeT.cta?.subtitle || ''}</p>
            </div>
            <div className="pricing-grid">
              {[
                {
                  name: lang === 'zh' ? '基礎版' : 'Basic',
                  price: lang === 'zh' ? '免費' : 'Free',
                  desc: lang === 'zh' ? '適合個人或小型專案' : 'Perfect for individuals',
                  features: [
                    lang === 'zh' ? '單頁面設計' : 'Single Page Design',
                    lang === 'zh' ? '行動版本化' : 'Mobile Responsive',
                    lang === 'zh' ? '基本SEO優化' : 'Basic SEO',
                    lang === 'zh' ? '7天交付' : '7-day Delivery'
                  ],
                  cta: lang === 'zh' ? '免費諮詢' : 'Get Started'
                },
                {
                  name: lang === 'zh' ? '標準版' : 'Standard',
                  price: lang === 'zh' ? 'NT$15,000' : '$500',
                  desc: lang === 'zh' ? '最受歡迎的選擇' : 'Most Popular',
                  features: [
                    lang === 'zh' ? '5個頁面設計' : '5-Page Design',
                    lang === 'zh' ? '行動版本化' : 'Mobile Responsive',
                    lang === 'zh' ? '進階SEO優化' : 'Advanced SEO',
                    lang === 'zh' ? '無限修改次數' : 'Unlimited Revisions',
                    lang === 'zh' ? '14天交付' : '14-day Delivery'
                  ],
                  cta: lang === 'zh' ? '立即開始' : 'Choose Plan',
                  popular: true
                },
                {
                  name: lang === 'zh' ? '進階版' : 'Premium',
                  price: lang === 'zh' ? 'NT$35,000+' : '$1000+',
                  desc: lang === 'zh' ? '完整電商解決方案' : 'Full E-Commerce',
                  features: [
                    lang === 'zh' ? '不限頁面設計' : 'Unlimited Pages',
                    lang === 'zh' ? '購物車與支付' : 'Shopping Cart & Payment',
                    lang === 'zh' ? 'CRM集成' : 'CRM Integration',
                    lang === 'zh' ? '完整託管與維護' : 'Full Hosting & Support',
                    lang === 'zh' ? '自訂交付時間' : 'Custom Timeline'
                  ],
                  cta: lang === 'zh' ? '聯繫我們' : 'Contact Sales'
                }
              ].map((plan, idx) => (
                <Motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`pricing-card glass-panel ${plan.popular ? 'popular' : ''}`}
                >
                  {plan.popular && (
                    <div style={{ 
                      background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '100px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      display: 'inline-block',
                      marginBottom: '16px'
                    }}>
                      ⭐ {lang === 'zh' ? '最受歡迎' : 'MOST POPULAR'}
                    </div>
                  )}
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px' }}>{plan.name}</h3>
                  <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px', fontSize: '0.95rem' }}>{plan.desc}</p>
                  <div style={{ margin: '24px 0', paddingBottom: '24px', borderBottom: '1px solid rgba(99, 102, 241, 0.1)' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{plan.price}</div>
                    {lang === 'zh' ? '（新台幣）' : '(USD)'}
                  </div>
                  <ul style={{ listStyle: 'none', padding: '0', margin: '0 0 24px' }}>
                    {plan.features.map((feature, fidx) => (
                      <li key={fidx} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                        <Check size={20} color="#6366f1" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button 
                    onClick={() => setIsContactOpen(true)}
                    className={`btn-${plan.popular ? 'primary' : 'secondary'}`}
                    style={{ width: '100%' }}
                  >
                    {plan.cta}
                  </button>
                </Motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section id="process" className="process-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">{safeT.process?.title || 'Our Process'}</h2>
            </div>
            <div className="process-timeline">
              {(safeT.process?.items || []).map((item, idx) => (
                <Motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="process-step glass-panel"
                >
                  <div className="step-number">{idx + 1}</div>
                  <h4 className="step-title">{item.title}</h4>
                  <p className="step-desc">{item.desc}</p>
                </Motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="faq-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">{t?.themes?.[2]?.faq?.title || 'Frequently Asked Questions'}</h2>
            </div>
            <div className="faq-list">
              {(t?.themes?.[2]?.faq?.items || []).map((item, idx) => (
                <Motion.div
                  key={idx}
                  className="faq-item glass-panel"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                >
                  <div 
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '16px'
                    }}
                  >
                    <h4 style={{ margin: '0', fontWeight: 600 }}>{item.q}</h4>
                    <ChevronRight size={20} />
                  </div>
                  <p style={{ padding: '0 16px 16px', color: 'var(--text-secondary)', margin: '0' }}>
                    {item.a}
                  </p>
                </Motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Final Section */}
        <section className="final-cta-section">
          <div className="container" style={{ textAlign: 'center' }}>
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <h2 className="section-title">{t.cta.title}</h2>
              <p className="section-subtitle" style={{ maxWidth: '600px', margin: '16px auto 32px' }}>
                {t.cta.subtitle}
              </p>
              <div className="hero-buttons" style={{ justifyContent: 'center' }}>
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
                  {safeT.cta?.btnSchedule || 'Schedule Demo'}
                </button>
              </div>
            </Motion.div>
          </div>
        </section>

        <VideoModal isOpen={isVideoOpen} onClose={() => setIsVideoOpen(false)} lang={lang} />
        <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} lang={lang} />
      </div>

      <footer>
        {safeT.footer?.text || '© 2026 All rights reserved'}
      </footer>
    </div>
  );
}
