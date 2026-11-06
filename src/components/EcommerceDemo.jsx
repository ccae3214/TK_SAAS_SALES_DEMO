"use client";
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, User, Star, ArrowRight, ChevronRight, X, Plus, Minus, Trash2, CheckCircle, Package, Heart, Settings, LogOut, Shield, Lock, Ticket, Clock } from 'lucide-react';
import { DemoOverlay } from '@/components/DemoOverlay';
import { PageHeader } from '@/components/PageHeader';
import { OrderSuccess } from '@/components/OrderSuccess';
import { CheckoutPage } from '@/components/CheckoutPage';
import { useLanguage } from '@/context/LanguageContext';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// --- Premium Fake Product Data (fallback if API fails) ---
const PRODUCTS = [
  { id: 1, name: "Essential Oversized Hoodie", price: 89, category: "Men", tag: "NEW", img: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800&auto=format&fit=crop" },
  { id: 2, name: "Urban Tech Cargo Pants", price: 129, category: "Men", tag: "TRENDING", img: "https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?q=80&w=800&auto=format&fit=crop" },
  { id: 3, name: "Minimalist Puffer Jacket", price: 249, category: "Women", tag: "BEST SELLER", img: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800&auto=format&fit=crop" },
  { id: 4, name: "Signature Canvas Sneakers", price: 149, category: "Accessories", tag: "", img: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?q=80&w=800&auto=format&fit=crop" },
  { id: 5, name: "Monochrome Ribbed Knit", price: 79, category: "Women", tag: "NEW", img: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=800&auto=format&fit=crop" },
  { id: 6, name: "Tactical Crossbody Bag", price: 59, category: "Accessories", tag: "", img: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=800&auto=format&fit=crop" },
  { id: 7, name: "Seamless Active Top", price: 45, category: "Women", tag: "", img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop" },
  { id: 8, name: "Heavyweight Boxy Tee", price: 55, category: "Men", tag: "LIMITED", img: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?q=80&w=800&auto=format&fit=crop" },
  { id: 9, name: "Vintage Denim Jacket", price: 110, category: "Men", tag: "RETRO", img: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=800&auto=format&fit=crop" },
  { id: 10, name: "Silk Wrap Dress", price: 180, category: "Women", tag: "PREMIUM", img: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=800&auto=format&fit=crop" },
  { id: 11, name: "Leather Chelsea Boots", price: 165, category: "Men", tag: "ELEGANT", img: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=800&auto=format&fit=crop" },
  { id: 12, name: "Gold Chain Necklace", price: 45, category: "Accessories", tag: "HOT", img: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?q=80&w=800&auto=format&fit=crop" },
  { id: 13, name: "Cashmere Scarf", price: 95, category: "Accessories", tag: "WINTER", img: "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?q=80&w=800&auto=format&fit=crop" },
  { id: 14, name: "Linen Summer Shirt", price: 65, category: "Men", tag: "COOL", img: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=800&auto=format&fit=crop" },
  { id: 15, name: "Pleated Midi Skirt", price: 75, category: "Women", tag: "TRENDING", img: "https://images.unsplash.com/photo-1577900232427-18219b9166a0?q=80&w=800&auto=format&fit=crop" },
  { id: 16, name: "Wool Overcoat", price: 299, category: "Men", tag: "CLASSIC", img: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop" },
  { id: 17, name: "Satin Evening Gown", price: 350, category: "Women", tag: "LUXURY", img: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?q=80&w=800&auto=format&fit=crop" },
  { id: 18, name: "Polarized Sunglasses", price: 120, category: "Accessories", tag: "", img: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=800&auto=format&fit=crop" }
];

const CATEGORIES = ["All", "Men", "Women", "Accessories"];

const TIERS = [
  { name: 'Regular', min: 0, discount: 0, color: '#94a3b8' },
  { name: 'Silver', min: 200, discount: 0.05, color: '#64748b' },
  { name: 'Gold', min: 1000, discount: 0.10, color: '#eab308' },
  { name: 'Platinum', min: 5000, discount: 0.15, color: '#2563eb' }
];

const getNextTier = (spending) => {
  return TIERS.find(t => spending < t.min);
};

function EcommerceDemo() {
  const { t, lang } = useLanguage(); 
  const router = useRouter();
  
  // States
  const [activeCategory, setActiveCategory] = useState("All");
  const { userProfile, setUserProfile, logout } = useAuth();
  const [cart, setCart] = useState([]);
  const [cartLoadedOnce, setCartLoadedOnce] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const isFirstCartRender = React.useRef(true);

  // Fetch CSRF token at mount
  useEffect(() => {
    fetch('/api/csrf')
      .then(res => res.json())
      .then(data => {
        if (data?.csrfToken) setCsrfToken(data.csrfToken);
      })
      .catch(err => console.error('Failed to fetch CSRF token:', err));
  }, []);

  // Load from local storage on mount (Client-only)
  useEffect(() => {
    const saved = localStorage.getItem('tk_cart');
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to parse localStorage cart:', err);
        setCart([]);
      }
    }
    
    // Listen for localStorage changes from other tabs/windows
    const handleStorageChange = (e) => {
      if (e.key === 'tk_cart') {
        if (e.newValue) {
          try {
            setCart(JSON.parse(e.newValue));
          } catch (err) {
            console.error('Failed to parse cart from storage:', err);
          }
        } else {
          // Cart was cleared in another tab (removeItem)
          setCart([]);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Load cart from database ONCE when user profile changes (not every time)
  useEffect(() => {
    if (userProfile?.email && !cartLoadedOnce) {
      fetch(`/api/cart?email=${encodeURIComponent(userProfile.email)}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setCart(data);
            localStorage.setItem('tk_cart', JSON.stringify(data));
          }
          setCartLoadedOnce(true);
        })
        .catch(err => {
          console.error('Failed to load cart from DB:', err);
          setCartLoadedOnce(true);
        });
    }
  }, [userProfile?.email, cartLoadedOnce]);

  useEffect(() => {
    if (isFirstCartRender.current) {
        if (cart.length > 0) isFirstCartRender.current = false;
        return;
    }
    // Always save to localStorage
    localStorage.setItem('tk_cart', JSON.stringify(cart));
    
    // Also sync to database if user is logged in
    if (userProfile?.email) {
      fetch('/api/cart', {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ email: userProfile.email, cart })
      }).catch(err => console.error('Failed to sync cart to DB:', err));
    }
  }, [cart, userProfile?.email]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastNotification, setToastNotification] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState("M");
  const [completedOrder, setCompletedOrder] = useState(null);

  const [isUserOpen, setIsUserOpen] = useState(false);
  const [products, setProducts] = useState(PRODUCTS);
  const [regForm, setRegForm] = useState({ name: '', email: '', password: '' });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [wishlist, setWishlist] = useState([]);
  const [checkoutForm, setCheckoutForm] = useState({ address: '', card: '' });
  const [authMode, setAuthMode] = useState('register');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [userOrders, setUserOrders] = useState([]);
  const [activeReviews, setActiveReviews] = useState([]);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) setProducts(data);
      })
      .catch(err => console.log('Products fetch error', err));
  }, []);

  const fetchReviews = (id) => {
    fetch(`/api/reviews/${id}`)
      .then(res => res.json())
      .then(data => setActiveReviews(data || []));
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!userProfile) return;
    const body = { 
      productId: selectedProduct.id, 
      userName: userProfile.name, 
      rating: newReview.rating, 
      comment: newReview.comment 
    };
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    setNewReview({ rating: 5, comment: '' });
    fetchReviews(selectedProduct.id);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm)
      });
      const data = await res.json();
      if (data.success) {
        setUserProfile(data.user);
        setIsUserOpen(false);
        setToast(t.ecommerce?.welcomeMessage || 'Welcome! Account created 🎉');
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast(data.error || 'Registration failed');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
       console.error('Registration failed:', err);
       setToast('Network Error');
       setTimeout(() => setToast(null), 3000);
    }
  };

  // Fetch orders whenever user email changes
  useEffect(() => {
    if (!userProfile?.email) {
      console.log("[Orders] No user profile email, clearing orders");
      setUserOrders([]);
      return;
    }

    const fetchOrders = async () => {
      try {
        const email = userProfile.email;
        const url = `/api/orders/user/${encodeURIComponent(email)}`;
        console.log("[Orders] Fetching from URL:", url);
        
        const res = await fetch(url);
        console.log("[Orders] Response status:", res.status, "statusText:", res.statusText);
        
        if (!res.ok) {
          console.error("[Orders] HTTP error:", res.status, res.statusText);
          const body = await res.text();
          console.error("[Orders] Error body:", body.substring(0, 100));
          setUserOrders([]);
          return;
        }
        
        const contentType = res.headers.get('content-type') || '';
        console.log("[Orders] Content-Type:", contentType);
        
        if (!contentType.includes('application/json')) {
          console.error("[Orders] Not JSON content-type");
          setUserOrders([]);
          return;
        }
        
        let data;
        try {
          data = await res.json();
        } catch (parseErr) {
          console.error("[Orders] JSON parse failed:", parseErr.message);
          setUserOrders([]);
          return;
        }
        
        console.log("[Orders] Received data:", JSON.stringify(data).substring(0, 200));
        
        if (!data) {
          console.log("[Orders] Data is falsy, setting empty");
          setUserOrders([]);
          return;
        }
        
        if (Array.isArray(data)) {
          console.log("[Orders] Data is array, length:", data.length);
          setUserOrders(data);
          return;
        }
        
        console.warn("[Orders] Data is not array, type:", typeof data);
        setUserOrders([]);
      } catch (err) {
        console.error("[Orders] Fetch exception:", err.message);
        setUserOrders([]);
      }
    };

    fetchOrders();
  }, [userProfile?.email]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (data.success) {
        setUserProfile(data.user);
        setIsUserOpen(false);
        setToast(`${t.ecommerce?.welcomeBack || 'Welcome back'}, ${data.user.name}!`);
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast(data.error || 'Login failed');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error('Login error:', err);
      setToast('Network Error');
      setTimeout(() => setToast(null), 3000);
    }
  };

  const verifyCoupon = async () => {
    if (!couponCode) return;
    try {
      const res = await fetch('/api/coupons/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode })
      });
      const data = await res.json();
      if (res.ok) {
        setAppliedCoupon(data);
        setCouponError('');
        setToast((t.ecommerce?.couponApplied || 'Coupon {code} applied').replace('{code}', data.code));
        setTimeout(() => setToast(null), 3000);
      } else {
        setCouponError(data.error);
        setAppliedCoupon(null);
      }
    } catch (err) { 
      console.error('Coupon verification error:', err);
      setCouponError('Error verifying coupon'); 
    }
  };

  useEffect(() => {
    if (userProfile?.email) {
      fetch(`/api/wishlist/${userProfile.email}`)
        .then(res => res.json())
        .then(data => setWishlist(data || []))
        .catch(() => {});
      
      fetch(`/api/cart/${userProfile.email}`)
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) setCart(data);
        })
        .catch(() => {});
    } else {
      Promise.resolve().then(() => {
        setWishlist(prev => prev.length > 0 ? [] : prev);
      });
    }
  }, [userProfile?.email]);

  const userTier = userProfile ? (TIERS.slice().reverse().find(t => (userProfile.spending || 0) >= t.min) || TIERS[0]) : TIERS[0];
  const nextTier = getNextTier(userProfile?.spending || 0);
  
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tierDiscountAmount = cartTotal * userTier.discount;
  const couponDiscountAmount = appliedCoupon 
    ? (appliedCoupon.type === 'PERCENT' ? ((cartTotal - tierDiscountAmount) * appliedCoupon.discount / 100) : appliedCoupon.discount)
    : 0;
  
  const finalTotal = Math.max(0, cartTotal - tierDiscountAmount - couponDiscountAmount);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product, size = null) => {
    const productId = size ? `${product.id}-${size}` : product.id;
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing) return prev.map(item => item.id === productId ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, id: productId, originalId: product.id, size, quantity: 1 }];
    });
    // Show notification with product details
    setToastNotification({
      name: product.name,
      size: size || 'Default',
      image: product.img,
      price: product.price
    });
    setTimeout(() => setToastNotification(null), 3000);
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const toggleWishlist = (productId) => {
    if (!userProfile) {
      setToast('Please sign in to save favorites');
      setTimeout(() => setToast(null), 2500);
      setIsUserOpen(true);
      return;
    }

    setWishlist((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const processOrder = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          total: finalTotal,
          email: userProfile?.email,
          items: cart.map(item => ({ 
            id: item.originalId || item.id, 
            name: item.name,
            size: item.size || 'M',
            quantity: item.quantity, 
            price: item.price 
          })),
          address: checkoutForm.address,
          couponCode: appliedCoupon?.code || null,
        })
      });
      const data = await res.json();
      if (data.success) {
        // Calculate total discounts for display
        const totalDiscount = (cartTotal * userTier.discount) + couponDiscountAmount;
        
        setCompletedOrder({ 
          items: cart.map(item => ({
            ...item,
            image: item.img || 'https://via.placeholder.com/60'
          })), 
          total: finalTotal,
          subtotal: cartTotal,
          discount_amount: totalDiscount,
          id: data.orderId, 
          address: checkoutForm.address,
          created_at: new Date().toISOString()
        });
        setCart([]);
        setShowCheckoutPage(false);
        setIsCartOpen(false);
        setSelectedProduct(null);
        setAppliedCoupon(null);
        setCouponCode('');
        setCheckoutForm({ address: '', card: '' });
        
        // Show success notification
        setToast(t.ecommerce?.orderSuccess || '✅ Order successful! Thank you for your purchase');
        setTimeout(() => setToast(null), 3000);
        
        if (userProfile) {
           const earned = Math.floor(finalTotal / 10);
           setUserProfile(prev => ({ 
             ...prev, 
             points: (prev.points || 0) + earned, 
             spending: (prev.spending || 0) + finalTotal 
           }));
        }
        window.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        setToast((t.ecommerce?.orderFailed || 'Order failed: {message}').replace('{message}', data.message));
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
       console.error("Order error", err);
       setToast(t.ecommerce?.orderError || 'Error processing order');
       setTimeout(() => setToast(null), 4000);
       window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  useEffect(() => {
    if (selectedProduct) fetchReviews(selectedProduct.id);
  }, [selectedProduct]);

  const searchedProducts = products.filter((product) => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return true;
    return (
      product.name?.toLowerCase().includes(keyword) ||
      product.category?.toLowerCase().includes(keyword) ||
      product.tag?.toLowerCase().includes(keyword)
    );
  });

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', color: '#0f172a', fontFamily: "'Inter', sans-serif" }}>
      <DemoOverlay title={t.themes ? t.themes[1].title : 'Ecommerce'} />
      <PageHeader />
      
      {/* Promo Marquee */}
      <div style={{ background: '#0f172a', color: '#ffffff', padding: '10px 0', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 600 }}>
        <Motion.div animate={{ x: [0, -1000] }} transition={{ repeat: Infinity, duration: 25, ease: "linear" }} style={{ display: 'inline-block', paddingLeft: '100%' }}>
          {lang === 'zh' 
            ? t.ecommerce?.promotionBanner || '🔥 2026 Spring Collection! Use discount code "WELCOME2026" for 20% off 🎁 Register for points rewards 🚀 Fastest 24-hour delivery nationwide'
            : '🔥 SPRING 2026! USE CODE "WELCOME2026" FOR 20% OFF 🎁 REGISTER FOR POINTS REWARDS 🚀 FAST GLOBAL DELIVERY'}
        </Motion.div>
      </div>

      <AnimatePresence>
        {toast && (
          <Motion.div initial={{ opacity: 0, y: -50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }}
            style={{ position: 'fixed', top: '80px', left: '50%', zIndex: 9999, background: '#22c55e', color: '#fff', padding: '12px 24px', borderRadius: '30px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} /> {toast}
          </Motion.div>
        )}

        {toastNotification && (
          <Motion.div 
            initial={{ opacity: 0, x: 400 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 400 }}
            style={{
              position: 'fixed',
              bottom: '30px',
              right: '30px',
              zIndex: 9998,
              background: '#fff',
              borderRadius: '16px',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.15)',
              border: '1px solid #e2e8f0',
              padding: '16px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              maxWidth: '320px'
            }}
          >
            {/* Product Image */}
            <div style={{
              flexShrink: 0,
              width: '60px',
              height: '60px',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              <img 
                src={toastNotification.image} 
                alt={toastNotification.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <CheckCircle size={16} color="#22c55e" />,
                <span style={{
                  fontSize: '13px',
                  color: '#22c55e',
                  fontWeight: '600'
                }}>
                  {t.ecommerce?.addedToCart || 'Added to cart'}
                </span>
              </div>
              <p style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#0f172a',
                margin: '0 0 4px 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {toastNotification.name}
              </p>
              <p style={{
                fontSize: '12px',
                color: '#64748b',
                margin: '0'
              }}>
                {t.ecommerce?.size || 'Size'}: {toastNotification.size} • ${toastNotification.price}
              </p>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '24px 48px', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>VOGUE<span style={{color: '#a855f7'}}>.</span></div>
        <nav style={{ display: 'flex', gap: '32px', fontWeight: 600, fontSize: '0.9rem' }}>
          {CATEGORIES.map(cat => <span key={cat} onClick={() => setActiveCategory(cat)} style={{ cursor: 'pointer', color: activeCategory === cat ? '#a855f7' : '#0f172a' }}>{t.ecommerce?.categories ? t.ecommerce.categories[cat.toLowerCase()] || cat : cat}</span>)}
        </nav>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <Search onClick={() => setIsSearchOpen(!isSearchOpen)} size={20} style={{ cursor: 'pointer' }} />
          <User onClick={() => setIsUserOpen(true)} size={20} style={{ cursor: 'pointer' }} />
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setIsCartOpen(true)}>
            <ShoppingCart size={20} />
            {cartItemCount > 0 && <span style={{ position: 'absolute', top: -8, right: -8, background: '#a855f7', color: '#fff', fontSize: '0.7rem', width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartItemCount}</span>}
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ padding: '60px 48px', minHeight: 'calc(100vh - 100px)' }}>
        {completedOrder ? (
          <OrderSuccess 
            order={completedOrder} 
            userProfile={userProfile}
            onContinue={() => setCompletedOrder(null)}
          />
        ) : (
          <Motion.div 
            layout
            initial="hidden" animate="visible" variants={{
              visible: { transition: { staggerChildren: 0.1 } }
            }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '32px' }}>
            {products.filter(p => activeCategory === "All" || p.category === activeCategory).map(p => (
              <Motion.div 
                key={p.id} 
                layout
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
                whileHover={{ y: -10, transition: { duration: 0.3 } }}
                style={{ cursor: 'pointer', background: '#fff', padding: '16px', borderRadius: '24px', transition: 'box-shadow 0.3s' }} 
                onMouseOver={e => e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.04)'}
                onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
                onClick={() => setSelectedProduct(p)}
              >
                <div style={{ height: '380px', borderRadius: '20px', overflow: 'hidden', background: '#f1f5f9', position: 'relative' }}>
                  <img src={p.img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                </div>
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{p.name}</h3>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>{p.category}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#a855f7', fontSize: '1.1rem' }}>${p.price}</div>
                </div>
              </Motion.div>
            ))}
          </Motion.div>
        )}
      </main>

      <AnimatePresence>
        {isUserOpen && (
          <>
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUserOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.45)',
                zIndex: 120,
              }}
            />
            <Motion.aside
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: 'min(440px, 100vw)',
                height: '100vh',
                background: '#ffffff',
                zIndex: 121,
                boxShadow: '-24px 0 60px rgba(15, 23, 42, 0.18)',
                padding: '32px 24px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Member Center</div>
                  <h2 style={{ margin: '6px 0 0', fontSize: '1.6rem', fontWeight: 900 }}>
                    {userProfile ? 'My Account' : authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                  </h2>
                </div>
                <button
                  onClick={() => setIsUserOpen(false)}
                  style={{ border: 'none', background: '#f8fafc', borderRadius: '999px', width: 40, height: 40, cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {!userProfile ? (
                <>
                  <div style={{ display: 'flex', gap: '10px', background: '#f8fafc', padding: '6px', borderRadius: '16px' }}>
                    <button
                      onClick={() => setAuthMode('login')}
                      style={{
                        flex: 1,
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: authMode === 'login' ? '#0f172a' : 'transparent',
                        color: authMode === 'login' ? '#fff' : '#475569',
                      }}
                    >
                      Login
                    </button>
                    <button
                      onClick={() => setAuthMode('register')}
                      style={{
                        flex: 1,
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: authMode === 'register' ? '#0f172a' : 'transparent',
                        color: authMode === 'register' ? '#fff' : '#475569',
                      }}
                    >
                      Register
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => signIn('google')}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      background: '#fff',
                      color: '#0f172a',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginBottom: '12px',
                      width: '100%'
                    }}
                  >
                    Sign in with Google
                  </button>

                  {authMode === 'login' ? (
                    <>
                      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <input
                          type="email"
                          placeholder="Email"
                          value={loginForm.email}
                          onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                          style={{ padding: '14px 16px', borderRadius: '14px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                        />
                        <input
                          type="password"
                          placeholder="Password"
                          value={loginForm.password}
                          onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                          style={{ padding: '14px 16px', borderRadius: '14px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                        />
                        <button
                          type="submit"
                          style={{ border: 'none', borderRadius: '14px', padding: '14px 16px', background: '#0f172a', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                        >
                          Sign In
                        </button>
                      </form>
                    </>
                  ) : (
                    <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={regForm.name}
                        onChange={(e) => setRegForm((prev) => ({ ...prev, name: e.target.value }))}
                        style={{ padding: '14px 16px', borderRadius: '14px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={regForm.email}
                        onChange={(e) => setRegForm((prev) => ({ ...prev, email: e.target.value }))}
                        style={{ padding: '14px 16px', borderRadius: '14px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={regForm.password}
                        onChange={(e) => setRegForm((prev) => ({ ...prev, password: e.target.value }))}
                        style={{ padding: '14px 16px', borderRadius: '14px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                      />
                      <button
                        type="submit"
                        style={{ border: 'none', borderRadius: '14px', padding: '14px 16px', background: '#0f172a', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                      >
                        Create Account
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <>
                  <div style={{ padding: '24px', borderRadius: '24px', background: 'linear-gradient(135deg, #0f172a, #7c3aed)', color: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Signed in as</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{userProfile.name}</div>
                      </div>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Shield size={24} />
                      </div>
                    </div>
                    <div style={{ fontSize: '0.95rem', opacity: 0.9 }}>{userProfile.email}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '16px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>Tier</div>
                      <div style={{ marginTop: '8px', fontSize: '1.05rem', fontWeight: 900, color: userTier.color }}>{userTier.name}</div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '16px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>Points</div>
                      <div style={{ marginTop: '8px', fontSize: '1.05rem', fontWeight: 900 }}>{userProfile.points || 0}</div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '16px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>Wishlist</div>
                      <div style={{ marginTop: '8px', fontSize: '1.05rem', fontWeight: 900 }}>{wishlist.length}</div>
                    </div>
                  </div>

                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '20px', padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <Ticket size={18} color="#ea580c" />
                      <span style={{ fontWeight: 800 }}>Rewards Progress</span>
                    </div>
                    <div style={{ color: '#7c2d12', fontSize: '0.92rem' }}>
                      Total spending: ${Number(userProfile.spending || 0).toFixed(0)}
                    </div>
                    <div style={{ color: '#9a3412', fontSize: '0.88rem', marginTop: '6px' }}>
                      {nextTier ? `Spend $${Math.max(0, nextTier.min - (userProfile.spending || 0)).toFixed(0)} more to reach ${nextTier.name}.` : 'You are at the highest member tier.'}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                      <Package size={18} />
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900 }}>Recent Orders</h3>
                    </div>
                    {userOrders.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {userOrders.slice(0, 5).map((order) => (
                          <div key={order.id} style={{ border: '1px solid #e2e8f0', borderRadius: '18px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                              <div>
                                <div style={{ fontWeight: 800 }}>Order #{order.id}</div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                                  {order.created_at ? new Date(order.created_at).toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US') : 'Recent order'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 900 }}>${Number(order.total).toFixed(2)}</div>
                                <div style={{ fontSize: '0.82rem', color: '#7c3aed', fontWeight: 700 }}>PAID</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ border: '1px dashed #cbd5e1', borderRadius: '18px', padding: '20px', color: '#64748b' }}>
                        No recent orders yet.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      logout();
                      setIsUserOpen(false);
                      setToast(t.ecommerce?.loggedOut || '👋 You have been logged out');
                      setTimeout(() => setToast(null), 3000);
                    }}
                    style={{
                      marginTop: 'auto',
                      border: '1px solid #fecaca',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      background: '#fff1f2',
                      color: '#b91c1c',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                    }}
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </>
              )}
            </Motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSearchOpen && (
          <>
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 110 }}
            />
            <Motion.div
              initial={{ opacity: 0, y: 20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 20, x: '-50%' }}
              style={{
                position: 'fixed',
                top: '10vh',
                left: '50%',
                width: 'min(760px, calc(100vw - 32px))',
                background: '#fff',
                borderRadius: '28px',
                zIndex: 111,
                boxShadow: '0 30px 80px rgba(15, 23, 42, 0.22)',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                <Search size={20} />
                <input
                  autoFocus
                  placeholder="Search products, categories, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1rem' }}
                />
                <button onClick={() => setIsSearchOpen(false)} style={{ border: 'none', background: '#f8fafc', borderRadius: '999px', width: 40, height: 40, cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'grid', gap: '12px' }}>
                {searchedProducts.slice(0, 8).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setIsSearchOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      textAlign: 'left',
                      border: '1px solid #e2e8f0',
                      borderRadius: '18px',
                      background: '#fff',
                      padding: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <img src={product.img} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '14px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800 }}>{product.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>{product.category} {product.tag ? `• ${product.tag}` : ''}</div>
                    </div>
                    <div style={{ fontWeight: 900, color: '#a855f7' }}>${product.price}</div>
                  </button>
                ))}
                {searchedProducts.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No matching products found.</div>
                )}
              </div>
            </Motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProduct && (
          <>
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedProduct(null);
              }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 112 }}
            />
            <Motion.div
              initial={{ opacity: 0, y: 24, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 24, x: '-50%' }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: '6vh',
                left: '50%',
                width: 'min(980px, calc(100vw - 32px))',
                maxHeight: '88vh',
                overflowY: 'auto',
                background: '#fff',
                borderRadius: '30px',
                zIndex: 113,
                boxShadow: '0 30px 90px rgba(15, 23, 42, 0.24)',
                padding: '24px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1fr)', gap: '24px' }}>
                <div>
                  <div style={{ height: '460px', borderRadius: '24px', overflow: 'hidden', background: '#f8fafc' }}>
                    <img src={selectedProduct.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>{selectedProduct.category}</div>
                      <h2 style={{ margin: '8px 0 0', fontSize: '2rem', fontWeight: 900 }}>{selectedProduct.name}</h2>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} style={{ border: 'none', background: '#f8fafc', borderRadius: '999px', width: 40, height: 40, cursor: 'pointer' }}>
                      <X size={18} />
                    </button>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#a855f7' }}>${selectedProduct.price}</div>
                  <p style={{ margin: 0, color: '#475569', lineHeight: 1.7 }}>
                    Premium materials, elevated fit, and a polished finish designed for everyday wear. Built for the demo storefront experience with quick checkout and member rewards.
                  </p>

                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '10px' }}>Select Size</div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {['S', 'M', 'L', 'XL'].map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: '14px',
                            border: selectedSize === size ? '2px solid #0f172a' : '1px solid #cbd5e1',
                            background: selectedSize === size ? '#0f172a' : '#fff',
                            color: selectedSize === size ? '#fff' : '#0f172a',
                            cursor: 'pointer',
                            fontWeight: 800,
                          }}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => {
                        addToCart(selectedProduct, selectedSize);
                      }}
                      style={{ flex: 1, border: 'none', borderRadius: '16px', padding: '16px 18px', background: '#0f172a', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Add to Cart
                    </button>
                    <button
                      onClick={() => toggleWishlist(selectedProduct.id)}
                      style={{
                        width: 56,
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        background: wishlist.includes(selectedProduct.id) ? '#fdf2f8' : '#fff',
                        color: wishlist.includes(selectedProduct.id) ? '#db2777' : '#0f172a',
                        cursor: 'pointer',
                      }}
                    >
                      <Heart size={18} fill={wishlist.includes(selectedProduct.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div style={{ background: '#f8fafc', borderRadius: '20px', padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <Star size={18} color="#eab308" />
                      <div style={{ fontWeight: 900 }}>Customer Reviews</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', maxHeight: '180px', overflowY: 'auto' }}>
                      {activeReviews.length > 0 ? activeReviews.map((review, index) => (
                        <div key={index} style={{ background: '#fff', borderRadius: '16px', padding: '14px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                            <strong>{review.userName}</strong>
                            <span style={{ color: '#eab308' }}>{'★'.repeat(review.rating || 0)}</span>
                          </div>
                          <div style={{ color: '#475569', marginTop: '6px', fontSize: '0.92rem' }}>{review.comment}</div>
                        </div>
                      )) : (
                        <div style={{ color: '#64748b' }}>No reviews yet. Be the first to leave one.</div>
                      )}
                    </div>

                    {userProfile ? (
                      <form onSubmit={submitReview} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <select
                          value={newReview.rating}
                          onChange={(e) => setNewReview((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                          style={{ padding: '12px 14px', borderRadius: '14px', border: '1px solid #cbd5e1' }}
                        >
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <option key={rating} value={rating}>{rating} Star</option>
                          ))}
                        </select>
                        <textarea
                          rows="3"
                          placeholder="Share your thoughts about this item"
                          value={newReview.comment}
                          onChange={(e) => setNewReview((prev) => ({ ...prev, comment: e.target.value }))}
                          style={{ padding: '12px 14px', borderRadius: '14px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                        />
                        <button type="submit" style={{ alignSelf: 'flex-start', border: 'none', borderRadius: '14px', padding: '12px 16px', background: '#a855f7', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                          Submit Review
                        </button>
                      </form>
                    ) : (
                      <div style={{ color: '#64748b' }}>Sign in to write a review.</div>
                    )}
                  </div>
                </div>
              </div>
            </Motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCartOpen && (
          <>
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                setIsCartOpen(false);
              }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 114 }}
            />
            <Motion.aside
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: 'min(460px, 100vw)',
                height: '100vh',
                background: '#fff',
                zIndex: 115,
                boxShadow: '-24px 0 60px rgba(15, 23, 42, 0.18)',
                padding: '28px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#64748b', fontWeight: 700, fontSize: '0.85rem' }}>Your Cart</div>
                  <h2 style={{ margin: '6px 0 0', fontSize: '1.55rem', fontWeight: 900 }}>{cartItemCount} items</h2>
                </div>
                <button onClick={() => setIsCartOpen(false)} style={{ border: 'none', background: '#f8fafc', borderRadius: '999px', width: 40, height: 40, cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cart.length > 0 ? cart.map((item) => (
                  <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '18px', padding: '14px', display: 'flex', gap: '14px' }}>
                    <img src={item.img} alt="" style={{ width: 82, height: 96, objectFit: 'cover', borderRadius: '14px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{item.name}</div>
                          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>Size {item.size || 'M'}</div>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => updateQuantity(item.id, -1)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: '10px', width: 30, height: 30, cursor: 'pointer' }}>
                            <Minus size={14} />
                          </button>
                          <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800 }}>{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: '10px', width: 30, height: 30, cursor: 'pointer' }}>
                            <Plus size={14} />
                          </button>
                        </div>
                        <div style={{ fontWeight: 900 }}>${item.price * item.quantity}</div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{ marginTop: '40px', textAlign: 'center', color: '#64748b' }}>Your cart is empty.</div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}><span>Subtotal</span><span>${cartTotal.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}><span>Tier Discount</span><span>-${tierDiscountAmount.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}><span>Coupon</span><span>-${couponDiscountAmount.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.05rem' }}><span>Total</span><span>${finalTotal.toFixed(2)}</span></div>
                <button
                  onClick={() => {
                    if (!userProfile) {
                      setToast('Please sign in before checkout');
                      setTimeout(() => setToast(null), 2500);
                      setIsUserOpen(true);
                      return;
                    }
                    if (cart.length === 0) {
                      setToast('Your cart is empty');
                      setTimeout(() => setToast(null), 2500);
                      return;
                    }
                    // Close all overlays and navigate to checkout page
                    setIsCartOpen(false);
                    setSelectedProduct(null);
                    setIsUserOpen(false);
                    setIsSearchOpen(false);
                    
                    // Force immediate navigation
                    router.push('/checkout');
                  }}
                  style={{ marginTop: '8px', border: 'none', borderRadius: '16px', padding: '16px 18px', background: '#0f172a', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  Proceed to Checkout
                </button>
              </div>
            </Motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default EcommerceDemo;
