import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { OslnzLogo } from "@/components/OslnzLogo";
import {
  getDashboardStats,
  rotateSecret,
  createGallery,
  deleteGallery,
  duplicateGallery,
  updateGallery,
  getGalleryForManage,
  requestUploadUrl,
  registerUploadedImage,
  deleteImage,
} from "@/lib/photographer.functions";
import QRCode from "qrcode";
import bgFloral from "@/assets/bg-floral.jpeg.asset.json";

export const Route = createFileRoute("/manage/$secret")({
  head: () => ({
    meta: [
      { title: "OSLNZ — Manage" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ManageDashboard,
});

type View = { kind: "dashboard" } | { kind: "create" } | { kind: "gallery"; id: string };

function ManageDashboard() {
  const { secret } = Route.useParams();
  const fetchStats = useServerFn(getDashboardStats);
  const qc = useQueryClient();
  const [view, setView] = useState<View>({ kind: "dashboard" });
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", secret],
    queryFn: () => fetchStats({ data: { secret } }),
  });

  if (isLoading) {
    return (
      <div className="center-screen muted">
        <p className="kicker">Loading…</p>
      </div>
    );
  }

  if (!data?.ok) {
    return <AccessDenied />;
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["dashboard", secret] });

  return (
    <main className="page">
      <div
        aria-hidden
        className="page__bg"
        style={{ backgroundImage: `url(${bgFloral.url})` }}
      />
      <div aria-hidden className="page__veil" />
      <header className="shell shell--lg">
        <div className="topbar">
          <OslnzLogo />
          <nav className="admin-nav">
            <button
              onClick={() => setView({ kind: "dashboard" })}
              className={"tab" + (view.kind === "dashboard" ? " is-active" : "")}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView({ kind: "create" })}
              className={"tab" + (view.kind === "create" ? " is-active-primary" : "")}
            >
              + New Gallery
            </button>
            <SettingsMenu secret={secret} />
          </nav>
        </div>
      </header>

      <div className="shell shell--lg" style={{ paddingBottom: "6rem" }}>
        {view.kind === "dashboard" && (
          <DashboardView
            data={data}
            secret={secret}
            search={search}
            setSearch={setSearch}
            onOpen={(id) => setView({ kind: "gallery", id })}
            onNew={() => setView({ kind: "create" })}
            onChanged={invalidate}
          />
        )}
        {view.kind === "create" && (
          <CreateGalleryView
            secret={secret}
            onCreated={(id) => {
              invalidate();
              setView({ kind: "gallery", id });
            }}
          />
        )}
        {view.kind === "gallery" && (
          <GalleryManageView
            secret={secret}
            galleryId={view.id}
            onBack={() => {
              invalidate();
              setView({ kind: "dashboard" });
            }}
          />
        )}
      </div>
    </main>
  );
}

function AccessDenied() {
  return (
    <main className="center-screen">
      <h1 className="notfound__code">404</h1>
      <p className="muted">Page not found.</p>
      <Link to="/" className="link-action">
        Go home
      </Link>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="panel">
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
    </div>
  );
}

