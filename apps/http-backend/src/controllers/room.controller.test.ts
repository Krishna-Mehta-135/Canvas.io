import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRoom,
  getShapes,
  replaceShapes,
  renameRoomSlug,
  getInviteLink,
  listMyRooms,
  getRoomChatBootstrap,
  getRoomIdFromSlug,
  getRoomByOwnerAndSlug,
  requestRoomAccess,
  listIncomingRoomAccessRequests,
  decideRoomAccessRequest,
  generateAiCanvas,
  getAiGenerateStatus,
  receiveAiResult,
} from "./room.controller";
import { Request, Response } from "express";
import { prismaClient } from "@repo/db/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { ApiError } from "../utils/ApiError";

// Mock the prismaClient
vi.mock("@repo/db/client", async () => {
  const { mockDeep } = await import("vitest-mock-extended");
  return {
    prismaClient: mockDeep<any>(),
  };
});

vi.mock("@repo/queue-sync", () => ({
  publishAiGenerateJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/backend-common/config", () => ({
  INTERNAL_SECRET: "test-secret",
}));

describe("Room Controller - createRoom", () => {
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

  it("should create a room successfully", async () => {
    req = {
      body: { slug: "test-room" },
      userId: "user-123",
    };

    const mockRoom = {
      id: 1,
      slug: "test-room",
      adminId: "user-123",
      admin: {
        handle: "johndoe",
        name: "John Doe",
      },
    };

    vi.mocked(prismaClient.room.create).mockResolvedValue(mockRoom as any);

    await createRoom(req as Request, res as Response, next);

    expect(prismaClient.room.create).toHaveBeenCalledWith({
      data: {
        slug: "test-room",
        adminId: "user-123",
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
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Room created successfully",
        data: expect.objectContaining({
          slug: "test-room",
          canonicalPath: "/room/johndoe/test-room",
        }),
      }),
    );
  });

  it("should return 400 for incorrect input (missing slug)", async () => {
    req = {
      body: {},
      userId: "user-123",
    };

    await createRoom(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Incorrect input",
      }),
    );
  });

  it("should return 409 if room slug already exists", async () => {
    req = {
      body: { slug: "existing-room" },
      userId: "user-123",
    };

    const prismaError = new Error("Unique constraint failed");
    (prismaError as any).code = "P2002";
    vi.mocked(prismaClient.room.create).mockRejectedValue(prismaError);

    await createRoom(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Room slug already exists for this user",
      }),
    );
  });

  it("should return 401 if user ID is missing", async () => {
    req = {
      body: { slug: "test-room" },
      userId: undefined,
    };

    await createRoom(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Unauthorized: User ID not found",
      }),
    );
  });
});

describe("Room Controller - getShapes", () => {
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

  it("should fetch shapes successfully", async () => {
    req = {
      params: { roomId: "1" },
      query: {},
      userId: "user-123",
    };

    // Mock hasRoomAccess check
    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({ id: 1 } as any);

    const mockShapes = [
      { id: "shape-1", type: "rect", props: { x: 10, y: 10 } },
      { id: "shape-2", type: "circle", props: { x: 50, y: 50 } },
    ];

    vi.mocked(prismaClient.shape.findMany).mockResolvedValue(
      mockShapes.map((s) => ({
        props: s,
        createdAt: new Date(),
      })) as any,
    );

    await getShapes(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          shapes: mockShapes,
        }),
      }),
    );
  });

  it("should use spatial filter when viewport is provided", async () => {
    req = {
      params: { roomId: "1" },
      query: { viewport: "0,0,100,100" },
      userId: "user-123",
    };

    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prismaClient.$queryRawUnsafe).mockResolvedValue([
      { props: { id: "s1", type: "rect" }, createdAt: new Date() },
    ] as any);

    await getShapes(req as Request, res as Response, next);

    expect(prismaClient.$queryRawUnsafe).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("should detect next page in spatial fetch", async () => {
    req = {
      params: { roomId: "1" },
      query: { viewport: "0,0,100,100", limit: "1" },
      userId: "user-123",
    };

    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prismaClient.$queryRawUnsafe).mockResolvedValue([
      { props: { id: "s1" }, createdAt: new Date() },
      { props: { id: "s2" }, createdAt: new Date() }, // Extra row
    ] as any);

    await getShapes(req as Request, res as Response, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nextCursor: expect.any(String) }),
      }),
    );
  });

  it("should return empty array on Prisma P2021 in getShapes", async () => {
    req = {
      params: { roomId: "1" },
      query: { limit: "50" },
      userId: "user-123",
    };
    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({ id: 1 } as any);
    const error = new Error("Table not found");
    (error as any).code = "P2021";
    vi.mocked(prismaClient.shape.findMany).mockRejectedValue(error);

    await getShapes(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ shapes: [] }),
      }),
    );
  });

  it("should return 403 if user does not have access", async () => {
    req = {
      params: { roomId: "1" },
      userId: "user-123",
    };

    // Mock hasRoomAccess check to return null (forbidden)
    vi.mocked(prismaClient.room.findFirst).mockResolvedValue(null);

    await getShapes(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Forbidden",
      }),
    );
  });
});

