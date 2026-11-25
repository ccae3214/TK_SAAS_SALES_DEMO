"use client";

import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, BarChart3, Check, CheckCircle2, ChevronDown, Globe, Menu, Newspaper, Rocket, Shield, Sparkles, X, Zap } from 'lucide-react';
import { DemoOverlay } from '@/components/DemoOverlay';
import { PageHeader } from '@/components/PageHeader';
import { useLanguage } from '@/context/LanguageContext';
import './SaasDemo.css';

function SaasDemo() {
  const { t, lang } = useLanguage();
  const c = t?.saas || { nav: {}, hero: {}, pricing: { plans: [] } };
  const [news, setNews] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const isZh = lang === 'zh';

  useEffect(() => {
    fetch('/api/news').then(res => res.json()).then(data => {
      setNews(Array.isArray(data) ? data : (data?.items || []));
    }).catch(() => setNews([]));
  }, []);

  useEffect(() => {
    document.body.classList.toggle('saas-menu-open', menuOpen);
    return () => document.body.classList.remove('saas-menu-open');
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const navLabels = {
    features: c.nav?.features || (isZh ? '產品特色' : 'Features'),
    pricing: c.nav?.pricing || (isZh ? '方案價格' : 'Pricing'),
    about: c.nav?.about || (isZh ? '最新消息' : 'Updates'),
  };
  const features = [
    { icon: Zap, title: isZh ? '自動化部署' : 'Automated delivery', copy: isZh ? '從提交到上線，一套流程管理每次發布。' : 'Move from commit to release with one dependable workflow.' },
    { icon: Shield, title: isZh ? '企業級安全' : 'Enterprise security', copy: isZh ? '集中管理權限與環境，讓團隊安心擴展。' : 'Manage access and environments as your team grows.' },
    { icon: BarChart3, title: isZh ? '即時掌握成效' : 'Live visibility', copy: isZh ? '關鍵指標一目了然，快速找到下一個成長機會。' : 'See the signals that help your team make its next move.' },
  ];

  return (
    <div className="saas-page">
      <div className="saas-demo-chrome saas-demo-picker"><DemoOverlay title={c.title || 'SaaS Platform'} /></div>
      <div className="saas-demo-chrome saas-demo-locale"><PageHeader /></div>

      <header className="saas-header">
        <a className="saas-brand" href="#top" onClick={closeMenu} aria-label="NexusCore 首頁">
          <span className="saas-brand-mark"><Rocket size={19} aria-hidden="true" /></span>
          <span>Nexus<span>Core</span></span>
        </a>
        <button className="saas-menu-toggle" type="button" aria-label={menuOpen ? (isZh ? '關閉選單' : 'Close menu') : (isZh ? '開啟選單' : 'Open menu')} aria-expanded={menuOpen} aria-controls="saas-navigation" onClick={() => setMenuOpen(open => !open)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav id="saas-navigation" className={`saas-navigation${menuOpen ? ' is-open' : ''}`} aria-label={isZh ? '主要導覽' : 'Primary navigation'}>
          <a href="#features" onClick={closeMenu}>{navLabels.features}</a>
          <a href="#pricing" onClick={closeMenu}>{navLabels.pricing}</a>
          <a href="#updates" onClick={closeMenu}>{navLabels.about}</a>
          <a className="saas-nav-cta" href="#pricing" onClick={closeMenu}>{c.nav?.getStarted || (isZh ? '探索方案' : 'Explore plans')}<ArrowRight size={16} /></a>
        </nav>
        <a className="saas-header-cta" href="#pricing">{c.nav?.getStarted || (isZh ? '探索方案' : 'Explore plans')}<ArrowRight size={16} /></a>
      </header>

      <main id="top">
        <section className="saas-hero">
          <div className="saas-hero-copy">
            <div className="saas-eyebrow"><Sparkles size={15} />{c.hero?.badge || (isZh ? '為成長中的團隊打造' : 'BUILT FOR TEAMS IN MOTION')}</div>
            <h1>{c.hero?.titleTop || (isZh ? '讓團隊專注' : 'Make room for')}<br /><span>{c.hero?.titleBottom || (isZh ? '創造下一步。' : 'what comes next.')}</span></h1>
            <p>{c.hero?.subtitle || (isZh ? '把部署、環境與成效放進同一個工作平台。減少繁瑣流程，讓每個好點子更快成為成果。' : 'Bring delivery, environments, and insights together. Spend less time on process and more time moving good ideas forward.')}</p>
            <div className="saas-hero-actions">
              <a className="saas-button saas-button-primary" href="#pricing">{c.hero?.btnBuild || (isZh ? '免費開始體驗' : 'Start your free trial')}<ArrowRight size={17} /></a>
              <a className="saas-button saas-button-secondary" href="#product-preview">{c.hero?.btnWatch || (isZh ? '看看產品如何運作' : 'See how it works')}<ArrowDown size={16} /></a>
            </div>
            <div className="saas-proof"><div className="saas-avatar-stack"><span>A</span><span>M</span><span>J</span><span>+</span></div><span>{isZh ? '深受 2,000+ 個高效團隊信賴' : 'Trusted by 2,000+ productive teams'}</span></div>
          </div>

          <div id="product-preview" className="saas-preview" aria-label={isZh ? 'NexusCore 產品介面預覽' : 'NexusCore product preview'}>
            <div className="saas-preview-glow" />
            <div className="saas-dashboard">
              <div className="saas-dashboard-top"><div className="saas-dots"><i /><i /><i /></div><span>NEXUSCORE <b>/ OVERVIEW</b></span><span className="saas-live"><i /> LIVE</span></div>
              <div className="saas-dashboard-body">
                <aside className="saas-dashboard-side"><span className="side-active"><BarChart3 size={17} /></span><span><Zap size={17} /></span><span><Shield size={17} /></span><span><Globe size={17} /></span></aside>
                <div className="saas-dashboard-content">
                  <div className="saas-dash-title"><div><small>{isZh ? '工作區總覽' : 'WORKSPACE OVERVIEW'}</small><h2>{isZh ? '早安，團隊 👋' : 'Good morning, team 👋'}</h2></div><span className="saas-date">{isZh ? '過去 30 天' : 'Last 30 days'} <ChevronDown size={13} /></span></div>
                  <div className="saas-metric-grid">
                    <div className="saas-metric"><span>{isZh ? '部署次數' : 'Deployments'}</span><strong>1,284</strong><small>↗ 18.6%</small><div className="saas-sparkline line-a" /></div>
                    <div className="saas-metric"><span>{isZh ? '成功率' : 'Success rate'}</span><strong>99.8%</strong><small>↗ 2.4%</small><div className="saas-sparkline line-b" /></div>
                  </div>
                  <div className="saas-chart"><div className="saas-chart-head"><div><small>{isZh ? '發布活動' : 'RELEASE ACTIVITY'}</small><strong>{isZh ? '穩定成長中' : 'Growing steadily'}</strong></div><span>+24.8%</span></div><div className="saas-chart-bars">{[36,53,42,65,48,72,57,82,64,90,70,100,75,88,63,96,78,110,84,98,74,120,92,108].map((height, i) => <i key={i} style={{ height: `${height}px` }} />)}</div><div className="saas-chart-axis"><span>01</span><span>07</span><span>14</span><span>21</span><span>30</span></div></div>
                  <div className="saas-deploy-row"><span className="saas-deploy-icon"><Check size={15} /></span><span><b>{isZh ? '正式環境部署成功' : 'Production deployed'}</b><small>{isZh ? '版本 v2.8.4 · 剛剛' : 'Version v2.8.4 · just now'}</small></span><span className="saas-deploy-status">{isZh ? '正常' : 'Healthy'}</span></div>
                </div>
              </div>
            </div>
            <div className="saas-float-card"><span className="saas-float-icon"><Zap size={17} /></span><span><small>{isZh ? '本月效率提升' : 'EFFICIENCY GAIN'}</small><strong>+48.2%</strong></span><span className="saas-float-up">↗</span></div>
          </div>
          <a className="saas-scroll-hint" href="#features">{isZh ? '向下探索' : 'SCROLL TO EXPLORE'}<span /></a>
        </section>

        <section id="features" className="saas-features section-shell">
          <div className="saas-section-heading"><span className="saas-section-kicker">{isZh ? '更順暢的工作方式' : 'A BETTER WAY TO BUILD'}</span><h2>{isZh ? '把複雜留給平台，' : 'Less complexity.'}<br /><span>{isZh ? '把時間留給成長。' : 'More momentum.'}</span></h2><p>{isZh ? '從日常部署到團隊擴展，重要工具都在一個清晰的工作空間裡。' : 'From everyday delivery to the next stage of growth, everything your team needs in one clear workspace.'}</p></div>
          <div className="saas-feature-grid">{features.map(({ icon: Icon, title, copy }, i) => <article className="saas-feature-card" key={title}><span className={`saas-feature-icon feature-${i}`}><Icon size={21} /></span><h3>{title}</h3><p>{copy}</p><a href="#pricing">{isZh ? '了解更多' : 'Learn more'}<ArrowRight size={15} /></a></article>)}</div>
        </section>

        <section id="updates" className="saas-updates section-shell">
          <div className="saas-inline-heading"><div><span className="saas-section-kicker"><Newspaper size={14} />{isZh ? '平台快訊' : 'THE LATEST'}</span><h2>{isZh ? '產品最新動態' : 'What’s new'}</h2></div><a href="#pricing">{isZh ? '探索所有功能' : 'Explore the platform'}<ArrowRight size={16} /></a></div>
          {news.length ? <div className="saas-news-grid">{news.slice(0, 3).map((item, i) => <article className="saas-news-card" key={item.id || i}><span>{item.date ? new Date(item.date).toLocaleDateString(isZh ? 'zh-TW' : 'en-US') : (isZh ? '最新消息' : 'LATEST UPDATE')}</span><h3>{item.title}</h3><p>{item.content}</p></article>)}</div> : <div className="saas-news-empty"><span className="saas-news-symbol"><Sparkles size={20} /></span><span>{isZh ? '新功能與平台消息即將在此更新。' : 'Product news and updates will show up here.'}</span></div>}
        </section>

        <section id="pricing" className="saas-pricing section-shell">
          <div className="saas-section-heading"><span className="saas-section-kicker">{isZh ? '簡單透明的價格' : 'SIMPLE, CLEAR PRICING'}</span><h2>{c.pricing?.title || (isZh ? '選擇適合你的方案' : 'Find your fit.')}</h2><p>{c.pricing?.subtitle || (isZh ? '從小型團隊到大型組織，找到合適的起點。' : 'The right starting point for teams of every size.')}</p></div>
          <div className="saas-plan-grid">{(c.pricing?.plans || []).map((plan, i) => <article className={`saas-plan-card${i === 1 ? ' is-popular' : ''}`} key={`${plan.name}-${i}`}>{i === 1 && <span className="saas-popular-label">{plan.popular || (isZh ? '最受歡迎' : 'MOST POPULAR')}</span>}<h3>{plan.name}</h3><p className="saas-plan-description">{isZh ? '適合想要穩定擴展的團隊' : 'For teams ready to grow with confidence'}</p><div className="saas-plan-price">{plan.price}<span> / {isZh ? '月' : 'mo'}</span></div><ul>{(plan.features || []).map((feature, j) => <li key={`${feature}-${j}`}><CheckCircle2 size={17} />{feature}</li>)}</ul><a className="saas-plan-button" href="mailto:sales@example.com">{plan.btn || (isZh ? '選擇此方案' : 'Choose plan')}<ArrowRight size={16} /></a></article>)}</div>
        </section>
      </main>

      <footer className="saas-footer"><a className="saas-brand" href="#top"><span className="saas-brand-mark"><Rocket size={18} /></span><span>Nexus<span>Core</span></span></a><span>© 2026 NexusCore. {isZh ? '為更好的工作而打造。' : 'Built for better work.'}</span><a href="#top">{isZh ? '回到頂端 ↑' : 'Back to top ↑'}</a></footer>
    </div>
  );
}

export default SaasDemo;
