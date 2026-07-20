import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyPin } from "@/lib/gallery.functions";
import { OslnzLogo } from "@/components/OslnzLogo";

export const Route = createFileRoute("/")({
  component: PinEntry,
});

function PinEntry() {
  const navigate = useNavigate();
  const verify = useServerFn(verifyPin);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        className="absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 0%, oklch(0.42 0.06 155 / 0.35), transparent 60%), radial-gradient(50% 40% at 80% 100%, oklch(0.42 0.07 55 / 0.28), transparent 60%)",
        }}
      />

      <header className="mx-auto max-w-6xl px-8 pt-10">
        <OslnzLogo />
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

      <footer className="pb-8 text-center text-xs text-muted-foreground/60">
        © {new Date().getFullYear()} OSLNZ. All galleries are private.
      </footer>
    </main>
  );
}
