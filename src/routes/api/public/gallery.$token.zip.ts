import { createFileRoute } from "@tanstack/react-router";
import JSZip from "jszip";

export const Route = createFileRoute("/api/public/gallery/$token/zip")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { verifyGalleryToken } = await import("@/lib/token.server");
        const payload = verifyGalleryToken(params.token);
        if (!payload) return new Response("Link expired", { status: 401 });

        const { data: gallery } = await supabaseAdmin
          .from("galleries")
          .select("id, title, expires_at, download_count")
          .eq("id", payload.gid)
          .maybeSingle();
        if (!gallery) return new Response("Not found", { status: 404 });
        if (gallery.expires_at && new Date(gallery.expires_at) < new Date()) {
          return new Response("Gallery expired", { status: 410 });
        }

        const { data: imgs } = await supabaseAdmin
          .from("gallery_images")
          .select("storage_path, original_filename, sort_order")
          .eq("gallery_id", gallery.id)
          .order("sort_order");

        if (!imgs?.length) return new Response("No images", { status: 404 });

        const zip = new JSZip();
        for (let i = 0; i < imgs.length; i++) {
          const img = imgs[i]!;
          const { data: blob } = await supabaseAdmin.storage
            .from("gallery-images")
            .download(img.storage_path);
          if (!blob) continue;
          const buf = await blob.arrayBuffer();
          const prefix = String(i + 1).padStart(3, "0") + "_";
          zip.file(prefix + img.original_filename, buf);
        }

        const zipBuf = await zip.generateAsync({ type: "arraybuffer" });

        await supabaseAdmin
          .from("galleries")
          .update({ download_count: (gallery.download_count ?? 0) + 1 })
          .eq("id", gallery.id);

        const safeTitle = gallery.title.replace(/[^a-zA-Z0-9._-]/g, "_") || "gallery";
        return new Response(zipBuf, {
          status: 200,
          headers: {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename="${safeTitle}.zip"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});