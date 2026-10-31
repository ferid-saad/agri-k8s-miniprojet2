const express = require('express');
const { pool } = require('../db');

const router = express.Router();
const USER_ID = 1;

router.post('/parcelles', async (req, res) => {
  const { nom, surface_ha, culture } = req.body || {};
  const surface = Number(surface_ha);

  if (!nom || !culture || !(surface > 0)) {
    return res
      .status(400)
      .json({ error: 'nom, culture et surface_ha (supérieure à 0) requis' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO parcelles (user_id, nom, surface_ha, culture) VALUES ($1, $2, $3, $4) RETURNING id, nom, surface_ha, culture',
      [USER_ID, nom, surface, culture]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'erreur serveur' });
  }
});

router.get('/parcelles', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nom, surface_ha, culture FROM parcelles ORDER BY id'
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'erreur serveur' });
  }
});

router.delete('/parcelles/:id', async (req, res) => {
  const parcelleId = Number(req.params.id);

  if (!Number.isInteger(parcelleId) || parcelleId <= 0) {
    return res.status(400).json({ error: 'id de parcelle invalide' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM parcelles WHERE id = $1 RETURNING id',
      [parcelleId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'parcelle introuvable' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'erreur serveur' });
  }
});

module.exports = router;