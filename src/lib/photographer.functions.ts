import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Resolve a photographer by their secret URL segment. Bootstrap-only if segment matches
// PHOTOGRAPHER_BOOTSTRAP_CODE — the visitor is auto-onboarded and given a fresh secret.
async function resolvePhotographerOrBootstrap(secret: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { newSecretUrl } = await import("@/lib/token.server");
  const bootstrap = process.env.PHOTOGRAPHER_BOOTSTRAP_CODE;

  if (bootstrap && secret === bootstrap) {
    // Master bootstrap key: always resolves to the (single) photographer.
    // Create one on first use; otherwise return the existing account so
    // the code keeps working across sessions and galleries persist.
    const { data: existing } = await supabaseAdmin
      .from("photographers")
      .select("id, secret_url, name")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing) {
      return { photographer: existing, bootstrapped: false as const };
    }
    const fresh = newSecretUrl();
    const { data, error } = await supabaseAdmin
      .from("photographers")
      .insert({ name: "OSLNZ Photographer", secret_url: fresh })
      .select("id, secret_url, name")
      .single();
    if (error) throw error;
    return { photographer: data, bootstrapped: true as const };
  }

  const { data } = await supabaseAdmin
    .from("photographers")
    .select("id, secret_url, name")
    .eq("secret_url", secret)
    .maybeSingle();

  if (!data) return null;
  return { photographer: data, bootstrapped: false as const };
}

