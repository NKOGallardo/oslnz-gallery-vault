import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyPin } from "@/lib/gallery.functions";
import { adminLogin } from "@/lib/photographer.functions";
import { OslnzLogo } from "@/components/OslnzLogo";
import bgFloral from "@/assets/bg-floral.jpeg.asset.json";

export const Route = createFileRoute("/")({
  component: PinEntry,
});

function PinEntry() {
  const navigate = useNavigate();
  const verify = useServerFn(verifyPin);
  const login = useServerFn(adminLogin);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAdminOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adminOpen]);

  async function onAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adminCode.trim() || adminLoading) return;
    setAdminLoading(true);
    setAdminError(null);
    try {
      const res = await login({ data: { code: adminCode.trim() } });
      if (!res.ok) {
        setAdminError(res.error);
        setAdminLoading(false);
        return;
      }
      navigate({ to: "/manage/$secret", params: { secret: res.secret } });
    } catch {
      setAdminError("Something went wrong. Please try again.");
      setAdminLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await verify({ data: { pin: pin.trim() } });
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      navigate({ to: "/g/$token", params: { token: res.token } });
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgFloral.url})` }}
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-black/70" />

      <header className="mx-auto max-w-6xl px-8 pt-10">
        <div className="flex items-center justify-between">
          <OslnzLogo />
          <button
            type="button"
            onClick={() => {
              setAdminOpen(true);
              setAdminError(null);
              setAdminCode("");
            }}
            className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs tracking-[0.25em] uppercase text-muted-foreground transition hover:border-pine hover:text-foreground"
          >
            Admin Login
          </button>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl flex-col items-center justify-center px-6 pb-24 text-center">
        <p className="mb-6 text-xs tracking-[0.4em] uppercase text-brown">
          Private Client Access
        </p>
        <h1 className="font-heading text-5xl font-semibold leading-tight sm:text-6xl">
          Welcome to the <span className="text-pine">OSLNZ</span> Client Gallery
        </h1>
        <p className="mt-6 max-w-md text-base text-muted-foreground leading-relaxed">
          Enter the private gallery PIN provided by your photographer to securely
          access your photos.
        </p>

        <form onSubmit={onSubmit} className="mt-12 w-full max-w-sm">
          <label htmlFor="pin" className="sr-only">
            Gallery PIN
          </label>
          <input
            id="pin"
            name="pin"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.slice(0, 5));
              if (error) setError(null);
            }}
            placeholder="Enter your 5-character PIN"
            maxLength={5}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 text-center text-2xl tracking-[0.35em] font-display font-medium uppercase text-foreground outline-none placeholder:tracking-[0.2em] placeholder:normal-case placeholder:text-muted-foreground/60 focus:border-pine focus:bg-white/[0.06]"
          />
          <button
            type="submit"
            disabled={loading || !pin.trim()}
            className="mt-5 w-full rounded-2xl bg-pine px-6 py-5 text-base font-semibold tracking-wide text-pine-foreground shadow-lg shadow-black/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verifying…" : "View Gallery"}
          </button>
          {error && (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>

        <p className="mt-16 text-xs tracking-[0.3em] uppercase text-muted-foreground/70">
          Elegant · Private · Timeless
        </p>
      </section>

      <footer className="pb-8 text-center text-xs text-muted-foreground/60 space-y-1">
        <div>© {new Date().getFullYear()} OSLNZ. All galleries are private.</div>
        <div className="tracking-[0.25em] uppercase">Made by NKO_Coding.codes</div>
      </footer>

      {adminOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-login-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdminOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-background p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 id="admin-login-title" className="font-heading text-xl font-semibold">
                Admin Login
              </h2>
              <button
                type="button"
                onClick={() => setAdminOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={onAdminSubmit}>
              <label htmlFor="admin-code" className="sr-only">
                Admin code
              </label>
              <input
                id="admin-code"
                type="password"
                autoFocus
                autoComplete="off"
                value={adminCode}
                onChange={(e) => {
                  setAdminCode(e.target.value);
                  if (adminError) setAdminError(null);
                }}
                placeholder="Enter admin code"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center text-lg tracking-[0.3em] font-display outline-none placeholder:tracking-normal placeholder:text-muted-foreground/60 focus:border-pine focus:bg-white/[0.06]"
              />
              <button
                type="submit"
                disabled={adminLoading || !adminCode.trim()}
                className="mt-4 w-full rounded-xl bg-pine px-6 py-4 text-sm font-semibold tracking-wide text-pine-foreground shadow-lg shadow-black/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adminLoading ? "Verifying…" : "Enter Dashboard"}
              </button>
              {adminError && (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {adminError}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
