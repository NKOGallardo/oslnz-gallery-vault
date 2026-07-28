import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { getGalleryByToken, getImageDownloadUrl } from "@/lib/gallery.functions";
import { OslnzLogo } from "@/components/OslnzLogo";
import bgBronze from "@/assets/bg-bronze.jpeg.asset.json";

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
      <div className="center-screen muted">
        <p className="kicker">Loading…</p>
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <main className="center-screen">
        <OslnzLogo />
        <p className="lede">{data?.error ?? "Gallery not available."}</p>
        <Link to="/" className="btn btn--primary">
          Enter PIN again
        </Link>
      </main>
    );
  }

  return (
    <main className="page">
      <div
        aria-hidden
        className="page__bg"
        style={{ backgroundImage: `url(${bgBronze.url})` }}
      />
      <div aria-hidden className="page__veil" />
      <header className="shell shell--md">
        <div className="topbar">
          <OslnzLogo />
          <button onClick={() => navigate({ to: "/" })} className="btn--linklike">
            Exit
          </button>
        </div>
      </header>

      <section className="shell shell--md gallery-head">
        <p className="eyebrow">{gallery!.clientName}</p>
        <h1 className="gallery-head__title">{gallery!.title}</h1>
        <div className="gallery-head__meta">
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
          <div className="gallery-head__actions">
            <button onClick={downloadAll} className="btn btn--pine-soft">
              Download entire gallery
            </button>
          </div>
        )}
      </section>

      <section className="shell shell--lg" style={{ paddingBottom: "6rem" }}>
        {images.length === 0 ? (
          <p className="muted" style={{ padding: "6rem 0", textAlign: "center" }}>
            Your photographer hasn't added any photos yet.
          </p>
        ) : (
          <div className="masonry">
            {images.map((img, idx) => {
              const shape = `shape-${idx % 7}`;
              const radius = `radius-${idx % 4}`;
              return (
              <button
                key={img.id}
                onClick={() => setLightbox(idx)}
                className={`masonry__item ${shape} ${radius}`}
                aria-label={`Open ${img.filename}`}
              >
                {img.url && (
                  <img
                    src={img.url}
                    alt={img.filename}
                    loading="lazy"
                  />
                )}
                <span className="masonry__badge">
                  <span>OSLNZ</span>
                </span>
              </button>
              );
            })}
          </div>
        )}
      </section>

      <footer className="site-footer">
        <div>© {new Date().getFullYear()} OSLNZ. All galleries are private.</div>
        <div className="kicker">Made by NKO_Coding.codes</div>
      </footer>

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
      className="fixed inset-0 z-50 flex flex-col bg-white/95 backdrop-blur"
      role="dialog"
      aria-modal
    >
      <div className="flex items-center justify-between px-6 py-4 text-xs tracking-[0.3em] uppercase text-foreground/70">
        <span>{index + 1} / {total}</span>
        <div className="flex items-center gap-4">
          <button onClick={onDownload} className="hover:text-foreground">Download</button>
          <button onClick={onClose} className="hover:text-foreground">Close ✕</button>
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
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/10 p-3 text-foreground transition hover:bg-black/20"
          aria-label="Previous"
        >
          ‹
        </button>
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/10 p-3 text-foreground transition hover:bg-black/20"
          aria-label="Next"
        >
          ›
        </button>
      </div>
    </div>
  );
}