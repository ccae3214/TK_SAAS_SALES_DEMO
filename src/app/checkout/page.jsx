"use client";
import React, { useState, useEffect } from 'react';
import { CheckoutPage } from '@/components/CheckoutPage';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { OrderSuccess } from '@/components/OrderSuccess';

export default function CheckoutRoute() {
  const { lang } = useLanguage();
  const { userProfile } = useAuth();
  const router = useRouter();
  
  const [cart, setCart] = useState([]);
  const [checkoutForm, setCheckoutForm] = useState({ address: '', card: '' });
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [cartLoadedOnce, setCartLoadedOnce] = useState(false);
  const isFirstCartRender = React.useRef(true);

  const normalizeCart = (items) =>
    items.map((item) => ({ selected: true, ...item }));

  const selectedCartItems = cart.filter((item) => item.selected);
  const selectedCartTotal = selectedCartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const allSelected = cart.length > 0 && cart.every((item) => item.selected);

  const toggleItemSelection = (id) => {
    setCart((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      );
      localStorage.setItem('tk_cart', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleSelectAll = () => {
    setCart((prev) => {
      const updated = prev.map((item) => ({ ...item, selected: !allSelected }));
      localStorage.setItem('tk_cart', JSON.stringify(updated));
      return updated;
    });
  };

  // Load cart from local storage
  useEffect(() => {
    const saved = localStorage.getItem('tk_cart');
    if (saved) {
      const parsedCart = normalizeCart(JSON.parse(saved));
      setCart(parsedCart);
      if (parsedCart.length === 0) {
        router.push('/demo/ecommerce');
      }
    } else {
      router.push('/demo/ecommerce');
    }
    
    // Listen for cart changes from other tabs/windows
    const handleStorageChange = (e) => {
      if (e.key === 'tk_cart') {
        if (e.newValue) {
          try {
            const parsedCart = JSON.parse(e.newValue);
            setCart(parsedCart);
            if (parsedCart.length === 0) {
              router.push('/demo/ecommerce');
            }
          } catch (err) {
            console.error('Failed to parse cart:', err);
          }
        } else {
          setCart([]);
          router.push('/demo/ecommerce');
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [router]);

  // Load CSRF token once
  useEffect(() => {
    fetch('/api/csrf')
      .then(res => res.json())
      .then(data => {
        if (data?.csrfToken) setCsrfToken(data.csrfToken);
      })
      .catch(err => console.error('Failed to fetch CSRF token:', err));
  }, []);

  // Load cart from database once when user logs in
  useEffect(() => {
    if (userProfile?.email && !cartLoadedOnce) {
      fetch(`/api/cart?email=${encodeURIComponent(userProfile.email)}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const normalized = normalizeCart(data);
            setCart(normalized);
            localStorage.setItem('tk_cart', JSON.stringify(normalized));
          }
          setCartLoadedOnce(true);
        })
        .catch(err => {
          console.error('Failed to load cart from DB:', err);
          setCartLoadedOnce(true);
        });
    }
  }, [userProfile?.email, cartLoadedOnce]);

  // Keep localStorage + DB cart in sync after each cart update (but skip initial load event)
  useEffect(() => {
    if (isFirstCartRender.current) {
      isFirstCartRender.current = false;
      return;
    }

    localStorage.setItem('tk_cart', JSON.stringify(cart));

    if (userProfile?.email) {
      fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ email: userProfile.email, cart })
      }).catch(err => {
        console.error('Failed to sync cart to DB:', err);
      });
    }
  }, [cart, userProfile?.email]);

  // Calculations (Simplified version of EcommerceDemo logic)
  const cartTotal = selectedCartTotal;
  
  const TIERS = [
    { name: 'Regular', min: 0, discount: 0 },
    { name: 'Silver', min: 200, discount: 0.05 },
    { name: 'Gold', min: 1000, discount: 0.10 },
    { name: 'Platinum', min: 5000, discount: 0.15 }
  ];
  
  const userSpending = userProfile?.totalSpending || 0;
  const currentTier = [...TIERS].reverse().find(t => userSpending >= t.min) || TIERS[0];
  const tierDiscountAmount = cartTotal * currentTier.discount;
  
  const couponDiscountAmount = appliedCoupon ? (cartTotal * (appliedCoupon.discount / 100)) : 0;
  const finalTotal = Math.max(0, cartTotal - tierDiscountAmount - couponDiscountAmount);

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
      } else {
        setCouponError(data.error);
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError('Error verifying coupon');
    }
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => {
      const updated = prev.map(item => 
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      );
      localStorage.setItem('tk_cart', JSON.stringify(updated));
      return updated;
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('tk_cart', JSON.stringify(updated));
      if (updated.length === 0) router.push('/demo/ecommerce');
      return updated;
    });
  };

  const processOrder = async (e) => {
    e.preventDefault();
    if (!userProfile) {
      console.error("User profile not found");
      return;
    }
    
    const selectedItems = cart.filter((item) => item.selected);
    if (selectedItems.length === 0) {
      console.error("No items selected for checkout");
      return;
    }
    
    setIsLoading(true);
    
    const orderData = {
      email: userProfile.email,
      items: selectedItems,
      total: finalTotal,
      address: checkoutForm.address,
      couponCode: appliedCoupon?.code || null
    };

    try {
      console.log("Submitting order with data:", orderData);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(orderData)
      });
      
      console.log("Order response status:", res.status);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error("Order API error:", res.status, errorData);
        return;
      }
      
      const contentType = res.headers.get('content-type');
      console.log("Response content-type:", contentType);
      
      let data;
      if (contentType?.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error("Response is not JSON:", text);
        return;
      }
      
      console.log("Order response data:", data);
      
      // Ensure we have valid order data
      if (!data) {
        console.error("Response data is null/undefined");
        return;
      }
      
      // Check if order was created successfully
      if (data.order && typeof data.order === 'object') {
        console.log("Order created successfully:", data.order.id);
        setCompletedOrder(data.order);

        const remaining = cart.filter((item) => !item.selected);
        setCart(remaining);
        localStorage.setItem('tk_cart', JSON.stringify(remaining));

        if (userProfile?.email) {
          await fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userProfile.email, cart: remaining }),
          }).catch(err => {
            console.error('Failed to persist cart clear after checkout:', err);
          });
        }
      } else if (data.success && data.order) {
        console.log("Order created (with success flag):", data.order.id);
        setCompletedOrder(data.order);
        setCart([]);
        localStorage.removeItem('tk_cart');

        if (userProfile?.email) {
          await fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userProfile.email, cart: [] }),
          }).catch(err => {
            console.error('Failed to persist cart clear after checkout:', err);
          });
        }
      } else {
        console.error("Invalid order response structure:", data);
      }
    } catch (err) {
      console.error("Order failed - Exception:", {
        message: err.message,
        name: err.name,
        stack: err.stack
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (completedOrder) {
    return (
      <OrderSuccess 
        order={completedOrder} 
        userProfile={userProfile}
        onContinue={() => router.push('/demo/ecommerce')}
      />
    );
  }

  return (
    <CheckoutPage 
      cart={cart}
      cartTotal={cartTotal}
      tierDiscountAmount={tierDiscountAmount}
      couponDiscountAmount={couponDiscountAmount}
      finalTotal={finalTotal}
      appliedCoupon={appliedCoupon}
      checkoutForm={checkoutForm}
      setCheckoutForm={setCheckoutForm}
      couponCode={couponCode}
      setCouponCode={setCouponCode}
      couponError={couponError}
      onApplyCoupon={verifyCoupon}
      onSubmit={processOrder}
      onClose={() => router.push('/demo/ecommerce')}
      onUpdateQuantity={updateQuantity}
      onRemoveItem={removeFromCart}
      onToggleItemSelection={toggleItemSelection}
      onToggleSelectAll={toggleSelectAll}
      allSelected={allSelected}
      isLoading={isLoading}
    />
  );
}
