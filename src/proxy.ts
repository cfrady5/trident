import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes Supabase Auth sessions (AUTH_PROVIDER=supabase). Authorization is
 * never decided here: every protected page, action and route re-checks the
 * user server-side and every query runs under RLS.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  if (process.env.AUTH_PROVIDER !== "supabase") return response;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const c of list) {
          request.cookies.set(c.name, c.value);
          response.cookies.set(c.name, c.value, c.options);
        }
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|api/jobs).*)"] };
