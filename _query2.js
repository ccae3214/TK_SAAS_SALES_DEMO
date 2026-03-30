import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('database.sqlite');
db.serialize(() => {
  db.run("ALTER TABLE orders ADD COLUMN userEmail TEXT", () => console.log('userEmail added or exists'));
  db.run("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'", () => console.log('status added or exists'));
});
