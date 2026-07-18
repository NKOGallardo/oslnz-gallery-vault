import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const SIGNED_URL_TTL = 60 * 60 * 2; // 2h

function getClientIp(): string {
  const xf = getRequestHeader("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf;
  return "unknown";
}

// -------- Public: verify PIN and issue gallery token --------
export const verifyPin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => z.object({ pin: z.string().trim().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signGalleryToken } = await import("@/lib/token.server");
    const ip = getClientIp();

    // Rate limit: 8 attempts / 5 minutes / IP
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recent } = await supabaseAdmin
      .from("pin_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("attempted_at", since);
    if ((recent ?? 0) >= 8) {
      return { ok: false as const, error: "Too many attempts. Please wait a few minutes." };
    }

    const { data: gallery } = await supabaseAdmin
      .from("galleries")
      .select("id, expires_at")
      .eq("pin", data.pin.trim())
      .maybeSingle();

    const success = !!gallery && (!gallery.expires_at || new Date(gallery.expires_at) > new Date());
    await supabaseAdmin.from("pin_attempts").insert({ ip, success });

    if (!success) {
      return { ok: false as const, error: "Invalid PIN. Please check your code and try again." };
    }
    return { ok: true as const, token: signGalleryToken(gallery!.id) };
  });

// -------- Public: read gallery via token --------
export const getGalleryByToken = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyGalleryToken } = await import("@/lib/token.server");
    const payload = verifyGalleryToken(data.token);
    if (!payload) return { ok: false as const, error: "This gallery link has expired. Please enter your PIN again." };

    const { data: gallery } = await supabaseAdmin
      .from("galleries")
      .select("id, title, client_name, event_name, event_date, expires_at")
      .eq("id", payload.gid)
      .maybeSingle();
    if (!gallery) return { ok: false as const, error: "Gallery not found." };
    if (gallery.expires_at && new Date(gallery.expires_at) < new Date()) {
      return { ok: false as const, error: "This gallery has expired." };
    }

    const { data: images } = await supabaseAdmin
      .from("gallery_images")
      .select("id, storage_path, original_filename, sort_order")
      .eq("gallery_id", gallery.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const paths = (images ?? []).map((i) => i.storage_path);
    const signed = paths.length
      ? (await supabaseAdmin.storage.from("gallery-images").createSignedUrls(paths, SIGNED_URL_TTL)).data ?? []
      : [];

    const withUrls = (images ?? []).map((img, idx) => ({
      id: img.id,
      filename: img.original_filename,
      url: signed[idx]?.signedUrl ?? null,
    }));

    return {
      ok: true as const,
      gallery: {
        id: gallery.id,
        title: gallery.title,
        clientName: gallery.client_name,
        eventName: gallery.event_name,
        eventDate: gallery.event_date,
      },
      images: withUrls,
    };
  });

// -------- Public: get download URL for one image (increments counter) --------
export const getImageDownloadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; imageId: string }) =>
    z.object({ token: z.string(), imageId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyGalleryToken } = await import("@/lib/token.server");
    const payload = verifyGalleryToken(data.token);
    if (!payload) return { ok: false as const, error: "Session expired." };

    const { data: img } = await supabaseAdmin
      .from("gallery_images")
      .select("id, gallery_id, storage_path, original_filename")
      .eq("id", data.imageId)
      .maybeSingle();
    if (!img || img.gallery_id !== payload.gid) return { ok: false as const, error: "Not found." };

    const { data: signed } = await supabaseAdmin.storage
      .from("gallery-images")
      .createSignedUrl(img.storage_path, 300, { download: img.original_filename });
    if (!signed?.signedUrl) return { ok: false as const, error: "Could not sign URL." };

    await supabaseAdmin.rpc("increment_gallery_download").throwOnError = undefined as never;
    // Fallback update (no RPC defined): increment directly.
    await supabaseAdmin
      .from("galleries")
      .update({ download_count: 1 })
      .eq("id", payload.gid);

    return { ok: true as const, url: signed.signedUrl };
  });