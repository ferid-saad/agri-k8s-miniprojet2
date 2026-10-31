const request = require('supertest');

jest.mock('../src/db', () => ({
  pool: { query: jest.fn() },
  initDb: jest.fn(),
}));

const { pool } = require('../src/db');
const app = require('../src/app');

beforeEach(() => pool.query.mockReset());

const valide = {
  parcelle_id: 1,
  date_arrosage: '2026-11-01',
  duree_min: 30,
  volume_l: 600,
};

describe('POST /arrosages', () => {
  it('refuse des donnees incompletes', async () => {
    const res = await request(app).post('/arrosages').send({ parcelle_id: 1 });
    expect(res.statusCode).toBe(400);
  });

  it('renvoie 404 si la parcelle n existe pas', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/arrosages').send(valide);
    expect(res.statusCode).toBe(404);
  });

  it('cree un arrosage valide', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5, ...valide }] });
    const res = await request(app).post('/arrosages').send(valide);
    expect(res.statusCode).toBe(201);
  });
});

describe('PATCH /arrosages/:id', () => {
  it('refuse un volume manquant', async () => {
    const res = await request(app).patch('/arrosages/1').send({});
    expect(res.statusCode).toBe(400);
  });

  it('renvoie 404 si l arrosage n existe pas', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app).patch('/arrosages/99').send({ volume_reel_l: 500 });
    expect(res.statusCode).toBe(404);
  });

  it('enregistre la consommation reelle', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 1, volume_reel_l: '500.00' }] });
    const res = await request(app).patch('/arrosages/1').send({ volume_reel_l: 500 });
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /arrosages', () => {
  it('refuse un parcelle_id invalide', async () => {
    const res = await request(app).get('/arrosages?parcelle_id=abc');
    expect(res.statusCode).toBe(400);
  });

  it('renvoie la liste des arrosages', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 1 }] });
    const res = await request(app).get('/arrosages');
    expect(res.statusCode).toBe(200);
  });
});

describe('DELETE /arrosages/:id', () => {
  it('refuse un identifiant invalide', async () => {
    const res = await request(app).delete('/arrosages/abc');
    expect(res.statusCode).toBe(400);
  });

  it('renvoie 404 si l arrosage n existe pas', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app).delete('/arrosages/99');
    expect(res.statusCode).toBe(404);
  });

  it('renvoie 204 si l arrosage est supprime', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 1 }] });
    const res = await request(app).delete('/arrosages/1');
    expect(res.statusCode).toBe(204);
  });
});