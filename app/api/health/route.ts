export function GET() {
  return Response.json(
    { status: "ok", service: "lendloop-web" },
    { headers: { "cache-control": "no-store" } },
  );
}
