import request from 'supertest';

import app from '../../src/app.js';
import { HttpStatusCode } from '@utils/HttpStatusCode';

import { useIntegrationDatabase } from '../helpers/setup';

useIntegrationDatabase();

describe('app routes', () => {
  it('GET /api/v1/health returns service status', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(HttpStatusCode.OK);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('connected');
    expect(response.body.environment).toBe(process.env.NODE_ENV);
    expect(response.body.timestamp).toBeTruthy();
    expect(typeof response.body.uptime).toBe('number');
  });

  it('GET /api/docs redireciona para /api/docs/ (Swagger UI)', async () => {
    const response = await request(app).get('/api/docs');

    expect(response.status).toBe(HttpStatusCode.MOVED_PERMANENTLY);
    expect(String(response.headers.location ?? '')).toMatch(/\/api\/docs\/?$/);
  });

  it('GET /api/docs/ retorna HTML do Swagger UI', async () => {
    const response = await request(app).get('/api/docs/');

    expect(response.status).toBe(HttpStatusCode.OK);
    expect(String(response.headers['content-type'] ?? '')).toMatch(
      /text\/html/i,
    );
    expect(response.text).toMatch(/swagger/i);
  });
});
