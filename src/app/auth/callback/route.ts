import { NextResponse } from "next/server";
import { completeLocalSignIn, completeSupabaseSignIn, safeRedirect } from "@/lib/auth";
import { env } from "@/lib/env";
import { log } from "@/lib/errors";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = env().APP_URL;
  try {
    if (env().AUTH_PROVIDER === "local") {
      const token = url.searchParams.get("token");
      if (!token) throw new Error("missing token");
      const next = await completeLocalSignIn(token);
      return NextResponse.redirect(new URL(safeRedirect(next), base));
    }
    const code = url.searchParams.get("code");
    if (!code) throw new Error("missing code");
    await completeSupabaseSignIn(code);
    return NextResponse.redirect(new URL(safeRedirect(url.searchParams.get("next")), base));
  } catch (e) {
    log("warn", "auth.callback_failed", { error: (e as Error).message });
    return NextResponse.redirect(new URL("/login?error=invalid_link", base));
  }
}
