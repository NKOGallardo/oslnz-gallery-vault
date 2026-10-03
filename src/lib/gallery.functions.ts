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
async function loadValidGallery(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { verifyGalleryToken } = await import("@/lib/token.server");
  const payload = verifyGalleryToken(token);
  if (!payload) return { error: "This gallery link has expired. Please enter your PIN again." } as const;
  const { data: gallery } = await supabaseAdmin
    .from("galleries")
    .select("id, title, client_name, event_name, event_date, expires_at")
    .eq("id", payload.gid)
    .maybeSingle();
  if (!gallery) return { error: "Gallery not found." } as const;
  if (gallery.expires_at && new Date(gallery.expires_at) < new Date()) {
    return { error: "This gallery has expired." } as const;
  }
  return { gallery, supabaseAdmin } as const;
}

export const getGalleryByToken = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; offset?: number; limit?: number }) =>
    z
      .object({
        token: z.string().min(10),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(50).default(5),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const res = await loadValidGallery(data.token);
    if ("error" in res) return { ok: false as const, error: res.error as string };
    const { gallery, supabaseAdmin } = res;
    const { offset, limit } = data;

    const { data: images, count } = await supabaseAdmin
      .from("gallery_images")
      .select("id, storage_path, original_filename", { count: "exact" })
      .eq("gallery_id", gallery.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    const rows = images ?? [];
    const signed = rows.length
      ? (await supabaseAdmin.storage.from("gallery-images").createSignedUrls(rows.map((i) => i.storage_path), SIGNED_URL_TTL)).data ?? []
      : [];
    const photos = rows.map((img, idx) => ({
      id: img.id,
      filename: img.original_filename,
      url: signed[idx]?.signedUrl ?? null,
    }));
    const totalCount = count ?? 0;

    return {
      ok: true as const,
      gallery: {
        id: gallery.id,
        title: gallery.title,
        clientName: gallery.client_name,
        eventName: gallery.event_name,
        eventDate: gallery.event_date,
      },
      photos,
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  });

// -------- Public: all photos for ZIP download (on demand) --------
export const getAllPhotoPathsForDownload = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const res = await loadValidGallery(data.token);
    if ("error" in res) return { ok: false as const, error: res.error as string };
    const { gallery, supabaseAdmin } = res;
    const { data: images } = await supabaseAdmin
      .from("gallery_images")
      .select("id, storage_path, original_filename")
      .eq("gallery_id", gallery.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    const rows = images ?? [];
    const signed = rows.length
      ? (await supabaseAdmin.storage.from("gallery-images").createSignedUrls(rows.map((i) => i.storage_path), SIGNED_URL_TTL)).data ?? []
      : [];
    return {
      ok: true as const,
      photos: rows.map((img, idx) => ({
        id: img.id,
        filename: img.original_filename,
        url: signed[idx]?.signedUrl ?? null,
      })),
    };
  });

// -------- Public: record a full-gallery download --------
export const recordGalleryDownload = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyGalleryToken } = await import("@/lib/token.server");
    const payload = verifyGalleryToken(data.token);
    if (!payload) return { ok: false as const };
    const { data: g } = await supabaseAdmin
      .from("galleries").select("download_count").eq("id", payload.gid).maybeSingle();
    await supabaseAdmin
      .from("galleries").update({ download_count: (g?.download_count ?? 0) + 1 }).eq("id", payload.gid);
    return { ok: true as const };
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

    // Increment download counter (read-then-write; sufficient for stats).
    const { data: g } = await supabaseAdmin
      .from("galleries")
      .select("download_count")
      .eq("id", payload.gid)
      .maybeSingle();
    await supabaseAdmin
      .from("galleries")
      .update({ download_count: (g?.download_count ?? 0) + 1 })
      .eq("id", payload.gid);

    return { ok: true as const, url: signed.signedUrl };
  });