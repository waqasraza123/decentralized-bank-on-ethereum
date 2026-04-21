import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { HealthController } from "./health.controller";
import { createIntegrationTestApp } from "../test-utils/create-integration-test-app";

describe("HealthController", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const result = await createIntegrationTestApp({
      controllers: [HealthController]
    });

    app = result.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a healthy health check payload", async () => {
    const response = await request(app.getHttpServer()).get("/healthz").expect(200);

    expect(response.body).toEqual({
      status: "success",
      message: "API health check passed.",
      data: {
        status: "healthy",
        check: "health"
      }
    });
  });

  it("returns a healthy readiness payload", async () => {
    const response = await request(app.getHttpServer()).get("/readyz").expect(200);

    expect(response.body).toEqual({
      status: "success",
      message: "API readiness check passed.",
      data: {
        status: "healthy",
        check: "readiness"
      }
    });
  });
});
