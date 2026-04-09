import {
  Express,
  NextFunction,
  Request,
  Response,
  static as expressStatic
} from "express";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);

const packageJson = JSON.parse(
  readFileSync(path.join(currentDirPath, "../../package.json"), "utf8")
) as { version: string };

const getApiPaths = (): string[] => {
  const isDevelopment = process.env.NODE_ENV !== "production";

  if (isDevelopment) {
    return [
      path.resolve(currentDirPath, "../../src/routes/**/*.ts"),
      path.resolve(currentDirPath, "../../src/controllers/**/*.ts")
    ];
  }

  return [
    path.resolve(currentDirPath, "../../dist/routes/**/*.js"),
    path.resolve(currentDirPath, "../../dist/controllers/**/*.js")
  ];
};

const createSwaggerSpec = (basePath: string) =>
  swaggerJSDoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Kurtto Service API",
        version: packageJson.version,
        description: "API de servicos do Kurtto"
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      },
      security: [{ bearerAuth: [] }],
      servers: [
        {
          url: basePath,
          description: "API v1"
        }
      ],
      tags: [
        {
          name: "Monitoramento",
          description: "Endpoints de monitoramento e diagnostico"
        }
      ]
    },
    apis: getApiPaths()
  });

const swagger = (app: Express): void => {
  app.use("/swagger-static", expressStatic(currentDirPath));

  app.use(
    "/api/v1/documentation",
    swaggerUi.serve,
    (req: Request, res: Response, next: NextFunction): void => {
      const basePath = (req as Request & { basePath?: string }).basePath ?? "/";
      const swaggerSpec = createSwaggerSpec(basePath);

      swaggerUi.setup(swaggerSpec)(req, res, next);
    }
  );
};

export default swagger;
