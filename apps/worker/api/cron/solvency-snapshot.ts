import {
  authorizeCronRequest,
  createCronFailureResponse,
  executeWorkerCronJob,
} from "../../src/vercel/worker-cron";

export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const unauthorizedResponse = authorizeCronRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const result = await executeWorkerCronJob({
      runSolvencySnapshot: true,
    });

    return Response.json({
      ok: true,
      result,
    });
  } catch (error) {
    return createCronFailureResponse(error);
  }
}
