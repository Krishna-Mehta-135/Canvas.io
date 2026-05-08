import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "./app";

vi.mock("@repo/redis-sync", () => ({
  checkRedisRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    limit: 100,
    remaining: 99,
    resetAtMs: Date.now() + 60000,
  }),
}));

vi.mock("@repo/db/client", () => ({
  prismaClient: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("CORS Configuration", () => {
  it("should allow localhost origins", async () => {
    const response = await request(app)
      .get("/")
      .set("Origin", "http://localhost:3000");
    
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("should allow canvassync.tech", async () => {
    const response = await request(app)
      .get("/")
      .set("Origin", "https://canvassync.tech");
    
    expect(response.headers["access-control-allow-origin"]).toBe("https://canvassync.tech");
  });

  it("should allow vercel preview deployments", async () => {
    const response = await request(app)
      .get("/")
      .set("Origin", "https://my-app-git-main-my-team.vercel.app");
    
    expect(response.headers["access-control-allow-origin"]).toBe("https://my-app-git-main-my-team.vercel.app");
  });

  it("should deny unauthorized origins", async () => {
    const response = await request(app)
      .get("/")
      .set("Origin", "https://malicious-site.com");
    
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
