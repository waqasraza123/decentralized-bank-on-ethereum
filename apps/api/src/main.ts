import { createApiApp } from "./bootstrap/create-api-app";
import { writeStructuredApiLog } from "./logging/structured-api-logger";

async function bootstrap() {
  const { app, port } = await createApiApp();
  await app.listen(port);
  writeStructuredApiLog("info", "api_started", {
    port
  });
}

bootstrap();
