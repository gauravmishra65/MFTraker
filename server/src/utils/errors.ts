export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const BadRequest = (msg: string, d?: unknown) => new HttpError(400, msg, d);
export const Unauthorized = (msg = "Unauthorized") => new HttpError(401, msg);
export const Forbidden = (msg = "Forbidden") => new HttpError(403, msg);
export const NotFound = (msg = "Not found") => new HttpError(404, msg);
export const Conflict = (msg: string) => new HttpError(409, msg);
export const TooMany = (msg = "Too many requests") => new HttpError(429, msg);
