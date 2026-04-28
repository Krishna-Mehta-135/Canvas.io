import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoom, getShapes } from './room.controller';
import { Request, Response } from 'express';
import { prismaClient } from '@repo/db/client';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// Mock the prismaClient
vi.mock('@repo/db/client', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    return {
        prismaClient: mockDeep<any>(),
    };
});

describe('Room Controller - createRoom', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: any;

    beforeEach(() => {
        mockReset(prismaClient as any);
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };
        next = vi.fn();
    });

    it('should create a room successfully', async () => {
        req = {
            body: { slug: 'test-room' },
            userId: 'user-123',
        };

        const mockRoom = {
            id: 1,
            slug: 'test-room',
            adminId: 'user-123',
            admin: {
                handle: 'johndoe',
                name: 'John Doe',
            },
        };

        vi.mocked(prismaClient.room.create).mockResolvedValue(mockRoom as any);

        await createRoom(req as Request, res as Response, next);

        expect(prismaClient.room.create).toHaveBeenCalledWith({
            data: {
                slug: 'test-room',
                adminId: 'user-123',
            },
            include: {
                admin: {
                    select: {
                        handle: true,
                        name: true,
                    },
                },
            },
        });

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: 'Room created successfully',
            data: expect.objectContaining({
                slug: 'test-room',
                canonicalPath: '/room/johndoe/test-room',
            }),
        }));
    });

    it('should return 400 for incorrect input (missing slug)', async () => {
        req = {
            body: {},
            userId: 'user-123',
        };

        await createRoom(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Incorrect input',
        }));
    });

    it('should return 409 if room slug already exists', async () => {
        req = {
            body: { slug: 'existing-room' },
            userId: 'user-123',
        };

        const prismaError = new Error('Unique constraint failed');
        (prismaError as any).code = 'P2002';
        vi.mocked(prismaClient.room.create).mockRejectedValue(prismaError);

        await createRoom(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Room slug already exists for this user',
        }));
    });

    it('should return 401 if user ID is missing', async () => {
        req = {
            body: { slug: 'test-room' },
            userId: undefined,
        };

        await createRoom(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Unauthorized: User ID not found',
        }));
    });
});

describe('Room Controller - getShapes', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: any;

    beforeEach(() => {
        mockReset(prismaClient as any);
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };
        next = vi.fn();
    });

    it('should fetch shapes successfully', async () => {
        req = {
            params: { roomId: '1' },
            query: {},
            userId: 'user-123',
        };

        // Mock hasRoomAccess check
        vi.mocked(prismaClient.room.findFirst).mockResolvedValue({ id: 1 } as any);

        const mockShapes = [
            { id: 'shape-1', type: 'rect', props: { x: 10, y: 10 } },
            { id: 'shape-2', type: 'circle', props: { x: 50, y: 50 } },
        ];

        vi.mocked(prismaClient.shape.findMany).mockResolvedValue(mockShapes.map(s => ({
            props: s,
            createdAt: new Date(),
        })) as any);

        await getShapes(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                shapes: mockShapes,
            }),
        }));
    });

    it('should return 403 if user does not have access', async () => {
        req = {
            params: { roomId: '1' },
            userId: 'user-123',
        };

        // Mock hasRoomAccess check to return null (forbidden)
        vi.mocked(prismaClient.room.findFirst).mockResolvedValue(null);

        await getShapes(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Forbidden',
        }));
    });
});
