import { ApiRequestMetricsService } from "./api-request-metrics.service";

describe("ApiRequestMetricsService", () => {
  it("tracks in-flight requests, totals, and duration buckets", () => {
    const service = new ApiRequestMetricsService();

    service.recordRequestStarted();
    service.recordRequestCompleted({
      method: "get",
      routePath: "/health",
      statusCode: 200,
      actorType: "anonymous",
      durationMs: 120
    });

    const metrics = service.renderPrometheusMetrics();

    expect(metrics).toContain("stb_api_http_requests_in_flight 0");
    expect(metrics).toContain(
      'stb_api_http_requests_total{method="GET",route="/health",status_class="2xx",actor_type="anonymous"} 1'
    );
    expect(metrics).toContain(
      'stb_api_http_request_duration_seconds_bucket{method="GET",route="/health",status_class="2xx",actor_type="anonymous",le="0.25"} 1'
    );
    expect(metrics).toContain(
      'stb_api_http_request_duration_seconds_count{method="GET",route="/health",status_class="2xx",actor_type="anonymous"} 1'
    );
  });
});
