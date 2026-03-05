import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_download_document";
export declare const description = "Get a presigned download URL for a document attached to a fingerprint event. This is a public endpoint \u2014 no API key required.";
export declare const inputSchema: z.ZodObject<{
    eventId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    eventId: string;
}, {
    eventId: string;
}>;
export declare function register(client: DedApiClient): (args: z.infer<typeof inputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
} | {
    content: {
        type: "text";
        text: string;
    }[];
    isError?: undefined;
}>;
//# sourceMappingURL=download-document.d.ts.map