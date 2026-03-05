import { z } from "zod";
export const name = "ded_get_batch_fingerprints";
export const description = "Get all fingerprints in a batch by batch ID. Returns summary information for each fingerprint.";
export const inputSchema = z.object({
    batchId: z.string().uuid().describe("The UUID of the batch"),
});
export function register(client) {
    return async (args) => {
        const result = await client.getBatchFingerprints(args.batchId);
        if (!result) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Batch not found: ${args.batchId}`,
                    },
                ],
                isError: true,
            };
        }
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    };
}
//# sourceMappingURL=get-batch-fingerprints.js.map