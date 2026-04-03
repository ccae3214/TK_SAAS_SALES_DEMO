"use client";
import React, { useState } from 'react';
import { ArrowLeft, X, Trash2, Plus, Minus, Loader } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export const CheckoutPage = ({
  cart,
  cartTotal,
  tierDiscountAmount,
  couponDiscountAmount,
  finalTotal,
  appliedCoupon,
  checkoutForm,
  setCheckoutForm,
  couponCode,
  setCouponCode,
  couponError,
  onApplyCoupon,
  onSubmit,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onToggleItemSelection,
  onToggleSelectAll,
  allSelected,
  isLoading = false,
}) => {
  const { lang } = useLanguage();
  const [localCouponCode, setLocalCouponCode] = useState(couponCode);

  const getInputValue = (e) => {
    if (!e) return '';
    return (e.currentTarget?.value ?? e.target?.value ?? '').toString();
  };

  const handleApplyCoupon = () => {
    setCouponCode(localCouponCode.toUpperCase());
    onApplyCoupon();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fff',
      display: 'grid',
      gridTemplateColumns: '1fr 420px',
      gap: '0',
    }}>
      {/* Main checkout form - Left side */}
      <div style={{
        padding: '60px 48px',
        borderRight: '1px solid #e2e8f0',
        overflowY: 'auto',
        maxHeight: '100vh',
      }}>
        {/* Back button */}
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#64748b',
            fontWeight: '600',
            marginBottom: '40px',
            fontSize: '14px',
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#0f172a'}
          onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
        >
          <ArrowLeft size={18} />
          {lang === 'zh' ? '返回購物' : 'Back to Shopping'}
        </button>

        {/* Checkout heading */}
        <div style={{ marginBottom: '50px' }}>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            fontWeight: '600',
            margin: '0 0 8px 0',
          }}>
            {lang === 'zh' ? '結帳' : 'Checkout'}
          </p>
          <h1 style={{
            fontSize: '48px',
            fontWeight: '900',
            margin: '0',
            color: '#0f172a',
          }}>
            {lang === 'zh' ? '完成您的訂單' : 'Complete your order'}
          </h1>
        </div>

        {/* Checkout form */}
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: '24px' }}>
          {/* Shipping Section */}
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              marginBottom: '16px',
              color: '#0f172a',
            }}>
              {lang === 'zh' ? '送貨地址' : 'Shipping Address'}
            </h2>
            <input
              type="text"
              placeholder={lang === 'zh' ? '請輸入送貨地址' : 'Enter your shipping address'}
              value={checkoutForm.address}
              onChange={(e) => {
                const value = getInputValue(e);
                setCheckoutForm(prev => ({ ...prev, address: value }));
              }}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Payment Section */}
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              marginBottom: '16px',
              color: '#0f172a',
            }}>
              {lang === 'zh' ? '付款方式' : 'Payment Method'}
            </h2>
            <input
              type="text"
              placeholder={lang === 'zh' ? '卡號（測試用：任意數字）' : 'Card number (Demo: any number)'}
              value={checkoutForm.card}
              onChange={(e) => {
                const value = getInputValue(e);
                setCheckoutForm(prev => ({ ...prev, card: value }));
              }}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Coupon Section */}
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              marginBottom: '16px',
              color: '#0f172a',
            }}>
              {lang === 'zh' ? '折扣券' : 'Coupon Code'}
            </h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder={lang === 'zh' ? '折扣券代碼' : 'Enter coupon code'}
                value={localCouponCode}
                onChange={(e) => {
                  const value = getInputValue(e);
                  setLocalCouponCode(value.toUpperCase());
                }}
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  background: '#fff',
                  padding: '0 18px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  color: '#0f172a',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                {lang === 'zh' ? '應用' : 'Apply'}
              </button>
            </div>
            {couponError && (
              <div style={{
                color: '#dc2626',
                fontSize: '13px',
                marginTop: '8px',
              }}>
                {couponError}
              </div>
            )}
            {appliedCoupon && (
              <div style={{
                color: '#16a34a',
                fontSize: '13px',
                marginTop: '8px',
              }}>
                ✓ {lang === 'zh' ? '折扣券' : 'Coupon'} "{appliedCoupon.code}" {lang === 'zh' ? '已應用' : 'applied'}
              </div>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '20px',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 18px',
              background: isLoading ? '#cbd5e1' : '#0f172a',
              color: '#fff',
              fontWeight: '800',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.3s ease',
            }}
            onMouseOver={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = '#1e293b';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseOut={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = '#0f172a';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {isLoading && <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />}
            {lang === 'zh' ? `支付 $${finalTotal.toFixed(2)}` : `Pay $${finalTotal.toFixed(2)}`}
          </button>
        </form>
      </div>

      {/* Order Summary - Right side (Sticky) */}
      <div style={{
        background: '#f8fafc',
        padding: '60px 32px',
        overflowY: 'auto',
        maxHeight: '100vh',
        borderLeft: '1px solid #e2e8f0',
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '700',
          marginBottom: '20px',
          color: '#0f172a',
        }}>
          {lang === 'zh' ? '訂單摘要' : 'Order Summary'}
        </h2>

        {/* Cart items */}
        <div style={{
          marginBottom: '24px',
          paddingBottom: '24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxHeight: '400px',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              id="select-all"
            />
            <label htmlFor="select-all" style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              {lang === 'zh' ? '全選 / 取消全選' : 'Select All / Deselect All'}
            </label>
          </div>
          {cart && cart.length > 0 ? (
            cart.map((item) => (
              <div key={item.id} style={{
                display: 'flex',
                gap: '12px',
                paddingBottom: '16px',
                borderBottom: '1px solid #e2e8f0',
              }}>
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => onToggleItemSelection(item.id)}
                  style={{ alignSelf: 'center' }}
                />
                {/* Product image */}
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  flexShrink: 0,
                }}>
                  <img
                    src={item.img}
                    alt={item.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </div>

                {/* Product details */}
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0f172a',
                    margin: '0 0 4px 0',
                  }}>
                    {item.name}
                  </p>
                  <p style={{
                    fontSize: '12px',
                    color: '#64748b',
                    margin: '0 0 6px 0',
                  }}>
                    {item.size && `Size: ${item.size}`} × {item.quantity}
                  </p>
                  <p style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#0f172a',
                    margin: '0',
                  }}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  style={{
                    border: 'none',
                    background: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: '6px',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  title={lang === 'zh' ? '刪除' : 'Remove'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <div style={{
              textAlign: 'center',
              color: '#64748b',
              padding: '20px',
            }}>
              {lang === 'zh' ? '購物車為空' : 'Your cart is empty'}
            </div>
          )}
        </div>

        {/* Price breakdown */}
        <div style={{
          display: 'grid',
          gap: '10px',
          marginBottom: '24px',
          paddingBottom: '24px',
          borderBottom: '1px solid #e2e8f0',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
            color: '#64748b',
          }}>
            <span>{lang === 'zh' ? '小計' : 'Subtotal'}</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>

          {tierDiscountAmount > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: '#64748b',
            }}>
              <span>{lang === 'zh' ? '會員折扣' : 'Tier Discount'}</span>
              <span style={{ color: '#16a34a' }}>-${tierDiscountAmount.toFixed(2)}</span>
            </div>
          )}

          {couponDiscountAmount > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: '#64748b',
            }}>
              <span>{lang === 'zh' ? '折扣券折扣' : 'Coupon Discount'}</span>
              <span style={{ color: '#16a34a' }}>-${couponDiscountAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Total */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <span style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#0f172a',
          }}>
            {lang === 'zh' ? '總計' : 'Total'}
          </span>
          <span style={{
            fontSize: '28px',
            fontWeight: '900',
            color: '#0f172a',
          }}>
            ${finalTotal.toFixed(2)}
          </span>
        </div>

        {/* Info text */}
        <p style={{
          fontSize: '12px',
          color: '#94a3b8',
          textAlign: 'center',
          margin: '0',
        }}>
          {lang === 'zh'
            ? '您的交易是安全的且加密的。'
            : 'Your transaction is secure and encrypted.'
          }
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};