// -------- Dashboard bootstrap / auth --------
export const openDashboard = createServerFn({ method: "POST" })
  .inputValidator((d: { secret: string }) => z.object({ secret: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const result = await resolvePhotographerOrBootstrap(data.secret);
    if (!result) return { ok: false as const };
    return {
      ok: true as const,
      photographer: result.photographer,
      bootstrapped: result.bootstrapped,
    };
  });

// -------- Dashboard stats --------
export const getDashboardStats = createServerFn({ method: "POST" })
  .inputValidator((d: { secret: string }) => z.object({ secret: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await resolvePhotographerOrBootstrap(data.secret);
    if (!r) return { ok: false as const };
    const pid = r.photographer.id;

    const { data: galleries } = await supabaseAdmin
      .from("galleries")
      .select("id, title, client_name, event_name, pin, download_count, created_at, expires_at")
      .eq("photographer_id", pid)
      .order("created_at", { ascending: false });

    const galleryIds = (galleries ?? []).map((g) => g.id);
    let imageCount = 0;
    const countsByGallery: Record<string, number> = {};
    if (galleryIds.length) {
      const { data: imgs } = await supabaseAdmin
        .from("gallery_images")
        .select("gallery_id")
        .in("gallery_id", galleryIds);
      for (const i of imgs ?? []) {
        imageCount++;
        countsByGallery[i.gallery_id] = (countsByGallery[i.gallery_id] ?? 0) + 1;
      }
    }
    const totalDownloads = (galleries ?? []).reduce((a, g) => a + (g.download_count ?? 0), 0);

    return {
      ok: true as const,
      photographer: r.photographer,
      stats: {
        totalGalleries: galleries?.length ?? 0,
        totalImages: imageCount,
        totalDownloads,
      },
      galleries: (galleries ?? []).map((g) => ({
        ...g,
        image_count: countsByGallery[g.id] ?? 0,
      })),
    };
  });

// -------- Rotate secret URL --------
export const rotateSecret = createServerFn({ method: "POST" })
  .inputValidator((d: { secret: string }) => z.object({ secret: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { newSecretUrl } = await import("@/lib/token.server");
    const r = await resolvePhotographerOrBootstrap(data.secret);
    if (!r) return { ok: false as const };
    const fresh = newSecretUrl();
    const { error } = await supabaseAdmin
      .from("photographers")
      .update({ secret_url: fresh })
      .eq("id", r.photographer.id);
    if (error) throw error;
    return { ok: true as const, secret: fresh };
  });

// -------- Create gallery --------
export const createGallery = createServerFn({ method: "POST" })
  .inputValidator((d: {
    secret: string;
    title: string;
    clientName: string;
    eventName?: string;
    pin: string;
    eventDate?: string | null;
    expiresAt?: string | null;
  }) =>
    z
      .object({
        secret: z.string(),
        title: z.string().trim().min(1).max(200),
        clientName: z.string().trim().min(1).max(200),
        eventName: z.string().trim().max(200).optional(),
        pin: z.string().trim().min(3).max(32),
        eventDate: z.string().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await resolvePhotographerOrBootstrap(data.secret);
    if (!r) return { ok: false as const, error: "Unauthorized" };

    const { data: existing } = await supabaseAdmin
      .from("galleries")
      .select("id")
      .eq("pin", data.pin)
      .maybeSingle();
    if (existing) return { ok: false as const, error: "That PIN is already in use. Choose another." };

    const { data: created, error } = await supabaseAdmin
      .from("galleries")
      .insert({
        photographer_id: r.photographer.id,
        title: data.title,
        client_name: data.clientName,
        event_name: data.eventName || null,
        pin: data.pin,
        event_date: data.eventDate || null,
        expires_at: data.expiresAt || null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true as const, id: created.id };
  });

// -------- Update gallery --------
export const updateGallery = createServerFn({ method: "POST" })
  .inputValidator((d: {
    secret: string;
    id: string;
    title?: string;
    clientName?: string;
    eventName?: string | null;
    pin?: string;
    eventDate?: string | null;
    expiresAt?: string | null;
  }) =>
    z
      .object({
        secret: z.string(),
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        clientName: z.string().trim().min(1).max(200).optional(),
        eventName: z.string().trim().max(200).nullable().optional(),
        pin: z.string().trim().min(3).max(32).optional(),
        eventDate: z.string().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await resolvePhotographerOrBootstrap(data.secret);
    if (!r) return { ok: false as const, error: "Unauthorized" };
    const patch: {
      title?: string;
      client_name?: string;
      event_name?: string | null;
      pin?: string;
      event_date?: string | null;
      expires_at?: string | null;
    } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.clientName !== undefined) patch.client_name = data.clientName;
    if (data.eventName !== undefined) patch.event_name = data.eventName || null;
    if (data.pin !== undefined) patch.pin = data.pin;
    if (data.eventDate !== undefined) patch.event_date = data.eventDate || null;
    if (data.expiresAt !== undefined) patch.expires_at = data.expiresAt || null;
    const { error } = await supabaseAdmin
      .from("galleries")
      .update(patch)
      .eq("id", data.id)
      .eq("photographer_id", r.photographer.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// -------- Delete gallery --------
export const deleteGallery = createServerFn({ method: "POST" })
  .inputValidator((d: { secret: string; id: string }) =>
    z.object({ secret: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await resolvePhotographerOrBootstrap(data.secret);
    if (!r) return { ok: false as const };
    // Fetch storage paths so we can clean them up
    const { data: imgs } = await supabaseAdmin
      .from("gallery_images")
      .select("storage_path")
      .eq("gallery_id", data.id);
    if (imgs?.length) {
      await supabaseAdmin.storage.from("gallery-images").remove(imgs.map((i) => i.storage_path));
    }
    await supabaseAdmin
      .from("galleries")
      .delete()
      .eq("id", data.id)
      .eq("photographer_id", r.photographer.id);
    return { ok: true as const };
  });

// -------- Duplicate gallery (metadata + image records; storage paths reused) --------
export const duplicateGallery = createServerFn({ method: "POST" })
  .inputValidator((d: { secret: string; id: string; pin: string }) =>
    z.object({ secret: z.string(), id: z.string().uuid(), pin: z.string().trim().min(3).max(32) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await resolvePhotographerOrBootstrap(data.secret);
    if (!r) return { ok: false as const, error: "Unauthorized" };

    const { data: source } = await supabaseAdmin
      .from("galleries")
      .select("*")
      .eq("id", data.id)
      .eq("photographer_id", r.photographer.id)
      .maybeSingle();
    if (!source) return { ok: false as const, error: "Gallery not found" };

    const { data: existing } = await supabaseAdmin.from("galleries").select("id").eq("pin", data.pin).maybeSingle();
    if (existing) return { ok: false as const, error: "That PIN is already in use." };

    const { data: newGal, error } = await supabaseAdmin
      .from("galleries")
      .insert({
        photographer_id: r.photographer.id,
        title: source.title + " (copy)",
        client_name: source.client_name,
        event_name: source.event_name,
        event_date: source.event_date,
        pin: data.pin,
        expires_at: source.expires_at,
      })
      .select("id")
      .single();
    if (error) throw error;

    const { data: imgs } = await supabaseAdmin
      .from("gallery_images")
      .select("storage_path, original_filename, sort_order, size_bytes")
      .eq("gallery_id", data.id)
      .order("sort_order");
    if (imgs?.length) {
      await supabaseAdmin.from("gallery_images").insert(
        imgs.map((i) => ({
          gallery_id: newGal.id,
          storage_path: i.storage_path,
          original_filename: i.original_filename,
          sort_order: i.sort_order,
          size_bytes: i.size_bytes,
        })),
      );
    }
    return { ok: true as const, id: newGal.id };
  });

// -------- List a single gallery + images (management view) --------
export const getGalleryForManage = createServerFn({ method: "POST" })
  .inputValidator((d: { secret: string; id: string }) =>
    z.object({ secret: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await resolvePhotographerOrBootstrap(data.secret);
    if (!r) return { ok: false as const };
    const { data: gallery } = await supabaseAdmin
      .from("galleries")
      .select("*")
      .eq("id", data.id)
      .eq("photographer_id", r.photographer.id)
      .maybeSingle();
    if (!gallery) return { ok: false as const };
    const { data: images } = await supabaseAdmin
      .from("gallery_images")
      .select("id, storage_path, original_filename, sort_order, size_bytes")
      .eq("gallery_id", gallery.id)
      .order("sort_order");
    const paths = (images ?? []).map((i) => i.storage_path);
    const signed = paths.length
      ? (await supabaseAdmin.storage.from("gallery-images").createSignedUrls(paths, 60 * 60 * 2)).data ?? []
      : [];
    return {
      ok: true as const,
      gallery,
      images: (images ?? []).map((i, idx) => ({ ...i, url: signed[idx]?.signedUrl ?? null })),
    };
  });

// -------- Add image records (client uploads directly via signed URL, then registers) --------
export const requestUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { secret: string; galleryId: string; filename: string; contentType: string }) =>
    z
      .object({
        secret: z.string(),
        galleryId: z.string().uuid(),
        filename: z.string().min(1).max(300),
        contentType: z
          .string()
          .regex(/^image\/(jpeg|png|webp|jpg)$/i, "Only JPEG, PNG, or WEBP images are allowed"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await resolvePhotographerOrBootstrap(data.secret);
    if (!r) return { ok: false as const, error: "Unauthorized" };
    const { data: g } = await supabaseAdmin
      .from("galleries")
      .select("id")
      .eq("id", data.galleryId)
      .eq("photographer_id", r.photographer.id)
      .maybeSingle();
    if (!g) return { ok: false as const, error: "Gallery not found" };

    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
    const path = `${r.photographer.id}/${data.galleryId}/${crypto.randomUUID()}_${safeName}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("gallery-images")
      .createSignedUploadUrl(path);
    if (error || !signed) return { ok: false as const, error: error?.message ?? "Could not create upload URL" };
    return { ok: true as const, path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const registerUploadedImage = createServerFn({ method: "POST" })
  .inputValidator((d: { secret: string; galleryId: string; path: string; filename: string; size: number }) =>
    z
      .object({
        secret: z.string(),
        galleryId: z.string().uuid(),
        path: z.string().min(1),
        filename: z.string().min(1),
        size: z.number().int().nonnegative(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await resolvePhotographerOrBootstrap(data.secret);
    if (!r) return { ok: false as const };
    const { data: g } = await supabaseAdmin
      .from("galleries")
      .select("id")
      .eq("id", data.galleryId)
      .eq("photographer_id", r.photographer.id)
      .maybeSingle();
    if (!g) return { ok: false as const };
    const { count } = await supabaseAdmin
      .from("gallery_images")
      .select("id", { count: "exact", head: true })
      .eq("gallery_id", data.galleryId);
    const { error } = await supabaseAdmin.from("gallery_images").insert({
      gallery_id: data.galleryId,
      storage_path: data.path,
      original_filename: data.filename,
      size_bytes: data.size,
      sort_order: count ?? 0,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// -------- Image ops: delete, reorder --------
export const deleteImage = createServerFn({ method: "POST" })
  .inputValidator((d: { secret: string; imageId: string }) =>
    z.object({ secret: z.string(), imageId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await resolvePhotographerOrBootstrap(data.secret);
    if (!r) return { ok: false as const };
    const { data: img } = await supabaseAdmin
      .from("gallery_images")
      .select("id, storage_path, gallery_id, galleries!inner(photographer_id)")
      .eq("id", data.imageId)
      .maybeSingle();
    const owner = (img as unknown as { galleries?: { photographer_id?: string } } | null)?.galleries
      ?.photographer_id;
    if (!img || owner !== r.photographer.id) return { ok: false as const };
    await supabaseAdmin.storage.from("gallery-images").remove([img.storage_path]);
    await supabaseAdmin.from("gallery_images").delete().eq("id", data.imageId);
    return { ok: true as const };
  });

export const reorderImages = createServerFn({ method: "POST" })
  .inputValidator((d: { secret: string; galleryId: string; order: string[] }) =>
    z
      .object({
        secret: z.string(),
        galleryId: z.string().uuid(),
        order: z.array(z.string().uuid()).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await resolvePhotographerOrBootstrap(data.secret);
    if (!r) return { ok: false as const };
    const { data: gallery } = await supabaseAdmin
      .from("galleries")
      .select("id")
      .eq("id", data.galleryId)
      .eq("photographer_id", r.photographer.id)
      .maybeSingle();
    if (!gallery) return { ok: false as const };
    await Promise.all(
      data.order.map((id, idx) =>
        supabaseAdmin.from("gallery_images").update({ sort_order: idx }).eq("id", id).eq("gallery_id", data.galleryId),
      ),
    );
    return { ok: true as const };
  });