export function GET() {
  return Response.json(
    { status: "unavailable", code: "BACKEND_NOT_CONFIGURED" },
    {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "300" },
    },
  );
}

export const HEAD = GET;
