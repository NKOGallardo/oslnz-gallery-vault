import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { getGalleryByToken, getImageDownloadUrl } from "@/lib/gallery.functions";
import { OslnzLogo } from "@/components/OslnzLogo";

export const Route = createFileRoute("/g/$token")({
  head: () => ({
    meta: [
      { title: "Your Gallery — OSLNZ" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: GalleryView,
});

type Img = { id: string; filename: string; url: string | null };

function GalleryView() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const fetchGallery = useServerFn(getGalleryByToken);
  const getDownload = useServerFn(getImageDownloadUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["gallery", token],
    queryFn: () => fetchGallery({ data: { token } }),
    staleTime: 60_000,
  });

  const [lightbox, setLightbox] = useState<number | null>(null);
  const images: Img[] = data?.ok ? data.images : [];
  const gallery = data?.ok ? data.gallery : null;

  const close = useCallback(() => setLightbox(null), []);
  const prev = useCallback(
    () => setLightbox((i) => (i === null ? null : (i - 1 + images.length) % images.length)),
    [images.length],
  );
  const next = useCallback(
    () => setLightbox((i) => (i === null ? null : (i + 1) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, close, prev, next]);

  async function downloadOne(imageId: string) {
    const res = await getDownload({ data: { token, imageId } });
    if (res.ok) window.location.href = res.url;
  }

  function downloadAll() {
    window.location.href = `/api/public/gallery/${token}/zip`;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <p className="text-sm tracking-[0.3em] uppercase">Loading…</p>
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <OslnzLogo />
        <p className="text-lg text-muted-foreground">{data?.error ?? "Gallery not available."}</p>
        <Link
          to="/"
          className="rounded-2xl bg-pine px-6 py-3 text-sm font-semibold text-pine-foreground"
        >
          Enter PIN again
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pb-6 pt-10 sm:px-10">
        <OslnzLogo />
        <button
          onClick={() => navigate({ to: "/" })}
          className="text-xs tracking-[0.3em] uppercase text-muted-foreground hover:text-foreground"
        >
          Exit
        </button>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-8 sm:px-10">
        <p className="text-xs tracking-[0.4em] uppercase text-brown">
          {gallery!.clientName}
        </p>
        <h1 className="mt-3 font-heading text-4xl font-semibold sm:text-5xl">
          {gallery!.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {gallery!.eventName && <span>{gallery!.eventName}</span>}
          {gallery!.eventDate && (
            <span>
              {new Date(gallery!.eventDate + "T00:00:00").toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          )}
          <span>{images.length} {images.length === 1 ? "image" : "images"}</span>
        </div>
        {images.length > 0 && (
          <div className="mt-6">
            <button
              onClick={downloadAll}
              className="rounded-2xl border border-pine bg-pine/10 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-pine/20"
            >
              Download entire gallery
            </button>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-8">
        {images.length === 0 ? (
          <p className="py-24 text-center text-muted-foreground">
            Your photographer hasn't added any photos yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {images.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => setLightbox(idx)}
                className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-white/5"
                aria-label={`Open ${img.filename}`}
              >
                {img.url && (
                  <img
                    src={img.url}
                    alt={img.filename}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                )}
                <span className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/40 via-transparent p-2 opacity-0 transition group-hover:opacity-100">
                  <span className="rounded-full bg-black/50 px-3 py-1 text-[0.65rem] tracking-[0.25em] uppercase text-white">
                    OSLNZ
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {lightbox !== null && images[lightbox] && (
        <Lightbox
          image={images[lightbox]}
          index={lightbox}
          total={images.length}
          onClose={close}
          onPrev={prev}
          onNext={next}
          onDownload={() => downloadOne(images[lightbox]!.id)}
        />
      )}
    </main>
  );
}

function Lightbox({
  image,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  onDownload,
}: {
  image: Img;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDownload: () => void;
}) {
  const [zoom, setZoom] = useState(false);
  useEffect(() => setZoom(false), [image.id]);

  // Basic swipe support
  const [touchX, setTouchX] = useState<number | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur"
      role="dialog"
      aria-modal
    >
      <div className="flex items-center justify-between px-6 py-4 text-xs tracking-[0.3em] uppercase text-white/70">
        <span>{index + 1} / {total}</span>
        <div className="flex items-center gap-4">
          <button onClick={onDownload} className="hover:text-white">Download</button>
          <button onClick={onClose} className="hover:text-white">Close ✕</button>
        </div>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-4"
        onTouchStart={(e) => setTouchX(e.touches[0]!.clientX)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0]!.clientX - touchX;
          if (dx > 40) onPrev();
          else if (dx < -40) onNext();
          setTouchX(null);
        }}
      >
        {image.url && (
          <img
            src={image.url}
            alt={image.filename}
            onClick={() => setZoom((z) => !z)}
            className={
              "max-h-full max-w-full cursor-zoom-in select-none transition-transform duration-300 " +
              (zoom ? "scale-150 cursor-zoom-out" : "")
            }
          />
        )}

        <button
          onClick={onPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
          aria-label="Previous"
        >
          ‹
        </button>
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
          aria-label="Next"
        >
          ›
        </button>
      </div>
    </div>
  );
}