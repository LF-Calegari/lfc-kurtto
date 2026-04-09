import { NextFunction, Request, Response } from "express";

import { env } from "@config/env";

class HealthController {
  public async check(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.status(200).json({
        status: "ok",
        message: "API is running",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new HealthController();
