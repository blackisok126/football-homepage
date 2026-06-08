import { createMockMatchesResponse } from "../mockMatches.js";

export async function getMockMatchesPayload(options = {}) {
  return createMockMatchesResponse(options.message);
}

export async function getMockProviderRecords(options = {}) {
  const payload = createMockMatchesResponse(options.message);

  return {
    source: "mock-provider",
    sourceStatus: payload.sourceStatus,
    updatedAt: payload.updatedAt,
    records: payload.matches.map((match) => ({
      match,
      raw: {
        provider: "mock",
        generatedAt: payload.updatedAt,
        match,
      },
    })),
  };
}
