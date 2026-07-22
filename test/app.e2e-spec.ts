import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

type TokenBody = { accessToken: string; refreshToken: string };
type MeBody = { email: string; password?: string };
type ProductVariant = { id: string; name: string };
type StoreProduct = { id: string; slug: string; variants: ProductVariant[] };
type ProductsBody = { data: StoreProduct[]; meta: unknown };
type CartItem = { id: string; quantity: number; productVariantId: string };
type CartBody = { items: CartItem[]; subtotal: number };
type OrderBody = {
  id: string;
  status: string;
  total: number | string;
  orderNumber: string;
  items: { quantity: number; productVariantId: string }[];
};

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new PrismaExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth', () => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'Password123!';
    let accessToken: string;
    let refreshToken: string;

    it('POST /auth/register creates a customer', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password, name: 'E2E User' })
        .expect(201);

      const body = res.body as TokenBody;
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
    });

    it('POST /auth/register with same email returns 409', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password, name: 'Duplicate' })
        .expect(409);
    });

    it('POST /auth/login returns access and refresh tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(201);

      const body = res.body as TokenBody;
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
    });

    it('POST /auth/refresh rotates tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const body = res.body as TokenBody;
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body.refreshToken).not.toBe(refreshToken);

      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
    });

    it('POST /auth/refresh rejects reuse of a rotated token', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(201);
      const first = login.body as TokenBody;

      const rotated = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200);
      const next = rotated.body as TokenBody;

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(401);

      // the rotated token is revoked by reuse detection; mint a fresh pair for later tests
      const again = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(201);
      const body = again.body as TokenBody;
      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
      expect(next.refreshToken).toBeTruthy();
    });

    it('GET /auth/me returns the current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as MeBody;
      expect(body.email).toBe(email);
      expect(body).not.toHaveProperty('password');
    });

    it('POST /auth/logout revokes the refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('GET /auth/me without token returns 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });
  });

  describe('Store catalog', () => {
    it('GET /store/categories returns a tree', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/store/categories')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /store/products returns paginated published products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/store/products')
        .query({ page: 1, limit: 5 })
        .expect(200);

      const body = res.body as ProductsBody;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('Store cart (auth required)', () => {
    it('GET /store/cart without token returns 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/store/cart').expect(401);
    });

    it('GET /store/cart with customer token returns a cart', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'customer@example.com', password: 'Password123!' })
        .expect(201);

      const token = (login.body as TokenBody).accessToken;
      const res = await request(app.getHttpServer())
        .get('/api/v1/store/cart')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as CartBody;
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('subtotal');
    });
  });

  describe('Store orders ownership', () => {
    it('GET /store/orders/:id for a missing id returns 404', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'customer@example.com', password: 'Password123!' })
        .expect(201);

      const token = (login.body as TokenBody).accessToken;
      await request(app.getHttpServer())
        .get('/api/v1/store/orders/does-not-exist-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('Store purchase (register → checkout)', () => {
    const email = `e2e-buyer-${Date.now()}@example.com`;
    const password = 'Password123!';
    let accessToken: string;

    it('registers a new customer', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password, name: 'E2E Buyer' })
        .expect(201);

      accessToken = (res.body as TokenBody).accessToken;
    });

    it('adds a seeded product variant to the cart', async () => {
      const catalog = await request(app.getHttpServer())
        .get('/api/v1/store/products')
        .query({ page: 1, limit: 1 })
        .expect(200);

      const products = (catalog.body as ProductsBody).data;
      expect(products.length).toBeGreaterThan(0);
      expect(products[0].variants.length).toBeGreaterThan(0);

      const variantId = products[0].variants[0].id;
      const cartRes = await request(app.getHttpServer())
        .post('/api/v1/store/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productVariantId: variantId, quantity: 1 })
        .expect(201);

      const cart = cartRes.body as CartBody;
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productVariantId).toBe(variantId);
      expect(cart.subtotal).toBeGreaterThan(0);
    });

    it('places an order from the cart', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/store/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ note: 'e2e test order' })
        .expect(201);

      const order = res.body as OrderBody;
      expect(order.status).toBe('PENDING');
      expect(order.orderNumber).toBeTruthy();
      expect(order.items).toHaveLength(1);
      expect(order.total).toBeTruthy();
      expect(Number(order.total)).toBeGreaterThan(0);

      const cart = await request(app.getHttpServer())
        .get('/api/v1/store/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect((cart.body as CartBody).items).toHaveLength(0);
    });

    it('lists and fetches the placed order', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/store/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const orders = listRes.body as OrderBody[];
      expect(orders.length).toBeGreaterThanOrEqual(1);

      const orderId = orders[0].id;
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/store/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const order = detailRes.body as OrderBody;
      expect(order.id).toBe(orderId);
      expect(order.items).toHaveLength(1);
    });
  });
});
