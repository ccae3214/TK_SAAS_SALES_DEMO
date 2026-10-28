"use client";

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Users, MessageSquare, 
  TrendingUp, ArrowUpRight, DollarSign, Calendar,
  MoreVertical, Search, Bell, Settings, Filter, Download,
  Mail, Phone, Clock, Plus, Edit, Trash2, X, Package, Newspaper, Ticket, Star, ChevronDown, ChevronUp, Globe, LogOut
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useLanguage } from '@/context/LanguageContext';

const AdminDashboard = () => {
  const { t, lang, setLang } = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState([]);

  const fetchStats = () => {
    fetch('http://localhost:3001/api/admin/dashboard')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const toggleOrder = (id) => {
    setExpandedOrders(prev => prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]);
  };

  const updateOrderStatus = (id, status) => {
    fetch(`http://localhost:3001/api/orders/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }).then(() => fetchStats());
  };

  const deleteProduct = (id) => {
    if (!window.confirm(lang === 'en' ? t.admin.products.deleteConfirm : t.admin.products.deleteConfirm)) return;
    fetch(`http://localhost:3001/api/products/${id}`, { method: 'DELETE' }).then(() => fetchStats());
  };

  const deleteNews = (id) => {
    if (!window.confirm(t.admin.news.deleteConfirm)) return;
    fetch(`http://localhost:3001/api/news/${id}`, { method: 'DELETE' }).then(() => fetchStats());
  };

  const deleteCoupon = (id) => {
    if (!window.confirm(t.admin.coupons.deleteConfirm)) return;
    fetch(`http://localhost:3001/api/coupons/${id}`, { method: 'DELETE' }).then(() => fetchStats());
  };

  const deleteReview = (id) => {
    if (!window.confirm(t.admin.reviews.deleteConfirm)) return;
    fetch(`http://localhost:3001/api/reviews/${id}`, { method: 'DELETE' }).then(() => fetchStats());
  };

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div className="animate-pulse" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb' }}>Loading Admin Panel...</div>
    </div>
  );

  const sidebarItems = [
    { icon: <LayoutDashboard size={20} />, label: t.admin.sidebar.overview, key: 'Overview' },
    { icon: <ShoppingCart size={20} />, label: t.admin.sidebar.orders, key: 'Orders' },
    { icon: <Package size={20} />, label: t.admin.sidebar.products, key: 'Products' },
    { icon: <Ticket size={20} />, label: t.admin.sidebar.coupons, key: 'Coupons' },
    { icon: <Star size={20} />, label: t.admin.sidebar.reviews, key: 'Reviews' },
    { icon: <Newspaper size={20} />, label: t.admin.sidebar.news, key: 'News' },
    { icon: <Mail size={20} />, label: t.admin.sidebar.newsletter, key: 'Newsletter' },
    { icon: <Users size={20} />, label: t.admin.sidebar.customers, key: 'Customers' },
    { icon: <MessageSquare size={20} />, label: t.admin.sidebar.inquiries, key: 'Inquiries' },
    { icon: <TrendingUp size={20} />, label: t.admin.sidebar.analytics, key: 'Analytics' },
    { icon: <Settings size={20} />, label: t.admin.sidebar.settings, key: 'Settings' }
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: '280px', background: '#ffffff', borderRight: '1px solid #e2e8f0', padding: '32px 24px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.25rem', fontWeight: 900, marginBottom: '48px' }}>
           <div style={{ width: 32, height: 32, background: '#2563eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutDashboard size={18} color="white" />
           </div>
           Nexus<span style={{ color: '#2563eb' }}>Admin</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sidebarItems.map((item, i) => (
            <div 
              key={i} onClick={() => setActiveTab(item.key)}
              style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px',
              background: activeTab === item.key ? '#eff6ff' : 'transparent', color: activeTab === item.key ? '#2563eb' : '#64748b',
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
            }}>
              {item.icon} {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '40px 60px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '4px', letterSpacing: '-0.02em' }}>{activeTab}</h1>
            <p style={{ color: '#64748b' }}>Nexus Data Management Control Panel.</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'Overview' && (
            <Motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
                {[
                  { label: t.admin.overview.totalRevenue, val: `$${stats?.revenue?.toLocaleString() || 0}`, icon: <DollarSign size={24} />, color: '#22c55e', bg: '#f0fdf4' },
                  { label: t.admin.overview.orders, val: stats?.ordersCount || 0, icon: <ShoppingCart size={24} />, color: '#2563eb', bg: '#eff6ff' },
                  { label: t.admin.overview.users, val: stats?.usersCount || 0, icon: <Users size={24} />, color: '#a855f7', bg: '#f5f3ff' },
                  { label: t.admin.overview.subscribed, val: stats?.newsletterCount || 0, icon: <Mail size={24} />, color: '#f59e0b', bg: '#fffbeb' }
                ].map((stat, i) => (
                  <div key={i} style={{ padding: '24px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                      <div style={{ width: 48, height: 48, background: stat.bg, color: stat.color, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{stat.icon}</div>
                      <div style={{ color: '#22c55e', display: 'flex', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700 }}>+12% <ArrowUpRight size={14} /></div>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>{stat.label}</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stat.val}</div>
                  </div>
                ))}
              </div>
              <RecentOrdersTable 
                t={t}
                orders={(stats?.recentOrders || []).slice(0, 5)} 
                items={stats?.orderItems || []}
                expanded={expandedOrders}
                onToggle={toggleOrder}
                onStatusUpdate={updateOrderStatus} 
                title={t.admin.orders.recentTitle} 
              />
            </Motion.div>
          )}

          {activeTab === 'Orders' && (
             <RecentOrdersTable 
                t={t}
                orders={stats?.recentOrders || []} 
                items={stats?.orderItems || []}
                expanded={expandedOrders}
                onToggle={toggleOrder}
                onStatusUpdate={updateOrderStatus} 
                title={t.admin.orders.title} 
             />
          )}

          {activeTab === 'Newsletter' && (
             <Motion.div key="newsletter" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '24px' }}>
                   <h3 style={{ fontWeight: 800, marginBottom: '24px' }}>{t.admin.newsletter.title}</h3>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {stats.allNewsletter?.map((n, i) => (
                         <div key={i} style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 700 }}>{n.email}</div>
                            <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{new Date(n.date).toLocaleDateString()}</div>
                         </div>
                      ))}
                   </div>
                </div>
             </Motion.div>
          )}

          {/* ... Products, Coupons, Reviews, NewsTabs ... (Keep as before but wrap in appropriate activeTab conditions) */}
          {activeTab === 'Products' && (
             <Motion.div key="products" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                   <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontWeight: 800 }}>{t.admin.products.title} ({stats.allProducts?.length})</h3>
                      <button onClick={() => { setEditingProduct(null); setShowProductModal(true); }} style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <Plus size={18} /> {t.admin.products.addBtn}
                      </button>
                   </div>
                   <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                      {stats.allProducts?.map((product, i) => (
                         <div key={i} style={{ border: '1px solid #f1f5f9', borderRadius: '20px', padding: '16px' }}>
                            <img src={product.img} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '14px', marginBottom: '16px' }} alt="" />
                            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{product.name}</div>
                            <div style={{ fontWeight: 900, color: '#2563eb' }}>${product.price}</div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                               <button onClick={() => { setEditingProduct(product); setShowProductModal(true); }} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>Edit</button>
                               <button onClick={() => deleteProduct(product.id)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             </Motion.div>
          )}

          {activeTab === 'Coupons' && (
            <Motion.div key="coupons" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
               <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                  <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <h3 style={{ fontWeight: 800 }}>{t.admin.coupons.title}</h3>
                     <button onClick={() => setShowCouponModal(true)} style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+ {t.admin.coupons.createBtn}</button>
                  </div>
                  <div style={{ padding: '24px' }}>
                     <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                           <tr style={{ textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                              <th style={{ padding: '16px 0', color: '#94a3b8' }}>CODE</th>
                              <th style={{ padding: '16px 0', color: '#94a3b8' }}>DISCOUNT</th>
                              <th style={{ padding: '16px 0', color: '#94a3b8' }}>TYPE</th>
                              <th style={{ padding: '16px 0', color: '#94a3b8' }}>ACTIONS</th>
                           </tr>
                        </thead>
                        <tbody>
                           {stats.allCoupons?.map((c, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                 <td style={{ padding: '16px 0', fontWeight: 800 }}>{c.code}</td>
                                 <td style={{ padding: '16px 0' }}>{c.discount}{c.type === 'PERCENT' ? '%' : '$'}</td>
                                 <td style={{ padding: '16px 0' }}><span style={{ padding: '4px 10px', borderRadius: '10px', background: '#f1f5f9', fontSize: '0.75rem' }}>{c.type}</span></td>
                                 <td style={{ padding: '16px 0' }}>
                                    <button onClick={() => deleteCoupon(c.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </Motion.div>
          )}

          {activeTab === 'Reviews' && (
            <Motion.div key="reviews" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
               <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                  <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9' }}>
                     <h3 style={{ fontWeight: 800 }}>{t.admin.reviews.title}</h3>
                  </div>
                  <div style={{ padding: '24px' }}>
                     {stats.allReviews?.map((rev, i) => (
                        <div key={i} style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                           <div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                 <span style={{ fontWeight: 800 }}>{rev.userName}</span>
                                 <span style={{ color: '#64748b', fontSize: '0.8rem' }}>on {rev.productName}</span>
                                 <span style={{ color: '#eab308' }}>{'★'.repeat(rev.rating)}</span>
                              </div>
                              <div style={{ color: '#475569', marginTop: '4px' }}>{rev.comment}</div>
                           </div>
                           <button onClick={() => deleteReview(rev.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
                        </div>
                     ))}
                  </div>
               </div>
            </Motion.div>
          )}

          {activeTab === 'News' && (
             <Motion.div key="news" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                   <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontWeight: 800 }}>{t.admin.news.title}</h3>
                      <button onClick={() => setShowNewsModal(true)} style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+ {t.admin.news.publishBtn}</button>
                   </div>
                   <div style={{ padding: '24px' }}>
                      {stats.allNews?.map((news, i) => (
                         <div key={i} style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                               <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{news.title}</div>
                               <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{news.content}</div>
                               <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>{new Date(news.date).toLocaleString()}</div>
                            </div>
                            <button onClick={() => deleteNews(news.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444' }}><Trash2 size={18} /></button>
                         </div>
                      ))}
                   </div>
                </div>
             </Motion.div>
          )}

          {activeTab === 'Customers' && <CustomersTable t={t} users={stats?.allUsers || []} />}
          {activeTab === 'Inquiries' && <InquiriesList t={t} inquiries={stats?.recentInquiries || []} />}

          {activeTab === 'Analytics' && (
             <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '40px' }}>
                <h3 style={{ fontWeight: 800, marginBottom: '20px' }}>{t.admin.overview.analyticsTitle}</h3>
                <p style={{ color: '#64748b', marginBottom: '40px' }}>{t.admin.overview.analyticsDesc}</p>
                <div style={{ height: 400 }}>
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats?.chartData || []}>
                         <defs>
                           <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                             <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                           </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                         <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                         <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                         <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} />
                         <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" name="New Users" />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </div>
          )}

          {activeTab === 'Settings' && (
             <Motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                   <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '32px' }}>
                      <h3 style={{ fontWeight: 800, marginBottom: '24px' }}>{t.admin.settings.language}</h3>
                      <p style={{ color: '#64748b', marginBottom: '20px' }}>{t.admin.settings.languageDesc}</p>
                      <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                         <button 
                            onClick={() => setLang('zh')} 
                            style={{ 
                              padding: '12px 24px', borderRadius: '12px', border: lang === 'zh' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                              background: lang === 'zh' ? '#eff6ff' : '#fff', color: lang === 'zh' ? '#2563eb' : '#64748b',
                              fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                            <Globe size={18} /> {t.admin.settings.chinese}
                         </button>
                         <button 
                            onClick={() => setLang('en')} 
                            style={{ 
                              padding: '12px 24px', borderRadius: '12px', border: lang === 'en' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                              background: lang === 'en' ? '#eff6ff' : '#fff', color: lang === 'en' ? '#2563eb' : '#64748b',
                              fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                            <Globe size={18} /> {t.admin.settings.english}
                         </button>
                      </div>
                   </div>

                   <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                         <h3 style={{ fontWeight: 800, marginBottom: '24px' }}>{t.admin.settings.account}</h3>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                               <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '4px' }}>Role</div>
                               <div style={{ fontWeight: 700 }}>Administrator</div>
                            </div>
                            <div>
                               <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '4px' }}>Status</div>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%' }}></div>
                                  <span style={{ fontWeight: 700 }}>Active</span>
                               </div>
                            </div>
                         </div>
                      </div>
                      <button style={{ 
                         padding: '12px 24px', borderRadius: '12px', border: 'none', 
                         background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer',
                         display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', transition: 'all 0.2s'
                      }}>
                         <LogOut size={18} /> {t.admin.settings.logout}
                      </button>
                   </div>
                </div>
             </Motion.div>
          )}
        </AnimatePresence>
      </div>

      {showProductModal && <ProductModal t={t} product={editingProduct} onClose={() => setShowProductModal(false)} onSuccess={() => { setShowProductModal(false); fetchStats(); }} />}
      {showNewsModal && <NewsModal t={t} onClose={() => setShowNewsModal(false)} onSuccess={() => { setShowNewsModal(false); fetchStats(); }} />}
      {showCouponModal && <CouponModal t={t} onClose={() => setShowCouponModal(false)} onSuccess={() => { setShowCouponModal(false); fetchStats(); }} />}
    </div>
  );
};

const RecentOrdersTable = ({ t, orders, items, expanded, onToggle, onStatusUpdate, title }) => (
  <div style={{ padding: '32px', background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
     <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '24px' }}>{title}</h2>
     <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
            <th style={{ padding: '16px 0', fontSize: '0.85rem', color: '#94a3b8' }}>ORDER</th>
            <th style={{ padding: '16px 0', fontSize: '0.85rem', color: '#94a3b8' }}>EMAIL</th>
            <th style={{ padding: '16px 0', fontSize: '0.85rem', color: '#94a3b8' }}>TOTAL</th>
            <th style={{ padding: '16px 0', fontSize: '0.85rem', color: '#94a3b8' }}>STATUS</th>
            <th style={{ padding: '16px 0', fontSize: '0.85rem', color: '#94a3b8' }}>DETAILS</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, i) => (
             <React.Fragment key={i}>
                <tr style={{ borderBottom: expanded.includes(order.id) ? 'none' : '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px 0', fontWeight: 700 }}>#{order.id}</td>
                  <td style={{ padding: '16px 0', color: '#64748b' }}>{order.userEmail}</td>
                  <td style={{ padding: '16px 0', fontWeight: 800 }}>${order.total}</td>
                  <td style={{ padding: '16px 0' }}>
                      <select value={order.status} onChange={(e) => onStatusUpdate(order.id, e.target.value)} style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <option value="PAID">Paid</option><option value="SHIPPED">Shipped</option><option value="COMPLETED">Completed</option>
                      </select>
                  </td>
                  <td style={{ padding: '16px 0' }}>
                     <button onClick={() => onToggle(order.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#2563eb' }}>
                        {expanded.includes(order.id) ? <ChevronUp /> : <ChevronDown />}
                     </button>
                  </td>
                </tr>
                {expanded.includes(order.id) && (
                   <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                      <td colSpan="5" style={{ padding: '12px 24px' }}>
                         <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>Purchased Items:</div>
                         {(items || []).filter(item => item.order_id === order.id).map((item, j) => (
                            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #e2e8f0', fontSize: '0.85rem' }}>
                               <span>{item.name} x {item.quantity}</span>
                               <span>${item.price}</span>
                            </div>
                         ))}
                      </td>
                   </tr>
                )}
             </React.Fragment>
          ))}
        </tbody>
     </table>
  </div>
);

