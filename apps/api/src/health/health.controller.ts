import { Controller, Get } from "@nestjs/common";
import { CustomJsonResponse } from "../types/CustomJsonResponse";

function buildHealthPayload(check: "health" | "readiness"): CustomJsonResponse {
  return {
    status: "success",
    message:
      check === "health"
        ? "API health check passed."
        : "API readiness check passed.",
    data: {
      status: "healthy",
      check
    }
  };
}

@Controller()
export class HealthController {
  @Get("healthz")
  getHealth(): CustomJsonResponse {
    return buildHealthPayload("health");
  }

  @Get("readyz")
  getReadiness(): CustomJsonResponse {
    return buildHealthPayload("readiness");
  }
}
