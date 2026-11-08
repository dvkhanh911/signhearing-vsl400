"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { ArrowUpRight } from "lucide-react";
import { publicSupabaseConfig } from "@/lib/supabase-config";

export function SessionLink({
  locale,
  label,
  ...props
}: { locale: "vi" | "en"; label: string } & ComponentProps<"a">) {
  const [signedIn, setSignedIn] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const config = publicSupabaseConfig();
    async function sync() {
      try {
        const options = {
          credentials: "same-origin" as const,
          cache: "no-store" as const,
          signal: controller.signal,
        };
        const [settings, session] = await Promise.all([
          fetch("/api/auth/config", options),
          fetch("/api/auth/session", options),
        ]);
        if (settings.ok) {
          const backend = await settings.json();
          setMismatch(
            Boolean(
              config.url &&
              config.publishableKey &&
              (config.url !== backend.url ||
                config.publishableKey !== backend.publishable_key),
            ),
          );
        }
        setSignedIn(session.ok);
      } catch {
        /* The public landing remains available during an API outage. */
      }
    }
    void sync();
    const refresh = () => {
      if (!document.hidden) void sync();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const title = mismatch
    ? locale === "vi"
      ? "Cấu hình Supabase giữa frontend và backend không khớp"
      : "Frontend and backend Supabase configuration differ"
    : undefined;
  return (
    <a
      {...props}
      href={`${signedIn ? "/app/account" : "/app"}?lang=${locale}`}
      title={title}
    >
      {signedIn ? (locale === "vi" ? "Tài khoản" : "Account") : label}
      <ArrowUpRight aria-hidden="true" />
    </a>
  );
}
