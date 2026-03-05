import { hashDocument } from "@constellation-network/digital-evidence-sdk";
import { z } from "zod";

export const name = "ded_hash_document";
export const description =
  "Compute the SHA-256 hash of arbitrary text content. Returns the same hash format used as documentId in fingerprint submissions.";

export const inputSchema = z.object({
  content: z.string().describe("The raw text content to hash"),
});

export function register() {
  return async (args: z.infer<typeof inputSchema>) => {
    const hash = hashDocument(args.content);
    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ hash }, null, 2) },
      ],
    };
  };
}
