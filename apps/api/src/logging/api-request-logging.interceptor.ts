import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import {
  REQUEST_ID_HEADER,
  resolveRequestActor,
  type ApiRequestContext,
  type ApiResponseLike
} from "./api-request-context";
import { ApiRequestMetricsService } from "./api-request-metrics.service";
import { writeStructuredApiLog } from "./structured-api-logger";

type LoggingResponse = ApiResponseLike & {
  statusCode: number;
  getHeader?: (name: string) => unknown;
};

@Injectable()
export class ApiRequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly apiRequestMetricsService: ApiRequestMetricsService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<ApiRequestContext>();
    const response = context.switchToHttp().getResponse<LoggingResponse>();
    const startedAt = Date.now();
    const actor = resolveRequestActor(request);
    const method = request.method ?? "UNKNOWN";
    const routePath =
      typeof request.route?.path === "string" ? request.route.path : null;
    const baseMetadata = {
      requestId: request.requestId ?? null,
      method,
      path: request.originalUrl ?? request.url,
      routePath,
      actorType: actor.actorType,
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      authSource: actor.authSource ?? null,
      operatorEnvironment: actor.environment ?? null,
      sessionCorrelationId: actor.sessionCorrelationId ?? null,
      userAgent:
        typeof request.headers["user-agent"] === "string"
          ? request.headers["user-agent"]
          : null,
      origin:
        typeof request.headers.origin === "string"
          ? request.headers.origin
          : null,
      remoteAddress: request.ip ?? null
    };
    this.apiRequestMetricsService.recordRequestStarted();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;
        this.apiRequestMetricsService.recordRequestCompleted({
          method,
          routePath,
          statusCode: response.statusCode,
          actorType: actor.actorType,
          durationMs
        });
        writeStructuredApiLog("info", "http_request_completed", {
          ...baseMetadata,
          statusCode: response.statusCode,
          durationMs,
          responseRequestId:
            typeof response.getHeader === "function"
              ? response.getHeader(REQUEST_ID_HEADER)
              : request.requestId ?? null
        });
      }),
      catchError((error: unknown) => {
        const statusCode =
          error instanceof HttpException
            ? error.getStatus()
            : response.statusCode >= 400
              ? response.statusCode
              : 500;
        const durationMs = Date.now() - startedAt;

        this.apiRequestMetricsService.recordRequestCompleted({
          method,
          routePath,
          statusCode,
          actorType: actor.actorType,
          durationMs
        });

        writeStructuredApiLog(
          statusCode >= 500 ? "error" : "warn",
          "http_request_failed",
          {
            ...baseMetadata,
            statusCode,
            durationMs,
            error
          }
        );

        return throwError(() => error);
      })
    );
  }
}
