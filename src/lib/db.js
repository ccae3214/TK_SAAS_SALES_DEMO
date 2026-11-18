import pkg from 'pg';
const { Pool } = pkg;

// No fallback connection string: a default password in git protects nothing.
// `next build` imports route modules without a database, so the failure is raised on first use instead of at import.
const connectionString = process.env.DATABASE_URL;

function missingDatabaseUrl() {
  return new Error('DATABASE_URL is not set. Set it in the environment (see .env.example); there is no default connection string.');
}

const pool = connectionString
  ? new Pool({
    connectionString,
    // Disable SSL for local Docker network
    ssl: false,
  })
  : new Proxy({}, {
    get(_target, property) {
      if (property === 'then') return undefined;
      return () => { throw missingDatabaseUrl(); };
    },
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
