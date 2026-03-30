import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('database.sqlite');
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='order_items'", (err, row) => console.log(row ? row.sql : 'NOT FOUND'));
