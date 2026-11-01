const { Pool } = require('pg');

const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on('error', (err) => {
  console.error('Erreur sur une connexion inactive à la base :', err.message);
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS parcelles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL DEFAULT 1,
      nom VARCHAR(100) NOT NULL,
      surface_ha NUMERIC(10, 2) NOT NULL,
      culture VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS arrosages (
      id SERIAL PRIMARY KEY,
      parcelle_id INTEGER NOT NULL REFERENCES parcelles(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL DEFAULT 1,
      date_arrosage DATE NOT NULL,
      duree_min INTEGER NOT NULL,
      volume_l NUMERIC(10, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE arrosages ADD COLUMN IF NOT EXISTS volume_reel_l NUMERIC(10, 2)
  `);
  // pour une base locale créée avant cette modification
  await pool.query('ALTER TABLE parcelles ALTER COLUMN user_id SET DEFAULT 1');
  await pool.query('ALTER TABLE arrosages ALTER COLUMN user_id SET DEFAULT 1');
}

module.exports = { pool, initDb };