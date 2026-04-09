import { NextFunction, Request, Response } from "express";

import { env } from "@config/env";

const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Keep fourth argument to preserve Express error-handler signature.
  void _next;

  console.error("[error]", err);

  const isProduction = env.NODE_ENV === "production";

  res.status(500).json({
    message: "Internal server error",
    ...(isProduction ? {} : { details: err.message })
  });
};

export default errorHandler;
