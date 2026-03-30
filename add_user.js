import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('./database.sqlite');
db.run("INSERT OR IGNORE INTO users (name, email, password, createdAt) VALUES ('Test User', 'user@test.com', 'pass123', datetime('now'))", (err) => {
  if (err) console.error(err);
  else console.log("User 'user@test.com' created (pass: pass123)");
  db.close();
});
