import { ErrorRequestHandler } from "express";

import { env } from "@config/env";

const errorHandler: ErrorRequestHandler = (err, _req, res, _next): void => {
  console.error("[error]", err, { hasNext: typeof _next === "function" });

  const isProduction = env.NODE_ENV === "production";

  res.status(500).json({
    message: "Internal server error",
    ...(isProduction ? {} : { details: err.message })
  });
};

export default errorHandler;
