import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
import { formatPaymentOr } from "./x402-helpers.js";

export const name = "ded_search_fingerprints";
export const description =
  "Search fingerprints with filters. Requires API key or x402 payment. Supports pagination via cursor. Returns fingerprint summaries matching the search criteria.";

export const inputSchema = z.object({
  documentId: z.string().optional().describe("Filter by document ID"),
  eventId: z.string().uuid().optional().describe("Filter by event ID (UUID)"),
  documentRef: z.string().optional().describe("Filter by document reference"),
  datetimeStart: z
    .string()
    .optional()
    .describe("Start of date range (ISO 8601 datetime)"),
  datetimeEnd: z
    .string()
    .optional()
    .describe("End of date range (ISO 8601 datetime)"),
  tags: z
    .record(z.string())
    .optional()
    .describe("Filter by metadata tags (key-value pairs)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum results per page (1-100)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from a previous response"),
  forward: z
    .boolean()
    .default(true)
    .describe("Pagination direction: true for next page, false for previous"),
  paymentSignature: z
    .string()
    .optional()
    .describe(
      "Base64-encoded x402 PaymentPayload for pay-per-request (omit if using API key)"
    ),
});

export function register(client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const { paymentSignature, ...params } = args;
    const result = await client.searchFingerprints(params, paymentSignature);
    return formatPaymentOr(result);
  };
}
