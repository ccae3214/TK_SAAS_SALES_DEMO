import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { encrypt } from './crypto_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];

const productExpansion = [
  { name: "Vintage Denim Jacket", price: 110, category: "Men", tag: "RETRO", img: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=800&auto=format&fit=crop" },
  { name: "Silk Wrap Dress", price: 180, category: "Women", tag: "PREMIUM", img: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=800&auto=format&fit=crop" },
  { name: "Leather Chelsea Boots", price: 165, category: "Men", tag: "ELEGANT", img: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=800&auto=format&fit=crop" },
  { name: "Gold Chain Necklace", price: 45, category: "Accessories", tag: "HOT", img: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?q=80&w=800&auto=format&fit=crop" },
  { name: "Cashmere Scarf", price: 95, category: "Accessories", tag: "WINTER", img: "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?q=80&w=800&auto=format&fit=crop" },
  { name: "Linen Summer Shirt", price: 65, category: "Men", tag: "COOL", img: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=800&auto=format&fit=crop" },
  { name: "Pleated Midi Skirt", price: 75, category: "Women", tag: "TRENDING", img: "https://images.unsplash.com/photo-1577900232427-18219b9166a0?q=80&w=800&auto=format&fit=crop" },
  { name: "Wool Overcoat", price: 299, category: "Men", tag: "CLASSIC", img: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop" },
  { name: "Satin Evening Gown", price: 350, category: "Women", tag: "LUXURY", img: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?q=80&w=800&auto=format&fit=crop" },
  { name: "Polarized Sunglasses", price: 120, category: "Accessories", tag: "", img: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=800&auto=format&fit=crop" }
];

async function seed() {
  console.log('Starting Seeding Process...');

  db.serialize(async () => {
    // 1. Expand Products (skip if already exists)
    console.log('Expanding Products...');
    const prodStmt = db.prepare('INSERT OR IGNORE INTO products (name, price, category, tag, img) VALUES (?, ?, ?, ?, ?)');
    productExpansion.forEach(p => {
      prodStmt.run(p.name, p.price, p.category, p.tag, p.img);
    });
    prodStmt.finalize();

    // 2. Clear then Insert 100 Users
    console.log('Clearing and Inserting 100 Users...');
    db.run('DELETE FROM users');
    const userStmt = db.prepare('INSERT INTO users (name, email, password, createdAt) VALUES (?, ?, ?, ?)');
    for (let i = 0; i < 100; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const name = `${fn} ${ln}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${Math.floor(Math.random()*1000)}@example.com`;
      
      // Random date in last 14 days
      const daysAgo = Math.floor(Math.random() * 14);
      const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const encryptedPassword = encrypt('password123');
      
      userStmt.run(name, email, encryptedPassword, date); 
    }
    userStmt.finalize();

    // 3. Insert 10 Orders
    console.log('Inserting 10 Orders...');
    // We need some product IDs first.
    db.all('SELECT id, name, price FROM products', [], (err, products) => {
      if (err || !products.length) return console.error('No products found for orders');

      for (let j = 0; j < 10; j++) {
        const orderId = `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        let total = 0;
        const numItems = Math.floor(Math.random() * 3) + 1;
        const items = [];

        for (let k = 0; k < numItems; k++) {
          const p = products[Math.floor(Math.random() * products.length)];
          const qty = Math.floor(Math.random() * 2) + 1;
          const itemPrice = p.price * qty;
          total += itemPrice;
          items.push({ id: p.id, name: p.name, price: p.price, qty });
        }

        db.run('INSERT INTO orders (id, total) VALUES (?, ?)', [orderId, total], function(err) {
          if (err) return console.error(err);
          const itemStmt = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, size, quantity, price) VALUES (?, ?, ?, ?, ?, ?)');
          items.forEach(it => {
            itemStmt.run(orderId, it.id, it.name, 'M', it.qty, it.price);
          });
          itemStmt.finalize();
        });
      }
      console.log('Seeding Completed Succesfully!');
    });
  });
}

seed();
