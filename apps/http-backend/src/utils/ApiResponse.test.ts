import { describe, it, expect } from "vitest";
import { ApiResponse } from "./ApiResponse";

describe("ApiResponse", () => {
  it("should create a successful response", () => {
    const data = { foo: "bar" };
    const response = new ApiResponse(200, data, "Success");
    expect(response.statusCode).toBe(200);
    expect(response.data).toEqual(data);
    expect(response.message).toBe("Success");
    expect(response.success).toBe(true);
  });
});
