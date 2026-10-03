import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { getGalleryByToken, getImageDownloadUrl, recordGalleryDownload } from "@/lib/gallery.functions";
import { OslnzLogo } from "@/components/OslnzLogo";
import { BlurImage } from "@/components/BlurImage";
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

const IMAGE_BATCH_SIZE = 5;

function GalleryView() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const fetchGallery = useServerFn(getGalleryByToken);
  const fetchAllPhotos = useServerFn(getAllPhotoPathsForDownload);
  const getDownload = useServerFn(getImageDownloadUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["gallery", token],
    queryFn: () => fetchGallery({ data: { token, offset: 0, limit: IMAGE_BATCH_SIZE } }),
    staleTime: 60_000,
  });

  const [lightbox, setLightbox] = useState<number | null>(null);
  const gallery = data?.ok ? data.gallery : null;
  const [images, setImages] = useState<Img[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (data?.ok) {
      setImages(data.photos);
      setOffset(IMAGE_BATCH_SIZE);
      setHasMore(data.hasMore);
      setTotalCount(data.totalCount);
    } else {
      setImages([]);
      setOffset(0);
      setHasMore(false);
      setTotalCount(0);
    }
  }, [data]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchGallery({ data: { token, offset, limit: IMAGE_BATCH_SIZE } });
      if (res.ok) {
        setImages((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...res.photos.filter((p) => !seen.has(p.id))];
        });
        setOffset((o) => o + IMAGE_BATCH_SIZE);
        setHasMore(res.hasMore);
        setTotalCount(res.totalCount);
      }
    } finally {
      setLoadingMore(false);
    }
  }



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

  const recordDownload = useServerFn(recordGalleryDownload);
  const [zipping, setZipping] = useState<string | null>(null);

  async function downloadAll() {
    if (zipping) return;
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let done = 0;
      setZipping(`Preparing 0 / ${images.length}`);
      const queue = images.map((img, i) => ({ img, i }));
      async function worker() {
        while (queue.length) {
          const item = queue.shift();
          if (!item) return;
          const { img, i } = item;
          if (!img.url) continue;
          const res = await fetch(img.url);
          if (res.ok) {
            zip.file(String(i + 1).padStart(3, "0") + "_" + img.filename, await res.blob());
          }
          done++;
          setZipping(`Preparing ${done} / ${images.length}`);
        }
      }
      await Promise.all(Array.from({ length: 4 }, worker));
      setZipping("Creating ZIP…");
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (gallery?.title.replace(/[^a-zA-Z0-9._-]/g, "_") || "gallery") + ".zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      recordDownload({ data: { token } }).catch(() => {});
    } catch {
      alert("Download failed. Please try again.");
    } finally {
      setZipping(null);
    }
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
        <p className="eyebrow">{gallery?.clientName}</p>
        <h1 className="gallery-head__title">{gallery?.title}</h1>
        <div className="gallery-head__meta">
          {gallery?.eventName && <span>{gallery.eventName}</span>}
          {gallery?.eventDate && (
            <span>
              {new Date(gallery.eventDate + "T00:00:00").toLocaleDateString(undefined, {
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
            <button onClick={downloadAll} className="btn btn--pine-soft" disabled={!!zipping}>
              {zipping ?? "Download entire gallery"}
            </button>
          </div>
        )}
      </section>

      <section className="shell shell--lg gallery-images">
        {images.length === 0 ? (
          <p className="gallery-images__empty muted">
            Your photographer hasn't added any photos yet.
          </p>
        ) : (
          <>
            <div className="masonry">
            {renderedImages.map((img, offset) => {
              const idx = offset;
              const shape = `shape-${idx % 7}`;
              const radius = `radius-${idx % 4}`;
              return (
              <button
                key={img.id}
                type="button"
                data-gallery-index={idx}
                onClick={() => setLightbox(idx)}
                className={`masonry__item ${shape} ${radius}`}
                aria-label={`Open ${img.filename}`}
              >
                {img.url && (
                  <BlurImage src={img.url} alt={img.filename} />
                )}
                <span className="masonry__badge">
                  <span>OSLNZ</span>
                </span>
              </button>
              );
            })}
            </div>
            {visibleCount < images.length && (
              <div className="load-more-images">
                <button
                  type="button"
                  className="load-button"
                  onClick={() => setVisibleCount((count) => Math.min(count + IMAGE_BATCH_SIZE, images.length))}
                >
                  ✨ Load More pictures
                </button>
              </div>
            )}
          </>
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
          onDownload={() => {
            const selectedImage = images[lightbox];
            if (selectedImage) void downloadOne(selectedImage.id);
          }}
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
      className="lightbox"
      role="dialog"
      aria-modal
    >
      <div className="lightbox__bar">
        <span>{index + 1} / {total}</span>
        <div className="row">
          <button onClick={onDownload}>Download</button>
          <button onClick={onClose}>Close ✕</button>
        </div>
      </div>

      <div
        className="lightbox__stage"
        onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const changedTouch = e.changedTouches[0];
          if (!changedTouch) return;
          const dx = changedTouch.clientX - touchX;
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
            className={"lightbox__img" + (zoom ? " is-zoomed" : "")}
          />
        )}

        <button
          onClick={onPrev}
          className="lightbox__nav lightbox__nav--prev"
          aria-label="Previous"
        >
          ‹
        </button>
        <button
          onClick={onNext}
          className="lightbox__nav lightbox__nav--next"
          aria-label="Next"
        >
          ›
        </button>
      </div>
    </div>
  );
}