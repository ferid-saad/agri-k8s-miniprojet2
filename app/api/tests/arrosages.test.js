const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const token = jwt.sign(
  { userId: 1, email: 'ali@mail.com' },
  process.env.JWT_SECRET || 'dev-secret-change-me'
);

describe('POST /arrosages', () => {
  it('refuse une requête sans jeton', async () => {
    const res = await request(app).post('/arrosages').send({});
    expect(res.statusCode).toBe(401);
  });

  it('refuse des données incomplètes avec un jeton valide', async () => {
    const res = await request(app)
      .post('/arrosages')
      .set('Authorization', `Bearer ${token}`)
      .send({ parcelle_id: 1 });
    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /arrosages/:id', () => {
  it('refuse une requête sans jeton', async () => {
    const res = await request(app).patch('/arrosages/1').send({ volume_reel_l: 500 });
    expect(res.statusCode).toBe(401);
  });

  it('refuse un volume manquant avec un jeton valide', async () => {
    const res = await request(app)
      .patch('/arrosages/1')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /arrosages', () => {
  it('refuse une requête sans jeton', async () => {
    const res = await request(app).get('/arrosages');
    expect(res.statusCode).toBe(401);
  });

  it('refuse un parcelle_id invalide avec un jeton valide', async () => {
    const res = await request(app)
      .get('/arrosages?parcelle_id=abc')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(400);
  });
});