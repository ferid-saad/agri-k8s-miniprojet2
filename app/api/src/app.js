const express = require('express');
const { pool } = require('./db');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode}`);
  });
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'irrigation-service' });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    console.error('Base injoignable :', err.message);
    res.status(503).json({ status: 'not ready' });
  }
});

app.use('/', require('./routes/parcelles'));
app.use('/', require('./routes/arrosages'));

module.exports = app;