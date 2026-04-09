import express from "express";

import errorHandler from "@middlewares/errorHandler";
import routes from "@routes/index";
import swagger from "./swagger/index.js";

const app = express();

swagger(app);
routes(app);

app.use((_req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

app.use(errorHandler);

export default app;
