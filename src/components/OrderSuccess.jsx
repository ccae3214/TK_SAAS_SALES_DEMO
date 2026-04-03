"use client";
import React from 'react';
import { CheckCircle, Package, MapPin, User, Clock, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export const OrderSuccess = ({ order, userProfile, onContinue }) => {
  const { lang } = useLanguage();
  
  // Safety check - if order is missing, show error
  if (!order) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #f0f4f8 100%)',
        padding: '40px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: '500px',
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '800',
            color: '#ef4444',
            marginBottom: '15px',
          }}>
            {lang === 'zh' ? '錯誤' : 'Error'}
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#64748b',
            marginBottom: '30px',
          }}>
            {lang === 'zh' ? '訂單數據丟失，請返回重試。' : 'Order data is missing. Please try again.'}
          </p>
          <button
            onClick={onContinue}
            style={{
              padding: '12px 32px',
              borderRadius: '8px',
              border: 'none',
              background: '#0f172a',
              color: '#fff',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            {lang === 'zh' ? '返回' : 'Go Back'}
          </button>
        </div>
      </div>
    );
  }
  
  // Format date and time
  const formatDateTime = (dateString) => {
    if (!dateString) return new Date().toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US');
    const date = new Date(dateString);
    return date.toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US');
  };

  const orderDate = formatDateTime(order.created_at || new Date().toISOString());
  
  // Calculate subtotal (before discount)
  const subtotal = order.items?.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0) || 0;
  const discount = parseFloat(order.discount_amount) || 0;
  const shipping = parseFloat(order.shipping_cost) || 0;
  const total = parseFloat(order.total) || (subtotal - discount + shipping);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #f0f4f8 100%)',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
      }}>
        {/* Success Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '60px',
          animation: 'slideDown 0.6s ease-out',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '30px',
          }}>
            <CheckCircle size={100} color="#22c55e" strokeWidth={1.5} />
          </div>
          <h1 style={{
            fontSize: '48px',
            fontWeight: '800',
            color: '#0f172a',
            marginBottom: '10px',
          }}>
            {lang === 'zh' ? '訂購成功!' : 'Order Placed!'}
          </h1>
          <p style={{
            fontSize: '18px',
            color: '#64748b',
            marginBottom: '30px',
          }}>
            {lang === 'zh' ? '感謝您的訂購，我們將盡快為您準備和發貨。' : 'Thank you for your order. We are preparing your items!'}
          </p>
        </div>

        {/* Order Summary Card */}
        <div style={{
          background: '#fff',
          borderRadius: '24px',
          padding: '40px',
          marginBottom: '30px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
        }}>
          {/* Order ID and Date */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '30px',
            marginBottom: '40px',
            paddingBottom: '30px',
            borderBottom: '1px solid #f1f5f9',
          }}>
            <div>
              <p style={{
                fontSize: '14px',
                color: '#94a3b8',
                fontWeight: '600',
                marginBottom: '8px',
              }}>
                {lang === 'zh' ? '訂單編號' : 'Order Number'}
              </p>
              <p style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#0f172a',
              }}>
                #{order.id}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: '14px',
                color: '#94a3b8',
                fontWeight: '600',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <Clock size={16} /> {lang === 'zh' ? '訂購時間' : 'Order Date'}
              </p>
              <p style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#0f172a',
              }}>
                {orderDate}
              </p>
            </div>
          </div>

          {/* Order Items */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <Package size={20} />
              {lang === 'zh' ? '訂購項目' : 'Order Items'}
            </h2>
            
            <div style={{
              background: '#f8fafc',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}>
              {order.items && order.items.length > 0 ? (
                order.items.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 100px 100px 100px',
                    gap: '20px',
                    alignItems: 'center',
                    padding: '16px 20px',
                    borderBottom: idx < order.items.length - 1 ? '1px solid #e2e8f0' : 'none',
                  }}>
                    {/* Product Image */}
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                    }}>
                      <img 
                        src={item.img || item.image || 'https://via.placeholder.com/60'} 
                        alt={item.product_name || item.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/60'; }}
                      />
                    </div>

                    {/* Product Info */}
                    <div>
                      <p style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#0f172a',
                        marginBottom: '4px',
                      }}>
                        {item.product_name || item.name}
                      </p>
                      {item.size && (
                        <p style={{
                          fontSize: '12px',
                          color: '#94a3b8',
                        }}>
                          {lang === 'zh' ? '尺寸' : 'Size'}: {item.size}
                        </p>
                      )}
                    </div>

                    {/* Unit Price */}
                    <div style={{ textAlign: 'right' }}>
                      <p style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginBottom: '4px',
                      }}>
                        {lang === 'zh' ? '單價' : 'Unit Price'}
                      </p>
                      <p style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#0f172a',
                      }}>
                        ${parseFloat(item.price || 0).toFixed(2)}
                      </p>
                  </div>

                  {/* Quantity */}
                  <div style={{ textAlign: 'center' }}>
                    <p style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      marginBottom: '4px',
                    }}>
                      {lang === 'zh' ? '數量' : 'Qty'}
                    </p>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#0f172a',
                    }}>
                      {item.quantity}
                    </p>
                  </div>

                  {/* Subtotal */}
                  <div style={{ textAlign: 'right' }}>
                    <p style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      marginBottom: '4px',
                    }}>
                      {lang === 'zh' ? '小計' : 'Subtotal'}
                    </p>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: '#0f172a',
                    }}>
                      ${(parseFloat(item.price || 0) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
              ) : (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#94a3b8',
                }}>
                  {lang === 'zh' ? '沒有訂單項目' : 'No order items'}
                </div>
              )}
            </div>
          </div>

          {/* Price Breakdown */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '40px',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{
              display: 'grid',
              gap: '12px',
              marginBottom: '16px',
              paddingBottom: '16px',
              borderBottom: '1px solid #e2e8f0',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ color: '#64748b', fontSize: '14px' }}>
                  {lang === 'zh' ? '小計' : 'Subtotal'}
                </span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              
              {shipping > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>
                    {lang === 'zh' ? '運費' : 'Shipping'}
                  </span>
                  <span style={{ fontWeight: '600', color: '#0f172a' }}>
                    ${shipping.toFixed(2)}
                  </span>
                </div>
              )}
              
              {discount > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>
                    {lang === 'zh' ? '折扣' : 'Discount'}
                  </span>
                  <span style={{ fontWeight: '600', color: '#ef4444' }}>
                    -${discount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Total */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                {lang === 'zh' ? '總計' : 'Total'}
              </span>
              <span style={{
                fontSize: '28px',
                fontWeight: '800',
                color: '#22c55e',
              }}>
                ${total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Shipping Address */}
          {order.address && (
            <div style={{
              marginBottom: '40px',
              paddingBottom: '40px',
              borderBottom: '1px solid #f1f5f9',
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <MapPin size={20} />
                {lang === 'zh' ? '送貨地址' : 'Shipping Address'}
              </h3>
              <div style={{
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                lineHeight: '1.6',
              }}>
                {order.address}
              </div>
            </div>
          )}

          {/* User Information */}
          {userProfile && (
            <div style={{
              marginBottom: '40px',
              paddingBottom: '40px',
              borderBottom: '1px solid #f1f5f9',
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <User size={20} />
                {lang === 'zh' ? '帳戶信息' : 'Account Information'}
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px',
              }}>
                <div>
                  <p style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    marginBottom: '4px',
                    fontWeight: '600',
                  }}>
                    {lang === 'zh' ? '姓名' : 'Name'}
                  </p>
                  <p style={{
                    fontSize: '14px',
                    color: '#0f172a',
                    fontWeight: '600',
                  }}>
                    {userProfile.name}
                  </p>
                </div>
                <div>
                  <p style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    marginBottom: '4px',
                    fontWeight: '600',
                  }}>
                    {lang === 'zh' ? '電郵' : 'Email'}
                  </p>
                  <p style={{
                    fontSize: '14px',
                    color: '#0f172a',
                    fontWeight: '600',
                  }}>
                    {userProfile.email}
                  </p>
                </div>
                {userProfile.points !== undefined && (
                  <div>
                    <p style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      marginBottom: '4px',
                      fontWeight: '600',
                    }}>
                      {lang === 'zh' ? '獲得獎勵點數' : 'Points Earned'}
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#22c55e',
                      fontWeight: '700',
                    }}>
                      +{Math.floor(total / 10)} {lang === 'zh' ? '點' : 'pts'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Continue Shopping Button */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={onContinue}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                background: '#0f172a',
                color: '#fff',
                padding: '14px 48px',
                borderRadius: '12px',
                border: 'none',
                fontWeight: '700',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#1e293b';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(15,23,42,0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#0f172a';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {lang === 'zh' ? '繼續購物' : 'Continue Shopping'}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div style={{
          textAlign: 'center',
          color: '#64748b',
          fontSize: '14px',
        }}>
          <p>
            {lang === 'zh' 
              ? '我們已發送確認郵件，請檢查您的收件箱。'
              : 'A confirmation email has been sent to your inbox.'
            }
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