describe("Room Controller - replaceShapes", () => {
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

  it("should replace shapes successfully", async () => {
    req = {
      params: { roomId: "1" },
      body: { shapes: [{ id: "s1", type: "rect" }] },
      userId: "user-123",
    };

    // Mock owner check (assertOwnerRoomAccess)
    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({
      id: 1,
      adminId: "user-123",
    } as any);
    vi.mocked(prismaClient.$transaction).mockImplementation(
      async (cb: any) => await cb(prismaClient),
    );

    await replaceShapes(req as Request, res as Response, next);

    expect(prismaClient.shape.deleteMany).toHaveBeenCalledWith({
      where: { roomId: 1 },
    });
    expect(prismaClient.shape.createMany).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("should handle Prisma P2021 error", async () => {
    req = {
      params: { roomId: "1" },
      body: { shapes: [] },
      userId: "user-123",
    };
    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({
      id: 1,
      adminId: "user-123",
    } as any);
    const error = new Error("Table not found");
    (error as any).code = "P2021";
    vi.mocked(prismaClient.$transaction).mockRejectedValue(error);

    await replaceShapes(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });
});

describe("Room Controller - renameRoomSlug", () => {
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

  it("should rename room slug successfully", async () => {
    req = {
      params: { roomId: "1" },
      body: { slug: "new-slug" },
      userId: "user-123",
    };

    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({
      id: 1,
      adminId: "user-123",
    } as any);
    vi.mocked(prismaClient.room.update).mockResolvedValue({
      id: 1,
      slug: "new-slug",
      admin: { handle: "johndoe" },
    } as any);

    await renameRoomSlug(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ slug: "new-slug" }),
      }),
    );
  });
});

describe("Room Controller - getInviteLink", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: any;

  beforeEach(() => {
    mockReset(prismaClient as any);
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    req = {
      get: vi.fn().mockReturnValue("localhost:3001"),
    } as any;
    (req as any).protocol = "http";
    next = vi.fn();
  });

  it("should generate invite link", async () => {
    req.params = { roomId: "1" };
    req.userId = "user-123";

    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({
      id: 1,
      adminId: "user-123",
    } as any);
    vi.mocked(prismaClient.room.findUnique).mockResolvedValue({
      id: 1,
      slug: "test-room",
      admin: { handle: "johndoe", name: "John" },
    } as any);

    await getInviteLink(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          inviteLink: "http://localhost:3001/room/johndoe/test-room",
        }),
      }),
    );
  });
});

describe("Room Controller - listMyRooms", () => {
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

  it("should list user rooms", async () => {
    req = { userId: "user-123" };
    vi.mocked(prismaClient.room.findMany).mockResolvedValue([
      {
        id: 1,
        slug: "test",
        admin: { handle: "jh" },
      },
    ] as any);

    await listMyRooms(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
      }),
    );
  });
});

