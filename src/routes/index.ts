import express, { Express } from "express";

import healthRouter from "@routes/healthRouter";

const routes = (app: Express): void => {
  app.use(express.json());
  app.use("/api/v1/health", healthRouter);
};

export default routes;
