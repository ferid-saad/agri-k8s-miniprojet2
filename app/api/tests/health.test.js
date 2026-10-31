const request = require('supertest');

jest.mock('../src/db', () => ({
  pool: { query: jest.fn() },
  initDb: jest.fn(),
}));

const { pool } = require('../src/db');
const app = require('../src/app');

beforeEach(() => pool.query.mockReset());

describe('GET /health', () => {
  it('repond 200 avec le statut ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe('irrigation-service');
  });
});

describe('GET /ready', () => {
  it('repond 200 quand la base repond', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const res = await request(app).get('/ready');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('repond 503 quand la base est injoignable', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockRejectedValue(new Error('connexion refusee'));
    const res = await request(app).get('/ready');
    expect(res.statusCode).toBe(503);
    spy.mockRestore();
  });
});