describe("Room Controller - requestRoomAccess", () => {
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

  it("should create access request", async () => {
    req = {
      userId: "user-requester",
      body: { ownerHandle: "owner", slug: "room", note: "please" },
    };

    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({
      id: 1,
      adminId: "owner-id",
    } as any);
    vi.mocked(prismaClient.roomMember.findUnique).mockResolvedValue(null);
    vi.mocked(prismaClient.roomAccessRequest.findUnique).mockResolvedValue(
      null,
    );
    vi.mocked(prismaClient.roomAccessRequest.create).mockResolvedValue({
      id: 10,
      status: "pending",
    } as any);

    await requestRoomAccess(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("Room Controller - decideRoomAccessRequest", () => {
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

  it("should approve access request", async () => {
    req = {
      userId: "owner-id",
      body: { requestId: 10, action: "approve" },
    };

    vi.mocked(prismaClient.roomAccessRequest.findUnique).mockResolvedValue({
      id: 10,
      status: "pending",
      requesterId: "user-requester",
      room: { id: 1, adminId: "owner-id" },
    } as any);
    vi.mocked(prismaClient.$transaction).mockImplementation(
      async (cb: any) => await cb(prismaClient),
    );

    await decideRoomAccessRequest(req as Request, res as Response, next);

    expect(prismaClient.roomMember.upsert).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("Room Controller - AI functions", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: any;

  beforeEach(() => {
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it("should start AI generation", async () => {
    req = {
      params: { roomId: "1" },
      userId: "user-1",
      body: { prompt: "generate a cat" },
    };
    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({ id: 1 } as any);

    await generateAiCanvas(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "AI generation started",
      }),
    );
  });

  it("should handle AI queue error", async () => {
    req = {
      params: { roomId: "1" },
      userId: "user-1",
      body: { prompt: "fail me" },
    };
    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({ id: 1 } as any);

    const { publishAiGenerateJob } = await import("@repo/queue-sync");
    vi.mocked(publishAiGenerateJob).mockRejectedValueOnce(
      new Error("Queue down"),
    );

    await generateAiCanvas(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it("should get AI job status", async () => {
    // Since we can't easily inject into the private map,
    // we'll rely on the job started in previous successful test if it was same process,
    // but vitest isolation might prevent that.
    // Let's call generateAiCanvas first in the same test.
    req = {
      params: { roomId: "1" },
      userId: "user-1",
      body: { prompt: "generate a cat" },
    };
    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({ id: 1 } as any);

    // This will populate the jobStore
    await generateAiCanvas(req as Request, res as Response, next);
    const mockedJson: any = vi.mocked(res.json);
    const calls = (mockedJson?.mock?.calls ?? []) as any[];
    const jobIdCall = calls[0]?.[0] as
      | { data?: { jobId?: string } }
      | undefined;
    const jobId = jobIdCall?.data?.jobId;
    if (!jobId) throw new Error("jobId not found in response");

    req.params = { roomId: "1", jobId };
    await getAiGenerateStatus(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Job status fetched",
      }),
    );
  });

  it("should receive AI result", async () => {
    // First start a job to have it in the in-memory store
    const jobId = "test-job-id";
    // We can't easily inject into the private map, but we can call generateAiCanvas first
    // or just call receiveAiResult and it might fail if job not found,
    // but we want to test the success path.
    // The jobStore is internal to the module.

    req = {
      headers: { "x-internal-secret": "test-secret" },
      body: { jobId: "some-job", shapes: [] },
    };

    await receiveAiResult(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("Room Controller - Lookups", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: any;

  beforeEach(() => {
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it("should get room id from slug", async () => {
    req = {
      params: { slug: "test-room" },
      userId: "user-1",
    };
    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({
      id: 1,
      slug: "test-room",
      admin: { handle: "jh" },
    } as any);

    await getRoomIdFromSlug(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("should get room by owner and slug", async () => {
    req = {
      params: { userHandle: "john-doe", slug: "test-room" },
      userId: "user-1",
    };
    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({
      id: 1,
      slug: "test-room",
      admin: { handle: "john-doe" },
    } as any);

    await getRoomByOwnerAndSlug(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("Room Controller - getRoomChatBootstrap", () => {
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

  it("should fetch chat bootstrap data with messages", async () => {
    req = {
      params: { roomId: "1" },
      userId: "user-1",
    };

    vi.mocked(prismaClient.room.findFirst).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prismaClient.room.findUnique).mockResolvedValue({
      id: 1,
      admin: { id: "admin-1", name: "Admin", handle: "admin", photo: null },
      members: [
        {
          user: {
            id: "member-1",
            name: "Member",
            handle: "member",
            photo: null,
          },
        },
      ],
    } as any);

    const mockChat = {
      id: 1,
      roomId: 1,
      message: "hello",
      messageType: "GROUP",
      createdAt: new Date(),
      user: { id: "admin-1", name: "Admin", handle: "admin", photo: null },
      recipient: null,
    };

    // Mock the 3 findMany calls for GROUP, DIRECT, COMMENT
    vi.mocked(prismaClient.chat.findMany)
      .mockResolvedValueOnce([mockChat] as any) // GROUP
      .mockResolvedValueOnce([]) // DIRECT
      .mockResolvedValueOnce([]); // COMMENT

    await getRoomChatBootstrap(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupMessages: expect.any(Array),
          participants: expect.any(Array),
        }),
      }),
    );
  });
});
