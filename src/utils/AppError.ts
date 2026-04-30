export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, opts: { statusCode: number; code: string; details?: unknown }) {
    super(message);
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.details = opts.details;
  }
}

