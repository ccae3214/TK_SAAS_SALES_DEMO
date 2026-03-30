import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3001/api/products');
    console.log('API /products status:', res.status);
    const data = await res.json();
    console.log('Number of products:', data.length);

    const res2 = await fetch('http://localhost:3001/api/admin/dashboard');
    console.log('API /api/admin/dashboard status:', res2.status);
    if (res2.status === 200) {
      const stats = await res2.json();
      console.log('Inquiry Count:', stats.inquiryCount);
    }
  } catch (e) {
    console.error('Error fetching API:', e.message);
  }
}

test();
