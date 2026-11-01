import pool from './db.js';

// Tagged SQL templates backed by the project's shared PostgreSQL pool.
export function lineSql(strings, ...values) {
  let text = strings[0];
  for (let index = 0; index < values.length; index += 1) {
    text += `$${index + 1}${strings[index + 1]}`;
  }
  return pool.query(text, values).then(result => result.rows);
}

export async function getLineSql() {
  return lineSql;
}
