import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req
} from "@nestjs/common";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { ClientObservabilityService } from "./client-observability.service";
import { RecordClientTelemetryDto } from "./dto/record-client-telemetry.dto";

@Controller("client-observability")
export class ClientObservabilityController {
  constructor(
    private readonly clientObservabilityService: ClientObservabilityService
  ) {}

  @Post("events")
  @HttpCode(202)
  async recordTelemetry(
    @Body() body: RecordClientTelemetryDto,
    @Req() request: {
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
    }
  ): Promise<CustomJsonResponse> {
    const result = await this.clientObservabilityService.recordTelemetry(body, {
      requestId:
        typeof request.headers?.["x-request-id"] === "string"
          ? request.headers["x-request-id"]
          : null,
      origin:
        typeof request.headers?.origin === "string"
          ? request.headers.origin
          : null,
      referer:
        typeof request.headers?.referer === "string"
          ? request.headers.referer
          : null,
      userAgent:
        typeof request.headers?.["user-agent"] === "string"
          ? request.headers["user-agent"]
          : null,
      remoteAddress: request.ip ?? null
    });

    return {
      status: "success",
      message: "Client telemetry recorded successfully.",
      data: result
    };
  }
}
