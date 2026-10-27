/** Base class for every error the library throws. `status` is the HTTP status, or undefined when WuloPay wasn't reached. */
export class WuloPayError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = new.target.name
    this.status = status
  }
}

/** 400: the request was invalid; the message says why. */
export class InvalidRequestError extends WuloPayError {}
/** 401: the API key or secret is wrong or revoked. */
export class AuthenticationError extends WuloPayError {}
/** 403: the API key lacks the scope this call needs. */
export class PermissionError extends WuloPayError {}
/** 404: no such checkout session for this merchant. */
export class NotFoundError extends WuloPayError {}
/** 409: the request conflicts with the current state (e.g. refunding an unpaid session). */
export class ConflictError extends WuloPayError {}
/** The API couldn't be reached (network error or timeout). Safe to retry with the same idempotency key. */
export class ApiConnectionError extends WuloPayError {}
/** A webhook signature is missing, malformed, stale or doesn't match. */
export class SignatureVerificationError extends WuloPayError {}

/** 429: too many requests; wait `retryAfter` seconds (when known) and retry. */
export class RateLimitError extends WuloPayError {
  readonly retryAfter: number | undefined

  constructor(message: string, retryAfter?: number) {
    super(message, 429)
    this.retryAfter = retryAfter
  }
}
