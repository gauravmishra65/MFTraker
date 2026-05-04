import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/errors";
import { logger } from "../utils/logger";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "ValidationError",
      message: "Invalid input",
      issues: err.errors
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.constructor.name,
      message: err.message,
      details: err.details
    });
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "InternalServerError", message: "Something went wrong" });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "NotFound", message: "Route not found" });
}
