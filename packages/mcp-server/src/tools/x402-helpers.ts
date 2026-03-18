import type { PaymentOr } from "../types/api.js";

export function formatPaymentOr<T>(result: PaymentOr<T>) {
  if (result.kind === "payment_required") {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              x402PaymentRequired: true,
              ...result.payment,
              instructions:
                "Authorize payment for the amount shown, then re-invoke this tool with paymentSignature set to the base64-encoded PaymentPayload. See ded://docs/x402-payment for details.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(result.data, null, 2) },
    ],
  };
}
