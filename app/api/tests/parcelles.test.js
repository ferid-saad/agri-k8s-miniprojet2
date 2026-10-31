const request = require('supertest');

jest.mock('../src/db', () => ({
  pool: { query: jest.fn() },
  initDb: jest.fn(),
}));

const { pool } = require('../src/db');
const app = require('../src/app');

beforeEach(() => pool.query.mockReset());

describe('POST /parcelles', () => {
  it('refuse des donnees incompletes', async () => {
    const res = await request(app).post('/parcelles').send({ nom: 'Nord' });
    expect(res.statusCode).toBe(400);
  });

  it('cree une parcelle valide', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 1, nom: 'Nord', surface_ha: '2.50', culture: 'Tomates' }],
    });
    const res = await request(app)
      .post('/parcelles')
      .send({ nom: 'Nord', surface_ha: 2.5, culture: 'Tomates' });
    expect(res.statusCode).toBe(201);
    expect(res.body.nom).toBe('Nord');
  });
});

describe('GET /parcelles', () => {
  it('renvoie la liste des parcelles', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 1, nom: 'Nord' }] });
    const res = await request(app).get('/parcelles');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('DELETE /parcelles/:id', () => {
  it('refuse un identifiant invalide', async () => {
    const res = await request(app).delete('/parcelles/abc');
    expect(res.statusCode).toBe(400);
  });

  it('renvoie 404 si la parcelle n existe pas', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app).delete('/parcelles/99');
    expect(res.statusCode).toBe(404);
  });

  it('renvoie 204 si la parcelle est supprimee', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 1 }] });
    const res = await request(app).delete('/parcelles/1');
    expect(res.statusCode).toBe(204);
  });
});