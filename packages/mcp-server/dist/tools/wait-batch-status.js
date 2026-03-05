import { z } from "zod";
export const name = "ded_wait_batch_status";
export const description = "Wait for a batch to reach a terminal status (FINALIZED_COMMITMENT or ERRORED_COMMITMENT). Holds the connection open, polling every 3 seconds until resolved or timeout. Max wait: 60 seconds.";
export const inputSchema = z.object({
    batchId: z.string().uuid().describe("The UUID of the batch to poll"),
    maxWaitSeconds: z
        .number()
        .int()
        .min(3)
        .max(60)
        .default(60)
        .describe("Maximum time to wait in seconds (default 60, max 60)"),
});
const TERMINAL_STATUSES = ["FINALIZED_COMMITMENT", "ERRORED_COMMITMENT"];
const POLL_INTERVAL_MS = 3000;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function register(client) {
    return async (args) => {
        const deadline = Date.now() + args.maxWaitSeconds * 1000;
        while (Date.now() < deadline) {
            const batch = await client.getBatch(args.batchId);
            if (!batch) {
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
            if (TERMINAL_STATUSES.includes(batch.status)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(batch, null, 2),
                        },
                    ],
                };
            }
            const remaining = deadline - Date.now();
            if (remaining < POLL_INTERVAL_MS)
                break;
            await sleep(POLL_INTERVAL_MS);
        }
        const finalCheck = await client.getBatch(args.batchId);
        return {
            content: [
                {
                    type: "text",
                    text: `Timed out after ${args.maxWaitSeconds}s — current status: ${finalCheck?.status ?? "unknown"}`,
                },
            ],
        };
    };
}
//# sourceMappingURL=wait-batch-status.js.map