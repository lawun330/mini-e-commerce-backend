import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // register a new user
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashed = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: { email: dto.email, password: hashed, name: dto.name },
    });

    // every new user gets an empty cart up front once authenticated
    await this.prisma.cart.create({ data: { userId: user.id } });

    return this.issueTokenPair(user.id, user.email, user.role);
  }

  // login a user
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokenPair(user.id, user.email, user.role);
  }

  /*
   * rotate the refresh token: validate the presented refresh token, revoke it, and issue a new pair.
   * if a revoked refresh token is reused, revoke all of that user's refresh tokens.
   */
  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(
      stored.user.id,
      stored.user.email,
      stored.user.role,
    );
  }

  // revoke the presented refresh token (logout the current session)
  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (stored && !stored.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
    }

    return { success: true };
  }

  // get the current authenticated user
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    return user;
  }

  // issue access JWT + opaque refresh token pair
  private async issueTokenPair(sub: string, email: string, role: string) {
    const accessToken = this.jwt.sign({ sub, email, role });

    const refreshToken = randomBytes(48).toString('hex');
    const tokenHash = hashToken(refreshToken);
    const expiresIn =
      this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN') ?? '7d';

    await this.prisma.refreshToken.create({
      data: {
        userId: sub,
        tokenHash,
        expiresAt: expiresAtFromDuration(expiresIn),
      },
    });

    return { accessToken, refreshToken };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// supports simple durations like 15m, 1h, 7d
function expiresAtFromDuration(
  duration: string,
  from: Date = new Date(),
): Date {
  // parse the duration string into a Date object
  const match = /^(\d+)([smhd])$/i.exec(duration.trim());
  if (!match) {
    // fallback: 7 days if the duration string is malformed
    return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  // parse the amount and unit
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const ms =
    unit === 's'
      ? amount * 1000
      : unit === 'm'
        ? amount * 60 * 1000
        : unit === 'h'
          ? amount * 60 * 60 * 1000
          : amount * 24 * 60 * 60 * 1000;

  return new Date(from.getTime() + ms);
}
