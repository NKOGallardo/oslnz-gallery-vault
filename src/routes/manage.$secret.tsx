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
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <p className="text-sm tracking-[0.3em] uppercase">Loading…</p>
      </div>
    );
  }

  if (!data?.ok) {
    return <AccessDenied />;
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["dashboard", secret] });

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgFloral.url})` }}
      />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8 sm:px-10">
        <OslnzLogo />
        <nav className="flex items-center gap-2 text-xs tracking-[0.3em] uppercase">
          <button
            onClick={() => setView({ kind: "dashboard" })}
            className={
              "rounded-full px-4 py-2 transition " +
              (view.kind === "dashboard" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            Dashboard
          </button>
          <button
            onClick={() => setView({ kind: "create" })}
            className={
              "rounded-full px-4 py-2 transition " +
              (view.kind === "create" ? "bg-pine text-pine-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            + New Gallery
          </button>
          <SettingsMenu secret={secret} />
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-6 pb-24 sm:px-10">
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-heading text-7xl font-semibold">404</h1>
      <p className="text-muted-foreground">Page not found.</p>
      <Link to="/" className="text-xs tracking-[0.3em] uppercase text-pine hover:text-foreground">
        Go home
      </Link>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground">{label}</p>
      <p className="mt-3 font-heading text-4xl font-semibold">{value}</p>
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
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Galleries" value={data.stats.totalGalleries} />
        <StatCard label="Total Photos" value={data.stats.totalImages} />
        <StatCard label="Total Downloads" value={data.stats.totalDownloads} />
      </section>

      <section className="mt-12">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase text-brown">Manage</p>
            <h2 className="font-heading text-3xl font-semibold">Your Galleries</h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client or PIN…"
              className="w-64 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm outline-none focus:border-pine"
            />
            <button
              onClick={onNew}
              className="rounded-full bg-pine px-5 py-2 text-sm font-semibold text-pine-foreground"
            >
              Create Gallery
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-muted-foreground">
            No galleries yet. Create your first one to get started.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    <div className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-pine/60">
      <div>
        <p className="text-[0.65rem] tracking-[0.3em] uppercase text-brown">{gallery.client_name}</p>
        <h3 className="mt-1 font-heading text-xl font-semibold">{gallery.title}</h3>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
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

      <div className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2 font-mono text-sm">
        <span className="tracking-[0.2em]">PIN: {gallery.pin}</span>
        <button
          onClick={() => navigator.clipboard.writeText(gallery.pin)}
          className="text-xs uppercase tracking-widest text-pine hover:text-foreground"
        >
          Copy
        </button>
      </div>

      {qr && (
        <div className="flex justify-center rounded-xl bg-white p-3">
          <img src={qr} alt="QR" className="h-40 w-40" />
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={onOpen}
          className="rounded-full bg-pine px-4 py-2 font-semibold text-pine-foreground"
        >
          Open
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(link)}
          className="rounded-full border border-white/10 px-4 py-2 text-muted-foreground hover:text-foreground"
        >
          Copy Link
        </button>
        <button
          onClick={async () => {
            if (qr) return setQr(null);
            const dataUrl = await QRCode.toDataURL(link, { margin: 1, width: 320 });
            setQr(dataUrl);
          }}
          className="rounded-full border border-white/10 px-4 py-2 text-muted-foreground hover:text-foreground"
        >
          {qr ? "Hide QR" : "QR"}
        </button>
        <button
          onClick={onDuplicate}
          className="rounded-full border border-white/10 px-4 py-2 text-muted-foreground hover:text-foreground"
        >
          Duplicate
        </button>
        <button
          onClick={onDelete}
          className="rounded-full border border-destructive/40 px-4 py-2 text-destructive hover:bg-destructive/10"
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
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full px-4 py-2 text-muted-foreground hover:text-foreground"
      >
        Settings
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-80 rounded-2xl border border-white/10 bg-card p-4 shadow-2xl">
          <p className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground">
            Danger zone
          </p>
          <p className="mt-2 text-sm text-foreground">
            Rotate your private management URL. The previous URL becomes unusable.
          </p>
          {newUrl ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Save this URL now. It will not be shown again.
              </p>
              <code className="block break-all rounded-lg bg-black/40 p-3 text-xs">{newUrl}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newUrl);
                  window.location.href = newUrl;
                }}
                className="w-full rounded-full bg-pine py-2 text-sm font-semibold text-pine-foreground"
              >
                Copy & open
              </button>
            </div>
          ) : (
            <button
              onClick={doRotate}
              className="mt-4 w-full rounded-full border border-destructive/40 py-2 text-sm text-destructive hover:bg-destructive/10"
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
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-foreground outline-none focus:border-pine"
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
          className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
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
          (dragOver ? "border-pine bg-pine/10" : "border-white/10 bg-white/[0.02]")
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
          <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl bg-white/5">
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