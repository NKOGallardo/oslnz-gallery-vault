import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export const Route = createFileRoute("/api/public/admin/login")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        let body: { code?: string } = {};
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "Invalid JSON body" }, 400);
        }
        const code = typeof body?.code === "string" ? body.code.trim() : "";
        if (!code || code.length > 100) {
          return json({ ok: false, error: "Missing code" }, 400);
        }

        const expected = process.env.ADMIN_LOGIN_CODE;
        const bootstrap = process.env.PHOTOGRAPHER_BOOTSTRAP_CODE;
        if (!expected || !bootstrap) {
          return json({ ok: false, error: "Admin not configured" }, 500);
        }
        if (code !== expected) {
          return json({ ok: false, error: "Invalid code" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { newSecretUrl } = await import("@/lib/token.server");

        let { data: photographer } = await supabaseAdmin
          .from("photographers")
          .select("id, secret_url, name")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!photographer) {
          const fresh = newSecretUrl();
          const { data, error } = await supabaseAdmin
            .from("photographers")
            .insert({ name: "OSLNZ Photographer", secret_url: fresh })
            .select("id, secret_url, name")
            .single();
          if (error) return json({ ok: false, error: error.message }, 500);
          photographer = data;
        }

        const origin = new URL(request.url).origin;
        return json({
          ok: true,
          secret: photographer.secret_url,
          dashboardUrl: `${origin}/manage/${photographer.secret_url}`,
        });
      },
    },
  },
});