const ProductModal = ({ t, product, onClose, onSuccess }) => {
  const [formData, setFormData] = useState(product || { name: '', price: '', category: 'Men', tag: '', img: '' });
  const handleSubmit = (e) => {
    e.preventDefault();
    const method = product ? 'PUT' : 'POST';
    const url = product ? `http://localhost:3001/api/products/${product.id}` : 'http://localhost:3001/api/products';
    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }).then(() => onSuccess());
  };
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
       <div style={{ background: '#fff', width: '500px', borderRadius: '24px', padding: '32px' }}>
          <h3 style={{ fontWeight: 800 }}>{product ? t.admin.products.modalEdit : t.admin.products.modalAdd}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
             <input placeholder={t.admin.products.name} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
             <input placeholder={t.admin.products.price} type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
             <input placeholder={t.admin.products.image} value={formData.img} onChange={e => setFormData({...formData, img: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
             <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 800 }}>{t.admin.products.confirm}</button>
             <button onClick={onClose} style={{ background: 'transparent', color: '#64748b', border: 'none' }}>{t.admin.products.cancel}</button>
          </form>
       </div>
    </div>
  );
};

const NewsModal = ({ t, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ title: '', content: '' });
  const handleSubmit = (e) => {
    e.preventDefault();
    fetch('http://localhost:3001/api/news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }).then(() => onSuccess());
  };
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
       <div style={{ background: '#fff', width: '500px', borderRadius: '24px', padding: '32px' }}>
          <h3 style={{ fontWeight: 800 }}>{t.admin.news.title}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
             <input placeholder={t.admin.news.title} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
             <textarea placeholder={t.admin.news.title} rows="4" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
             <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 800 }}>{t.admin.news.publishBtn}</button>
             <button onClick={onClose} style={{ background: 'transparent', color: '#64748b', border: 'none' }}>{t.admin.products.cancel}</button>
          </form>
       </div>
    </div>
  );
};

