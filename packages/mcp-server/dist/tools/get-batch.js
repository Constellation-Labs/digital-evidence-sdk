import { z } from "zod";
export const name = "ded_get_batch";
export const description = "Get batch details by ID including status, snapshot hashes, MPT root, and retry count. Batch statuses: NEW, PENDING_COMMITMENT, FINALIZED_COMMITMENT, ERRORED_COMMITMENT.";
export const inputSchema = z.object({
    batchId: z.string().uuid().describe("The UUID of the batch"),
});
export function register(client) {
    return async (args) => {
        const result = await client.getBatch(args.batchId);
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
//# sourceMappingURL=get-batch.js.map