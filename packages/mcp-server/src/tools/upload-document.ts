import { readFileSync } from "fs";
import { createHash } from "crypto";
import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
import type { FingerprintSubmission, DocumentInput } from "../types/fingerprint.js";
import { fingerprintSubmissionSchema } from "../types/fingerprint-schema.js";
import { formatPaymentOr } from "./x402-helpers.js";

export const name = "ded_upload_document";
export const description =
  "Upload documents with fingerprint submissions for storage. Each document is read from a local file path and linked to a fingerprint by documentRef. Requires API key or x402 payment. Chain: use ded_prepare_fingerprint first to build submissions, then pass them here along with file paths. The documentRef in each document must match a fingerprint's documentRef. After upload, use ded_track_fingerprint to monitor status.";

export const inputSchema = z.object({
  fingerprints: z
    .array(fingerprintSubmissionSchema)
    .min(1)
    .max(100)
    .describe("Array of fingerprint submissions (1-100)"),
  documents: z
    .array(
      z.object({
        documentRef: z
          .string()
          .describe("Must match a fingerprint's documentRef (hex-encoded SHA-256 hash)"),
        filePath: z
          .string()
          .describe("Absolute path to the file to upload"),
        contentType: z
          .string()
          .describe("MIME type (e.g. application/pdf)"),
      })
    )
    .min(1)
    .describe("Documents to upload, each linked to a fingerprint by documentRef"),
  paymentSignature: z
    .string()
    .optional()
    .describe(
      "Base64-encoded x402 PaymentPayload for pay-per-request (omit if using API key)"
    ),
});

export function register(client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const documents: DocumentInput[] = args.documents.map((doc) => {
      const fileBytes = readFileSync(doc.filePath);
      const hash = createHash("sha256").update(fileBytes).digest("hex");
      return {
        documentRef: doc.documentRef,
        contentBase64: fileBytes.toString("base64"),
        contentType: doc.contentType,
        expectedHash: hash,
      };
    });

    const result = await client.uploadDocuments(
      args.fingerprints as FingerprintSubmission[],
      documents,
      args.paymentSignature
    );
    return formatPaymentOr(result);
  };
}
