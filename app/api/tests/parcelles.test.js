const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const token = jwt.sign(
  { userId: 1, email: 'ali@mail.com' },
  process.env.JWT_SECRET || 'dev-secret-change-me'
);

describe('POST /parcelles', () => {
  it('refuse une requête sans jeton', async () => {
    const res = await request(app).post('/parcelles').send({});
    expect(res.statusCode).toBe(401);
  });

  it('refuse un jeton invalide', async () => {
    const res = await request(app)
      .post('/parcelles')
      .set('Authorization', 'Bearer abc')
      .send({});
    expect(res.statusCode).toBe(401);
  });

  it('refuse des données incomplètes avec un jeton valide', async () => {
    const res = await request(app)
      .post('/parcelles')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Parcelle Nord' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /parcelles', () => {
  it('refuse une requête sans jeton', async () => {
    const res = await request(app).get('/parcelles');
    expect(res.statusCode).toBe(401);
  });
});

describe('DELETE /parcelles/:id', () => {
  it('refuse une requête sans jeton', async () => {
    const res = await request(app).delete('/parcelles/1');
    expect(res.statusCode).toBe(401);
  });

  it('refuse un identifiant invalide avec un jeton valide', async () => {
    const res = await request(app)
      .delete('/parcelles/abc')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(400);
  });
});