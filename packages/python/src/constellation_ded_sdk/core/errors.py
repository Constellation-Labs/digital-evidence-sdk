"""DED SDK error hierarchy."""


class DedSdkError(Exception):
    """Base error for all DED SDK operations."""

    def __init__(self, message: str, cause: Exception | None = None) -> None:
        super().__init__(message)
        self.cause = cause


class ValidationError(DedSdkError):
    """Raised when a fingerprint submission fails validation."""

    def __init__(
        self,
        message: str,
        issues: list[dict[str, str]] | None = None,
        cause: Exception | None = None,
    ) -> None:
        super().__init__(message, cause)
        self.issues = issues or []


class SigningError(DedSdkError):
    """Raised when signing a fingerprint value fails."""
