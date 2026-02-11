/**
 * DED SDK error hierarchy.
 *
 * All SDK errors extend DedSdkError so consumers can catch broadly
 * or narrowly depending on their needs.
 */

export class DedSdkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DedSdkError';
  }
}

export class ValidationError extends DedSdkError {
  constructor(
    message: string,
    public readonly issues: Array<{ path: string; message: string }> = [],
    cause?: unknown
  ) {
    super(message, cause);
    this.name = 'ValidationError';
  }
}

export class SigningError extends DedSdkError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'SigningError';
  }
}
