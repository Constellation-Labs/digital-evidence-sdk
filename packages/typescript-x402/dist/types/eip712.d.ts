/**
 * EIP-712 domain construction and EIP-3009 TransferWithAuthorization signing.
 */
import type { Eip712Domain, PaymentOffer, TransferAuthorization, X402PaymentRequired, X402Signer } from './types';
/** EIP-712 type definitions for EIP-3009 TransferWithAuthorization */
export declare const TRANSFER_WITH_AUTHORIZATION_TYPES: Record<string, Array<{
    name: string;
    type: string;
}>>;
/**
 * Build the EIP-712 domain from a payment offer.
 * Extracts chainId from the CAIP-2 network identifier (e.g. "eip155:84532" -> 84532).
 */
export declare function buildEip3009Domain(offer: PaymentOffer): Eip712Domain;
/** Build the TransferWithAuthorization message struct. */
export declare function buildAuthorization(fromAddress: string, offer: PaymentOffer, validForSeconds?: number): TransferAuthorization;
/**
 * Parse a 402 response to extract payment requirements.
 * Tries the JSON body first, then falls back to the X-PAYMENT-REQUIRED header.
 */
export declare function parsePaymentRequired(response: Response): Promise<X402PaymentRequired | null>;
/**
 * Sign an x402 payment and return the base64-encoded X-PAYMENT header value.
 *
 * Performs the full EIP-3009 TransferWithAuthorization signing flow.
 */
export declare function buildPaymentHeader(offer: PaymentOffer, signer: X402Signer, validForSeconds?: number): Promise<string>;
