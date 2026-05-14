import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../app';
import { closePool, resetDb } from '../../test/helpers';

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

async function getToken(): Promise<string> {
  const res = await supertest(app.server)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'correct_password' });
  return res.body.accessToken as string;
}

describe('GET /api/user/profile', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server).get('/api/user/profile');
    expect(res.status).toBe(401);
  });

  it('returns the current user profile', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'testuser' });
    expect(res.body.id).toBeDefined();
  });
});

describe('PATCH /api/user/profile', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server)
      .patch('/api/user/profile')
      .send({ displayName: 'Test User' });
    expect(res.status).toBe(401);
  });

  it('updates the display name', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Test User' });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Test User');
  });

  it('returns 400 when displayName is missing', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when displayName is empty string', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: '' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when displayName exceeds 50 characters', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'a'.repeat(51) });

    expect(res.status).toBe(400);
  });

  it('persists the display name on subsequent GET', async () => {
    const token = await getToken();
    await supertest(app.server)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Persisted Name' });

    const res = await supertest(app.server)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.displayName).toBe('Persisted Name');
  });
});

describe('PATCH /api/user/password', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server)
      .patch('/api/user/password')
      .send({ currentPassword: 'correct_password', newPassword: 'newpass' });
    expect(res.status).toBe(401);
  });

  it('changes the password when current password is correct', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .patch('/api/user/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'correct_password', newPassword: 'new_secure_pass' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 401 when current password is wrong', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .patch('/api/user/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong_password', newPassword: 'new_secure_pass' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when currentPassword is missing', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .patch('/api/user/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'new_secure_pass' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is missing', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .patch('/api/user/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'correct_password' });

    expect(res.status).toBe(400);
  });

  it('new password works for subsequent login', async () => {
    const token = await getToken();
    await supertest(app.server)
      .patch('/api/user/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'correct_password', newPassword: 'brand_new_pass' });

    const loginRes = await supertest(app.server)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'brand_new_pass' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('accessToken');
  });
});

describe('PATCH /api/user/username', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app.server)
      .patch('/api/user/username')
      .send({ newUsername: 'newname' });
    expect(res.status).toBe(401);
  });

  it('changes the username', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .patch('/api/user/username')
      .set('Authorization', `Bearer ${token}`)
      .send({ newUsername: 'newusername' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('newusername');
  });

  it('returns 400 when newUsername is missing', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .patch('/api/user/username')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when newUsername is empty string', async () => {
    const token = await getToken();
    const res = await supertest(app.server)
      .patch('/api/user/username')
      .set('Authorization', `Bearer ${token}`)
      .send({ newUsername: '' });

    expect(res.status).toBe(400);
  });

  it('new username works for subsequent login', async () => {
    const token = await getToken();
    await supertest(app.server)
      .patch('/api/user/username')
      .set('Authorization', `Bearer ${token}`)
      .send({ newUsername: 'renameduser' });

    const loginRes = await supertest(app.server)
      .post('/api/auth/login')
      .send({ username: 'renameduser', password: 'correct_password' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('accessToken');
  });
});
