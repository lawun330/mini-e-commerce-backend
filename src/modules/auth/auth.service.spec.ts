import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma.mock';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService (auth endpoints)', () => {
  let service: AuthService;
  const prisma = createPrismaMock();
  const jwt = { sign: jest.fn().mockReturnValue('access-token') };
  const config = { get: jest.fn().mockReturnValue('7d') };

  beforeEach(async () => {
    jest.clearAllMocks();
    config.get.mockReturnValue('7d');
    jwt.sign.mockReturnValue('access-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('POST /auth/register', () => {
    it('creates user, cart, and token pair', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        role: Role.CUSTOMER,
      });
      prisma.cart.create.mockResolvedValue({ id: 'c1' });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: 'a@b.com',
        password: 'Password123!',
        name: 'A',
      });

      expect(result.accessToken).toBe('access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
      expect(prisma.cart.create).toHaveBeenCalledWith({
        data: { userId: 'u1' },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('throws ConflictException when email exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(
        service.register({
          email: 'a@b.com',
          password: 'Password123!',
          name: 'A',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('POST /auth/login', () => {
    it('returns token pair for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: 'hashed',
        role: Role.CUSTOMER,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: 'a@b.com',
        password: 'Password123!',
      });
      expect(result.accessToken).toBe('access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });

    it('throws UnauthorizedException when user missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@y.com', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when password mismatches', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: 'hashed',
        role: Role.CUSTOMER,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('POST /auth/refresh', () => {
    const raw = 'refresh-raw-token';
    const tokenHash = createHash('sha256').update(raw).digest('hex');

    it('rotates a valid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'u1', email: 'a@b.com', role: Role.CUSTOMER },
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh(raw);
      expect(result.accessToken).toBe('access-token');
      expect(prisma.refreshToken.update).toHaveBeenCalledTimes(1);
      const updateCalls = prisma.refreshToken.update.mock.calls as Array<
        [{ where: { id: string }; data: { revokedAt: Date } }]
      >;
      expect(updateCalls[0][0].where).toEqual({ id: 'rt1' });
      expect(updateCalls[0][0].data.revokedAt).toBeInstanceOf(Date);
    });

    it('rejects unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh(raw)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('detects reuse of revoked token and revokes all', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        tokenHash,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'u1', email: 'a@b.com', role: Role.CUSTOMER },
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await expect(service.refresh(raw)).rejects.toThrow(
        'Refresh token reuse detected',
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('rejects expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'u1', email: 'a@b.com', role: Role.CUSTOMER },
      });
      prisma.refreshToken.update.mockResolvedValue({});

      await expect(service.refresh(raw)).rejects.toThrow(
        'Refresh token expired',
      );
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes an active refresh token', async () => {
      const raw = 'logout-token';
      const tokenHash = createHash('sha256').update(raw).digest('hex');
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        revokedAt: null,
        tokenHash,
      });
      prisma.refreshToken.update.mockResolvedValue({});

      await expect(service.logout(raw)).resolves.toEqual({ success: true });
      expect(prisma.refreshToken.update).toHaveBeenCalled();
    });

    it('still returns success when token missing', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.logout('missing')).resolves.toEqual({
        success: true,
      });
    });
  });

  describe('GET /auth/me', () => {
    it('returns user profile fields', async () => {
      const profile = {
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        role: Role.CUSTOMER,
        createdAt: new Date(),
      };
      prisma.user.findUnique.mockResolvedValue(profile);
      await expect(service.me('u1')).resolves.toEqual(profile);
    });
  });
});
