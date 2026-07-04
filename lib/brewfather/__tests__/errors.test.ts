/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import { BrewfatherError } from "@/lib/brewfather/client";
import { classifyUpstreamError } from "@/lib/brewfather/errors";

describe("classifyUpstreamError", () => {
  it("maps 401/403 to reconnect", () => {
    expect(classifyUpstreamError(new BrewfatherError("nope", 401))).toBe("reconnect");
    expect(classifyUpstreamError(new BrewfatherError("nope", 403))).toBe("reconnect");
  });

  it("maps 429 to rate_limited", () => {
    expect(classifyUpstreamError(new BrewfatherError("slow down", 429))).toBe(
      "rate_limited"
    );
  });

  it("maps everything else to upstream", () => {
    expect(classifyUpstreamError(new BrewfatherError("boom", 500))).toBe("upstream");
    expect(classifyUpstreamError(new BrewfatherError("no status"))).toBe("upstream");
    expect(classifyUpstreamError(new Error("network"))).toBe("upstream");
    expect(classifyUpstreamError("weird")).toBe("upstream");
  });
});
