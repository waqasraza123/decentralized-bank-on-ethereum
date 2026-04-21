import { createApiApp } from "../src/bootstrap/create-api-app";

type NodeRequest = {
  url?: string;
};

type NodeResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

type RequestHandler = (req: NodeRequest, res: NodeResponse) => void;

let handlerPromise: Promise<RequestHandler> | null = null;

function normalizeRequestUrl(request: NodeRequest) {
  if (typeof request.url !== "string") {
    request.url = "/";
    return;
  }

  if (request.url === "/api") {
    request.url = "/";
    return;
  }

  if (request.url.startsWith("/api/")) {
    request.url = request.url.slice(4) || "/";
  }
}

async function getHandler(): Promise<RequestHandler> {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const { app } = await createApiApp();

      await app.init();

      return app.getHttpAdapter().getInstance() as RequestHandler;
    })();
  }

  return handlerPromise;
}

export default async function handler(req: NodeRequest, res: NodeResponse) {
  try {
    normalizeRequestUrl(req);
    const appHandler = await getHandler();

    return appHandler(req, res);
  } catch (error) {
    console.error("vercel_api_bootstrap_failed", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        status: "failed",
        message: "API bootstrap failed."
      })
    );
  }
}