const CouponModal = ({ t, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ code: '', discount: '', type: 'PERCENT' });
  const handleSubmit = (e) => {
    e.preventDefault();
    fetch('http://localhost:3001/api/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }).then(() => onSuccess());
  };
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
       <div style={{ background: '#fff', width: '500px', borderRadius: '24px', padding: '32px' }}>
          <h3 style={{ fontWeight: 800 }}>{t.admin.coupons.title}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
             <input placeholder="Coupon Code (e.g. SALE50)" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
             <input placeholder="Discount Value" type="number" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
             <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <option value="PERCENT">PERCENT (%)</option>
                <option value="FIXED">FIXED ($)</option>
             </select>
             <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 800 }}>Create</button>
             <button onClick={onClose} style={{ background: 'transparent', color: '#64748b', border: 'none' }}>Cancel</button>
          </form>
       </div>
    </div>
  );
};

const CustomersTable = ({ t, users }) => (
   <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '24px' }}>
      <h3 style={{ fontWeight: 800, marginBottom: '20px' }}>{t.admin.customers.title}</h3>
      {users?.slice(0, 10).map((user, i) => (
         <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
            <div><div style={{ fontWeight: 700 }}>{user.name}</div><div style={{ fontSize: '0.8rem', color: '#64748b' }}>{user.email}</div></div>
            <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700 }}>${user.spending?.toFixed(0) || 0} / {user.points || 0} pts</div>
         </div>
      ))}
   </div>
);

const InquiriesList = ({ t, inquiries }) => (
   <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '24px' }}>
      <h3 style={{ fontWeight: 800, marginBottom: '20px' }}>{t.admin.inquiries.title}</h3>
      {inquiries.map((inq, i) => (
         <div key={i} style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontWeight: 700 }}>{inq.name} ({inq.type})</div>
            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{inq.message}</div>
         </div>
      ))}
   </div>
);

export default AdminDashboard;
