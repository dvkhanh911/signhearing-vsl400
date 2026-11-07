type Environment = Record<string, string | undefined>;

export function backendRewrites(environment: Environment = process.env) {
  // Vercel routes these paths to FastAPI in the top-level service route table.
  if (environment.VERCEL === "1") return [];
  const target = new URL(
    environment.LOCAL_BACKEND_URL ||
      environment.BACKEND_URL ||
      "http://127.0.0.1:8001",
  );
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.pathname !== "/" ||
    target.search ||
    target.hash ||
    target.username ||
    target.password
  ) {
    throw new Error("LOCAL_BACKEND_URL must be an HTTP(S) origin.");
  }
  return ["/login", "/app/:path*", "/static/:path*", "/api/:path*"].map(
    (source) => ({ source, destination: `${target.origin}${source}` }),
  );
}

export function siteOrigin(environment: Environment = process.env): URL {
  const vercelHost =
    (environment.VERCEL_ENV === "production"
      ? environment.VERCEL_PROJECT_PRODUCTION_URL
      : environment.VERCEL_URL) ||
    environment.VERCEL_URL ||
    environment.VERCEL_PROJECT_PRODUCTION_URL;
  const value = environment.SITE_URL || (vercelHost && `https://${vercelHost}`);
  if (!value && environment.VERCEL === "1") {
    throw new Error(
      "Set SITE_URL or enable Vercel system environment variables.",
    );
  }
  const url = new URL(value || "http://localhost:3000");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (environment.VERCEL === "1" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  ) {
    throw new Error("SITE_URL must point to the public HTTP(S) site origin.");
  }
  return new URL(url.origin);
}
