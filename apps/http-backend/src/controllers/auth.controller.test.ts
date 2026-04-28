import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signup, signin, logout, getCurrentUser, refreshAccessToken, forgotPassword, resetPassword } from './auth.controller';
import { Request, Response } from 'express';
import { prismaClient } from '@repo/db/client';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import * as passwordUtils from '../utils/password';
import * as tokenUtils from '../utils/token';
import jwt from 'jsonwebtoken';
import { sendPasswordResetEmail } from '../utils/email';
import { ApiError } from '../utils/ApiError';

vi.mock('@repo/db/client', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    return {
        prismaClient: mockDeep<any>(),
    };
});

vi.mock('../utils/password', () => ({
    hashPassword: vi.fn(),
    comparePassword: vi.fn(),
}));

vi.mock('../utils/token', () => ({
    generateAccessToken: vi.fn(),
    generateRefreshToken: vi.fn(),
    verifyToken: vi.fn(),
}));

vi.mock('../utils/email', () => ({
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('jsonwebtoken', () => ({
    default: {
        sign: vi.fn().mockReturnValue('mocked-jwt-token'),
        verify: vi.fn().mockReturnValue({ userId: 'user-1', type: 'password-reset' }),
    }
}));

describe('Auth Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: any;

    beforeEach(() => {
        mockReset(prismaClient as any);
        vi.clearAllMocks();
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            cookie: vi.fn().mockReturnThis(),
            clearCookie: vi.fn().mockReturnThis(),
        };
        next = vi.fn();
    });

    describe('signup', () => {
        it('should create a new user and set cookies', async () => {
            req = {
                body: {
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123',
                },
            };

            vi.mocked(passwordUtils.hashPassword).mockResolvedValue('hashed-password');
            vi.mocked(prismaClient.user.create).mockResolvedValue({
                id: 'user-1',
                name: 'Test User',
                email: 'test@example.com',
                handle: 'test-user',
                tokenVersion: 0,
            } as any);
            vi.mocked(tokenUtils.generateAccessToken).mockReturnValue('access-token');
            vi.mocked(tokenUtils.generateRefreshToken).mockReturnValue('refresh-token');

            await signup(req as Request, res as Response, next);

            expect(prismaClient.user.create).toHaveBeenCalled();
            expect(res.cookie).toHaveBeenCalledWith('accessToken', 'access-token', expect.any(Object));
            expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh-token', expect.any(Object));
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: 'User created successfully',
            }));
        });

        it('should return 409 if user already exists', async () => {
            req = {
                body: {
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123',
                },
            };

            const error = new Error('Unique constraint failed');
            (error as any).code = 'P2002';
            vi.mocked(prismaClient.user.create).mockRejectedValue(error);

            await signup(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: 'User already exists',
            }));
        });

        it('should return 400 for incorrect credentials', async () => {
            req = { body: {} };
            await signup(req as Request, res as Response, next);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('signin', () => {
        it('should login successfully with correct credentials', async () => {
            req = {
                body: {
                    email: 'test@example.com',
                    password: 'password123',
                },
            };

            vi.mocked(prismaClient.user.findUnique).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
                password: 'hashed-password',
                name: 'Test User',
                handle: 'test-user',
                tokenVersion: 0,
            } as any);
            vi.mocked(passwordUtils.comparePassword).mockResolvedValue(true);
            vi.mocked(tokenUtils.generateAccessToken).mockReturnValue('access-token');
            vi.mocked(tokenUtils.generateRefreshToken).mockReturnValue('refresh-token');

            await signin(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.cookie).toHaveBeenCalledWith('accessToken', 'access-token', expect.any(Object));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: 'Login successful',
            }));
        });

        it('should return 401 for invalid credentials', async () => {
            req = {
                body: {
                    email: 'test@example.com',
                    password: 'wrong-password',
                },
            };

            vi.mocked(prismaClient.user.findUnique).mockResolvedValue({
                password: 'hashed-password',
            } as any);
            vi.mocked(passwordUtils.comparePassword).mockResolvedValue(false);

            await signin(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Invalid credentials',
            }));
        });
    });

    describe('logout', () => {
        it('should clear cookies and increment token version', async () => {
            req = {
                userId: 'user-1',
            };

            await logout(req as Request, res as Response, next);

            expect(prismaClient.user.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'user-1' },
                data: expect.objectContaining({
                    tokenVersion: { increment: 1 },
                }),
            }));
            expect(res.clearCookie).toHaveBeenCalledWith('accessToken');
            expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('getCurrentUser', () => {
        it('should return current user profile', async () => {
            req = { userId: 'user-1' };
            vi.mocked(prismaClient.user.findUnique).mockResolvedValue({
                id: 'user-1',
                name: 'John',
                email: 'john@example.com',
                handle: 'john',
            } as any);

            await getCurrentUser(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({ email: 'john@example.com' }),
            }));
        });

        it('should generate handle if missing', async () => {
            req = { userId: 'user-1' };
            vi.mocked(prismaClient.user.findUnique).mockResolvedValue({
                id: 'user-1',
                name: 'New User',
                email: 'new@example.com',
                handle: null,
            } as any);
            // Mock allocateUniqueHandle indirectly by mocking findFirst for handle check
            vi.mocked(prismaClient.user.findFirst).mockResolvedValue(null);

            await getCurrentUser(req as Request, res as Response, next);

            expect(prismaClient.user.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ handle: 'new-user' })
            }));
        });
    });

    describe('refreshAccessToken', () => {
        it('should refresh access token with valid refresh token', async () => {
            req = { cookies: { refreshToken: 'valid-refresh' } };
            vi.mocked(tokenUtils.verifyToken).mockReturnValue({
                userId: 'user-1',
                type: 'refresh',
                tokenVersion: 0,
            } as any);
            vi.mocked(prismaClient.user.findUnique).mockResolvedValue({
                id: 'user-1',
                tokenVersion: 0,
                name: 'John',
            } as any);
            vi.mocked(tokenUtils.generateAccessToken).mockReturnValue('new-access-token');

            await refreshAccessToken(req as Request, res as Response, next);

            expect(res.cookie).toHaveBeenCalledWith('accessToken', 'new-access-token', expect.any(Object));
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should throw 401 if token version mismatch', async () => {
            req = { cookies: { refreshToken: 'valid-refresh' } };
            vi.mocked(tokenUtils.verifyToken).mockReturnValue({
                userId: 'user-1',
                type: 'refresh',
                tokenVersion: 0,
            } as any);
            vi.mocked(prismaClient.user.findUnique).mockResolvedValue({
                id: 'user-1',
                tokenVersion: 1, // Mismatch
            } as any);

            await refreshAccessToken(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(expect.any(ApiError));
            const error = vi.mocked(next).mock.calls[0]?.[0] as unknown as ApiError;
            expect(error.message).toBe('Token has been revoked');
        });
    });

    describe('forgotPassword', () => {
        it('should send reset email if user exists', async () => {
            req = { body: { email: 'test@example.com' } };
            vi.mocked(prismaClient.user.findUnique).mockResolvedValue({
                id: 'user-1',
                name: 'John',
                email: 'test@example.com',
            } as any);

            await forgotPassword(req as Request, res as Response, next);

            expect(sendPasswordResetEmail).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: { sent: true },
            }));
        });

        it('should return 200 even if user does not exist (security)', async () => {
            req = { body: { email: 'nonexistent@example.com' } };
            vi.mocked(prismaClient.user.findUnique).mockResolvedValue(null);

            await forgotPassword(req as Request, res as Response, next);

            expect(sendPasswordResetEmail).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('resetPassword', () => {
        it('should reset password with valid token', async () => {
            req = { body: { token: 'valid-reset-token', password: 'new-password-123' } };
            
            await resetPassword(req as Request, res as Response, next);

            expect(prismaClient.user.update).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should throw 400 for invalid token', async () => {
            req = { body: { token: 'invalid', password: 'new-password-123' } };
            vi.mocked(jwt.verify).mockImplementationOnce(() => { throw new Error(); });

            await resetPassword(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(expect.any(ApiError));
        });
    });
});
