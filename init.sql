-- Create tables for PostgreSQL
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100),
  tag VARCHAR(100),
  img TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  spending DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(50) PRIMARY KEY,
  total DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) REFERENCES orders(id),
  product_id INTEGER REFERENCES products(id),
  product_name VARCHAR(255),
  size VARCHAR(10),
  quantity INTEGER NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  user_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inquiries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  content TEXT,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS newsletter (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  rating INTEGER,
  comment TEXT,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_carts (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255),
  product_id INTEGER REFERENCES products(id),
  product_name VARCHAR(255),
  price DECIMAL(10, 2),
  quantity INTEGER NOT NULL,
  size VARCHAR(10),
  img TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial products
INSERT INTO products (name, price, category, tag, img) VALUES
('Vintage Denim Jacket', 110, 'Men', 'RETRO', 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=800&auto=format&fit=crop'),
('Silk Wrap Dress', 180, 'Women', 'PREMIUM', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=800&auto=format&fit=crop'),
('Leather Chelsea Boots', 165, 'Men', 'ELEGANT', 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=800&auto=format&fit=crop'),
('Gold Chain Necklace', 45, 'Accessories', 'HOT', 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?q=80&w=800&auto=format&fit=crop'),
('Cashmere Scarf', 95, 'Accessories', 'WINTER', 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?q=80&w=800&auto=format&fit=crop'),
('Linen Summer Shirt', 65, 'Men', 'COOL', 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=800&auto=format&fit=crop'),
('Pleated Midi Skirt', 75, 'Women', 'TRENDING', 'https://images.unsplash.com/photo-1577900232427-18219b9166a0?q=80&w=800&auto=format&fit=crop'),
('Wool Overcoat', 299, 'Men', 'CLASSIC', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop'),
('Satin Evening Gown', 350, 'Women', 'LUXURY', 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?q=80&w=800&auto=format&fit=crop'),
('Polarized Sunglasses', 120, 'Accessories', '', 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=800&auto=format&fit=crop')
ON CONFLICT DO NOTHING;


-- Personal notes feature
CREATE TABLE IF NOT EXISTS note_folders (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_email, name)
);

CREATE TABLE IF NOT EXISTS user_notes (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  folder_id BIGINT REFERENCES note_folders(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notes_owner_updated ON user_notes(user_email, updated_at DESC);
CREATE INDEX IF NOT EXISTS user_notes_search ON user_notes USING GIN (to_tsvector('simple', title || ' ' || content));
