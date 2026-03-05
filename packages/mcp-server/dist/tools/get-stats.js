import { z } from "zod";
export const name = "ded_get_stats";
export const description = "Get platform-wide fingerprint statistics including counts for the last 24 hours, 30 days, and all time.";
export const inputSchema = z.object({});
export function register(client) {
    return async (_args) => {
        const stats = await client.getStats();
        return {
            content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
        };
    };
}
//# sourceMappingURL=get-stats.js.map