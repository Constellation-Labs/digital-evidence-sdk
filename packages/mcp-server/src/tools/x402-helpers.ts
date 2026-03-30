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
                "Sign an EIP-3009 TransferWithAuthorization using the offer details (see ded://docs/x402-payment for the three-step flow), " +
                "then re-invoke this tool with paymentSignature set to the base64-encoded PaymentPayload.",
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