function DashboardView({
  data,
  secret,
  search,
  setSearch,
  onOpen,
  onNew,
  onChanged,
}: {
  data: Extract<Awaited<ReturnType<typeof getDashboardStats>>, { ok: true }>;
  secret: string;
  search: string;
  setSearch: (s: string) => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onChanged: () => void;
}) {
  const del = useServerFn(deleteGallery);
  const dup = useServerFn(duplicateGallery);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.galleries;
    return data.galleries.filter(
      (g) =>
        g.client_name.toLowerCase().includes(q) ||
        g.title.toLowerCase().includes(q) ||
        g.pin.toLowerCase().includes(q),
    );
  }, [data.galleries, search]);

  return (
    <>
      <section className="grid grid--stats">
        <StatCard label="Total Galleries" value={data.stats.totalGalleries} />
        <StatCard label="Total Photos" value={data.stats.totalImages} />
        <StatCard label="Total Downloads" value={data.stats.totalDownloads} />
      </section>

      <section className="section">
        <div className="section__head">
          <div>
            <p className="eyebrow">Manage</p>
            <h2 className="section__title">Your Galleries</h2>
          </div>
          <div className="section__tools">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client or PIN…"
              className="input input--pill input--search"
            />
            <button onClick={onNew} className="btn btn--primary btn--pill">
              Create Gallery
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="panel panel--dashed" style={{ marginTop: "2rem" }}>
            No galleries yet. Create your first one to get started.
          </div>
        ) : (
          <div className="grid grid--cards">
            {filtered.map((g) => (
              <GalleryCard
                key={g.id}
                gallery={g}
                onOpen={() => onOpen(g.id)}
                onDelete={async () => {
                  if (!confirm(`Delete "${g.title}"? This cannot be undone.`)) return;
                  await del({ data: { secret, id: g.id } });
                  onChanged();
                }}
                onDuplicate={async () => {
                  const pin = prompt("PIN for the duplicated gallery:");
                  if (!pin) return;
                  const res = await dup({ data: { secret, id: g.id, pin } });
                  if (!res.ok) alert(res.error);
                  else onChanged();
                }}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function GalleryCard({
  gallery,
  onOpen,
  onDelete,
  onDuplicate,
}: {
  gallery: {
    id: string;
    title: string;
    client_name: string;
    pin: string;
    image_count: number;
    created_at: string;
    expires_at: string | null;
  };
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const link = typeof window !== "undefined" ? `${window.location.origin}/?pin=${gallery.pin}` : "";

  return (
    <div className="panel gallery-card">
      <div>
        <p className="gallery-card__client">{gallery.client_name}</p>
        <h3 className="gallery-card__title">{gallery.title}</h3>
        <div className="gallery-card__meta">
          <span>{gallery.image_count} photos</span>
          <span>·</span>
          <span>{new Date(gallery.created_at).toLocaleDateString()}</span>
          {gallery.expires_at && (
            <>
              <span>·</span>
              <span>expires {new Date(gallery.expires_at).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>

      <div className="gallery-card__pin">
        <span>PIN: {gallery.pin}</span>
        <button
          onClick={() => navigator.clipboard.writeText(gallery.pin)}
          className="link-action"
        >
          Copy
        </button>
      </div>

      {qr && (
        <div className="gallery-card__qr">
          <img src={qr} alt="QR" />
        </div>
      )}

      <div className="gallery-card__actions">
        <button onClick={onOpen} className="btn btn--primary btn--pill">
          Open
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(link)}
          className="btn btn--outline btn--pill"
        >
          Copy Link
        </button>
        <button
          onClick={async () => {
            if (qr) return setQr(null);
            const dataUrl = await QRCode.toDataURL(link, { margin: 1, width: 320 });
            setQr(dataUrl);
          }}
          className="btn btn--outline btn--pill"
        >
          {qr ? "Hide QR" : "QR"}
        </button>
        <button
          onClick={onDuplicate}
          className="btn btn--outline btn--pill"
        >
          Duplicate
        </button>
        <button
          onClick={onDelete}
          className="btn btn--danger btn--pill"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function SettingsMenu({ secret }: { secret: string }) {
  const rotate = useServerFn(rotateSecret);
  const [open, setOpen] = useState(false);
  const [newUrl, setNewUrl] = useState<string | null>(null);

  async function doRotate() {
    if (
      !confirm(
        "Generate a brand-new management URL? The current URL will stop working immediately. Make sure you can save the new one.",
      )
    )
      return;
    const res = await rotate({ data: { secret } });
    if (res.ok) {
      const url = `${window.location.origin}/manage/${res.secret}`;
      setNewUrl(url);
    }
  }

  return (
    <div className="settings">
      <button
        onClick={() => setOpen((v) => !v)}
        className="tab"
      >
        Settings
      </button>
      {open && (
        <div className="settings__panel">
          <p className="field__label">Danger zone</p>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
            Rotate your private management URL. The previous URL becomes unusable.
          </p>
          {newUrl ? (
            <div className="stack" style={{ marginTop: "1rem" }}>
              <p className="muted" style={{ fontSize: "0.75rem" }}>
                Save this URL now. It will not be shown again.
              </p>
              <code>{newUrl}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newUrl);
                  window.location.href = newUrl;
                }}
                className="btn btn--primary btn--pill btn--block"
              >
                Copy & open
              </button>
            </div>
          ) : (
            <button
              onClick={doRotate}
              className="btn btn--danger btn--pill btn--block"
              style={{ marginTop: "1rem" }}
            >
              Generate New Secret URL
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateGalleryView({
  secret,
  onCreated,
}: {
  secret: string;
  onCreated: (id: string) => void;
}) {
  const create = useServerFn(createGallery);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [eventName, setEventName] = useState("");
  const [pin, setPin] = useState(String(Math.floor(10000 + Math.random() * 90000)));
  const [eventDate, setEventDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await create({
      data: {
        secret,
        title,
        clientName,
        eventName: eventName || undefined,
        pin,
        eventDate: eventDate || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      },
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onCreated(res.id);
  }

  return (
    <section className="mx-auto max-w-2xl">
      <p className="text-xs tracking-[0.3em] uppercase text-brown">New gallery</p>
      <h2 className="font-heading text-4xl font-semibold">Create Gallery</h2>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Client Name" value={clientName} onChange={setClientName} required />
        <Field label="Gallery Name" value={title} onChange={setTitle} required />
        <Field label="Event Name" value={eventName} onChange={setEventName} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Gallery PIN (5 characters)"
            value={pin}
            onChange={(v) => setPin(v.slice(0, 5))}
            required
          />
          <Field label="Event Date" type="date" value={eventDate} onChange={setEventDate} />
        </div>
        <Field
          label="Expiry (optional)"
          type="datetime-local"
          value={expiresAt}
          onChange={setExpiresAt}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-pine py-4 text-sm font-semibold uppercase tracking-[0.3em] text-pine-foreground disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create Gallery"}
        </button>
      </form>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-2 w-full rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-foreground outline-none focus:border-pine"
      />
    </label>
  );
}

function GalleryManageView({
  secret,
  galleryId,
  onBack,
}: {
  secret: string;
  galleryId: string;
  onBack: () => void;
}) {
  const fetchGallery = useServerFn(getGalleryForManage);
  const request = useServerFn(requestUploadUrl);
  const register = useServerFn(registerUploadedImage);
  const remove = useServerFn(deleteImage);
  const update = useServerFn(updateGallery);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["manage-gallery", galleryId, secret],
    queryFn: () => fetchGallery({ data: { secret, id: galleryId } }),
  });

  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFiles(files: File[]) {
    const valid = files.filter((f) => /image\/(jpeg|png|webp)/i.test(f.type));
    if (valid.length === 0) return;
    setUploading({ done: 0, total: valid.length });
    for (let i = 0; i < valid.length; i++) {
      const f = valid[i]!;
      const req = await request({
        data: { secret, galleryId, filename: f.name, contentType: f.type },
      });
      if (!req.ok) {
        alert(req.error);
        continue;
      }
      const res = await fetch(req.signedUrl, {
        method: "PUT",
        headers: { "content-type": f.type },
        body: f,
      });
      if (!res.ok) {
        alert("Upload failed");
        continue;
      }
      await register({
        data: { secret, galleryId, path: req.path, filename: f.name, size: f.size },
      });
      setUploading({ done: i + 1, total: valid.length });
    }
    setUploading(null);
    qc.invalidateQueries({ queryKey: ["manage-gallery", galleryId, secret] });
    qc.invalidateQueries({ queryKey: ["dashboard", secret] });
  }

  if (isLoading) {
    return <p className="pt-12 text-center text-muted-foreground">Loading gallery…</p>;
  }
  if (!data?.ok) {
    return <p className="pt-12 text-center text-muted-foreground">Gallery not found.</p>;
  }

  const g = data.gallery;

  return (
    <section>
      <button
        onClick={onBack}
        className="mb-8 text-xs tracking-[0.3em] uppercase text-muted-foreground hover:text-foreground"
      >
        ← Back to dashboard
      </button>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs tracking-[0.3em] uppercase text-brown">{g.client_name}</p>
          <h2 className="mt-2 font-heading text-4xl font-semibold">{g.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            PIN <span className="font-mono">{g.pin}</span> · {data.images.length} photos
            {g.expires_at && <> · expires {new Date(g.expires_at).toLocaleString()}</>}
          </p>
        </div>
        <button
          onClick={async () => {
            const newPin = prompt("New PIN:", g.pin);
            if (!newPin || newPin === g.pin) return;
            const res = await update({ data: { secret, id: galleryId, pin: newPin } });
            if (!res.ok) alert(res.error ?? "Failed");
            else qc.invalidateQueries({ queryKey: ["manage-gallery", galleryId, secret] });
          }}
          className="rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          Change PIN
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          uploadFiles(Array.from(e.dataTransfer.files));
        }}
        className={
          "mt-8 rounded-2xl border-2 border-dashed p-10 text-center transition " +
          (dragOver ? "border-pine bg-pine/10" : "border-black/10 bg-black/[0.02]")
        }
      >
        <p className="font-heading text-xl">Drag & drop images</p>
        <p className="mt-1 text-sm text-muted-foreground">JPEG, PNG, or WEBP</p>
        <label className="mt-4 inline-block cursor-pointer rounded-full bg-pine px-5 py-2 text-sm font-semibold text-pine-foreground">
          Choose files
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(Array.from(e.target.files))}
          />
        </label>
        {uploading && (
          <p className="mt-4 text-sm text-muted-foreground">
            Uploading {uploading.done} / {uploading.total}…
          </p>
        )}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data.images.map((img) => (
          <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl bg-black/5">
            {img.url && (
              <img
                src={img.url}
                alt={img.original_filename}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
            <button
              onClick={async () => {
                if (!confirm("Delete this image?")) return;
                await remove({ data: { secret, imageId: img.id } });
                qc.invalidateQueries({ queryKey: ["manage-gallery", galleryId, secret] });
                qc.invalidateQueries({ queryKey: ["dashboard", secret] });
              }}
              className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[0.65rem] uppercase tracking-widest text-white opacity-0 transition group-hover:opacity-100"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}