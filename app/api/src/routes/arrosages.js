const express = require('express');
const { pool } = require('../db');

const router = express.Router();
const USER_ID = 1;

router.post('/arrosages', async (req, res) => {
  const { parcelle_id, date_arrosage, duree_min, volume_l } = req.body || {};
  const parcelleId = Number(parcelle_id);
  const duree = Number(duree_min);
  const volume = Number(volume_l);
  const dateValide =
    typeof date_arrosage === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date_arrosage) &&
    !Number.isNaN(Date.parse(date_arrosage));

  if (!Number.isInteger(parcelleId) || parcelleId <= 0 || !dateValide ||
      !Number.isInteger(duree) || duree <= 0 || !(volume > 0)) {
    return res.status(400).json({
      error: 'parcelle_id, date_arrosage (AAAA-MM-JJ), duree_min et volume_l (> 0) requis',
    });
  }

  try {
    const parcelle = await pool.query(
      'SELECT id FROM parcelles WHERE id = $1',
      [parcelleId]
    );
    if (parcelle.rows.length === 0) {
      return res.status(404).json({ error: 'parcelle introuvable' });
    }

    const result = await pool.query(
      `INSERT INTO arrosages (parcelle_id, user_id, date_arrosage, duree_min, volume_l)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, parcelle_id, to_char(date_arrosage, 'YYYY-MM-DD') AS date_arrosage, duree_min, volume_l`,
      [parcelleId, USER_ID, date_arrosage, duree, volume]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'erreur serveur' });
  }
});

router.patch('/arrosages/:id', async (req, res) => {
  const arrosageId = Number(req.params.id);
  const { volume_reel_l } = req.body || {};
  const volumeReel = Number(volume_reel_l);
  const volumeValide =
    volume_reel_l !== undefined &&
    volume_reel_l !== null &&
    volume_reel_l !== '' &&
    volumeReel >= 0;

  if (!Number.isInteger(arrosageId) || arrosageId <= 0 || !volumeValide) {
    return res
      .status(400)
      .json({ error: 'id valide et volume_reel_l (supérieur ou égal à 0) requis' });
  }

  try {
    const result = await pool.query(
      `UPDATE arrosages SET volume_reel_l = $1
       WHERE id = $2
       RETURNING id, parcelle_id, to_char(date_arrosage, 'YYYY-MM-DD') AS date_arrosage,
                 duree_min, volume_l, volume_reel_l`,
      [volumeReel, arrosageId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'arrosage introuvable' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'erreur serveur' });
  }
});

router.get('/arrosages', async (req, res) => {
  const { parcelle_id } = req.query;
  const params = [];
  let filtre = '';

  if (parcelle_id !== undefined) {
    const parcelleId = Number(parcelle_id);
    if (!Number.isInteger(parcelleId) || parcelleId <= 0) {
      return res
        .status(400)
        .json({ error: 'parcelle_id doit être un entier positif' });
    }
    params.push(parcelleId);
    filtre = 'WHERE a.parcelle_id = $1';
  }

  try {
    const result = await pool.query(
      `SELECT a.id, a.parcelle_id, p.nom AS parcelle_nom,
              to_char(a.date_arrosage, 'YYYY-MM-DD') AS date_arrosage,
              a.duree_min, a.volume_l, a.volume_reel_l
       FROM arrosages a
       JOIN parcelles p ON p.id = a.parcelle_id
       ${filtre}
       ORDER BY a.date_arrosage DESC, a.id DESC`,
      params
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'erreur serveur' });
  }
});

router.delete('/arrosages/:id', async (req, res) => {
  const arrosageId = Number(req.params.id);

  if (!Number.isInteger(arrosageId) || arrosageId <= 0) {
    return res.status(400).json({ error: "id d'arrosage invalide" });
  }

  try {
    const result = await pool.query(
      'DELETE FROM arrosages WHERE id = $1 RETURNING id',
      [arrosageId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'arrosage introuvable' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'erreur serveur' });
  }
});

module.exports = router;