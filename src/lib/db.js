import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:82988530@localhost:5432/saas_demo';

const pool = new Pool({
  connectionString,
  // Disable SSL for local Docker network
  ssl: false,
});

export const query = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (err) {
    throw err;
  }
};

export const get = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
  } catch (err) {
    throw err;
  }
};

export const run = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return { changes: result.rowCount, id: result.rows[0]?.id };
  } catch (err) {
    throw err;
  }
};

export default pool;
