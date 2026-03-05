import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_download_document";
export const description =
  "Get a presigned download URL for a document attached to a fingerprint event. This is a public endpoint — no API key required.";

export const inputSchema = z.object({
  eventId: z.string().uuid().describe("The event ID of the fingerprint"),
});

export function register(client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const result = await client.downloadDocument(args.eventId);
    if (!result) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No document found for event ID ${args.eventId}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  };
}
