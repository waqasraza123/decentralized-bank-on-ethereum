import { Injectable } from "@nestjs/common";

const HTTP_DURATION_BUCKETS_SECONDS = [
  0.01,
  0.05,
  0.1,
  0.25,
  0.5,
  1,
  2.5,
  5,
  10
] as const;

type RequestMetricLabels = {
  method: string;
  route: string;
  statusClass: string;
  actorType: string;
};

type RequestMetricBucketState = {
  labels: RequestMetricLabels;
  count: number;
  sumSeconds: number;
  bucketCounts: number[];
};

function normalizeLabelValue(value: string): string {
  return value.trim() || "unknown";
}

function buildLabelKey(labels: RequestMetricLabels): string {
  return [
    labels.method,
    labels.route,
    labels.statusClass,
    labels.actorType
  ].join("|");
}

function escapePrometheusLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function formatMetricLine(
  name: string,
  value: number,
  labels?: Record<string, string>
): string {
  if (!labels || Object.keys(labels).length === 0) {
    return `${name} ${Number.isFinite(value) ? value : 0}`;
  }

  const serializedLabels = Object.entries(labels)
    .map(([label, labelValue]) => `${label}="${escapePrometheusLabelValue(labelValue)}"`)
    .join(",");

  return `${name}{${serializedLabels}} ${Number.isFinite(value) ? value : 0}`;
}

@Injectable()
export class ApiRequestMetricsService {
  private inFlightRequests = 0;
  private readonly requestTotals = new Map<
    string,
    {
      labels: RequestMetricLabels;
      count: number;
    }
  >();
  private readonly requestDurations = new Map<string, RequestMetricBucketState>();

  recordRequestStarted(): void {
    this.inFlightRequests += 1;
  }

  recordRequestCompleted(args: {
    method: string;
    routePath: string | null;
    statusCode: number;
    actorType: string;
    durationMs: number;
  }): void {
    this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);

    const labels: RequestMetricLabels = {
      method: normalizeLabelValue(args.method.toUpperCase()),
      route: normalizeLabelValue(args.routePath ?? "unmatched"),
      statusClass: `${Math.floor(args.statusCode / 100)}xx`,
      actorType: normalizeLabelValue(args.actorType)
    };
    const key = buildLabelKey(labels);

    const existingTotal = this.requestTotals.get(key);
    if (existingTotal) {
      existingTotal.count += 1;
    } else {
      this.requestTotals.set(key, {
        labels,
        count: 1
      });
    }

    const durationSeconds = Math.max(args.durationMs, 0) / 1000;
    const existingDuration = this.requestDurations.get(key);

    if (existingDuration) {
      existingDuration.count += 1;
      existingDuration.sumSeconds += durationSeconds;

      for (let index = 0; index < HTTP_DURATION_BUCKETS_SECONDS.length; index += 1) {
        if (durationSeconds <= HTTP_DURATION_BUCKETS_SECONDS[index]) {
          existingDuration.bucketCounts[index] += 1;
        }
      }

      return;
    }

    const bucketCounts = HTTP_DURATION_BUCKETS_SECONDS.map((bucket) =>
      durationSeconds <= bucket ? 1 : 0
    );

    this.requestDurations.set(key, {
      labels,
      count: 1,
      sumSeconds: durationSeconds,
      bucketCounts
    });
  }

  renderPrometheusMetrics(): string {
    const lines: string[] = [
      "# HELP stb_api_http_requests_in_flight Current number of in-flight HTTP requests.",
      "# TYPE stb_api_http_requests_in_flight gauge",
      formatMetricLine(
        "stb_api_http_requests_in_flight",
        this.inFlightRequests
      ),
      "# HELP stb_api_http_requests_total Total completed HTTP requests.",
      "# TYPE stb_api_http_requests_total counter"
    ];

    for (const entry of this.requestTotals.values()) {
      lines.push(
        formatMetricLine("stb_api_http_requests_total", entry.count, {
          method: entry.labels.method,
          route: entry.labels.route,
          status_class: entry.labels.statusClass,
          actor_type: entry.labels.actorType
        })
      );
    }

    lines.push(
      "# HELP stb_api_http_request_duration_seconds Request duration histogram in seconds.",
      "# TYPE stb_api_http_request_duration_seconds histogram"
    );

    for (const entry of this.requestDurations.values()) {
      for (let index = 0; index < HTTP_DURATION_BUCKETS_SECONDS.length; index += 1) {
        lines.push(
          formatMetricLine(
            "stb_api_http_request_duration_seconds_bucket",
            entry.bucketCounts[index],
            {
              method: entry.labels.method,
              route: entry.labels.route,
              status_class: entry.labels.statusClass,
              actor_type: entry.labels.actorType,
              le: HTTP_DURATION_BUCKETS_SECONDS[index].toString()
            }
          )
        );
      }

      lines.push(
        formatMetricLine(
          "stb_api_http_request_duration_seconds_bucket",
          entry.count,
          {
            method: entry.labels.method,
            route: entry.labels.route,
            status_class: entry.labels.statusClass,
            actor_type: entry.labels.actorType,
            le: "+Inf"
          }
        ),
        formatMetricLine(
          "stb_api_http_request_duration_seconds_sum",
          entry.sumSeconds,
          {
            method: entry.labels.method,
            route: entry.labels.route,
            status_class: entry.labels.statusClass,
            actor_type: entry.labels.actorType
          }
        ),
        formatMetricLine(
          "stb_api_http_request_duration_seconds_count",
          entry.count,
          {
            method: entry.labels.method,
            route: entry.labels.route,
            status_class: entry.labels.statusClass,
            actor_type: entry.labels.actorType
          }
        )
      );
    }

    return `${lines.join("\n")}\n`;
  }
}
