import fs from 'fs';

const filePath = 'c:/Users/ccae3/Documents/GitHub/TK_SAAS_SALES_DEMO/src/pages/EcommerceDemo.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = /<Ticket size=\{16\} \/> 累積點數: \{userProfile\.points\} P\s+<\/div>\s+<\/div>/;
const replacement = `<Ticket size={16} /> 累積點數: {userProfile.points} P
                      </div>

                      {/* Order History */}
                      <div style={{ marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, marginBottom: '16px', fontSize: '1rem' }}>
                          <Package size={20} /> {lang === 'zh' ? '我的訂單記錄' : 'Order History'}
                        </div>
                        
                        <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                          {userOrders.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', background: '#f8fafc', borderRadius: '12px' }}>
                              {lang === 'zh' ? '目前尚無訂單記錄' : 'No order history yet'}
                            </div>
                          ) : userOrders.map(order => (
                            <div key={order.id} style={{ padding: '12px', border: '1px solid #f1f5f9', borderRadius: '12px', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>#{order.id}</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: (order.status === 'completed' || order.status === 'Shipped') ? '#16a34a' : '#f59e0b' }}>{(order.status || 'ORDERED').toUpperCase()}</span>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px' }}>
                                <Clock size={10} style={{ display: 'inline', marginRight: '4px' }} />
                                {new Date(order.createdAt).toLocaleDateString()}
                              </div>
                              <div style={{ marginBottom: '8px' }}>
                                {order.items?.map((item, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px', alignItems: 'center' }}>
                                    <span style={{ color: '#0f172a', fontWeight: 500 }}>{item.product_name} x {item.quantity}</span>
                                    <button onClick={() => {
                                      const foundProd = products.find(p => p.id == item.product_id);
                                      setSelectedProduct(foundProd || { id: item.product_id, name: item.product_name, price: item.price, img: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=400' });
                                      setIsUserOpen(false);
                                    }} style={{ background: '#f5f3ff', border: 'none', color: '#a855f7', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}>
                                      {lang === 'zh' ? '評價' : 'Review'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <div style={{ borderTop: '1px dashed #f1f5f9', paddingTop: '8px', textAlign: 'right', fontWeight: 800, color: '#a855f7', fontSize: '0.9rem' }}>
                                Total: \${order.total.toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                   </div>`;

if (target.test(content)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content);
  console.log('Successfully updated UI');
} else {
  console.log('Target not found');
}
