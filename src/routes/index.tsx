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
    <main className="page page--clip">
      {/* backdrop */}
      <div
        aria-hidden
        className="page__bg"
        style={{ backgroundImage: `url(${bgFloral.url})` }}
      />
      <div aria-hidden className="page__veil" />

      <header className="shell shell--md">
        <div className="topbar">
          <OslnzLogo />
          <button
            type="button"
            onClick={() => {
              setAdminOpen(true);
              setAdminError(null);
              setAdminCode("");
            }}
            className="btn btn--outline btn--pill"
          >
            Admin Login
          </button>
        </div>
      </header>

      <section className="showcase">
        <p className="eyebrow">Private Client Access</p>
        <h1 className="hero__title">
          Welcome to the <span className="accent">OSLNZ</span> Client Gallery
        </h1>
        <p className="hero__copy">
          Scroll through a glimpse of our work, then enter the private gallery PIN
          provided by your photographer.
        </p>
        <a href="#pin" className="scroll-cue">
          Scroll <span aria-hidden>↓</span>
        </a>

        <div className="showcase__strip">
          {showcase.map((img, i) => (
            <figure key={img.caption} className={`showcase__item showcase__item--${i % 4}`}>
              <img
                src={img.src}
                width={img.w}
                height={img.h}
                loading={i === 0 ? "eager" : "lazy"}
                alt={`OSLNZ ${img.caption.toLowerCase()} photography`}
              />
              <figcaption>{img.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="hero" id="pin">
        <p className="eyebrow">Your Gallery</p>
        <h2 className="hero__title">Enter your PIN</h2>
        <p className="hero__copy">
          Use the 5-character PIN provided by your photographer to securely access
          your photos.
        </p>

        <form onSubmit={onSubmit} className="hero__form">
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
            className="input pin-input"
          />
          <button
            type="submit"
            disabled={loading || !pin.trim()}
            className="btn btn--primary btn--block btn--lg"
          >
            {loading ? "Verifying…" : "View Gallery"}
          </button>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
        </form>

        <p className="hero__tag">Elegant · Private · Timeless</p>
      </section>

      <footer className="site-footer">
        <div>© {new Date().getFullYear()} OSLNZ. All galleries are private.</div>
        <div className="kicker">Made by NKO_Coding.codes</div>
      </footer>

      {adminOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-login-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdminOpen(false);
          }}
        >
          <div className="modal">
            <div className="modal__head">
              <h2 id="admin-login-title" className="modal__title">
                Admin Login
              </h2>
              <button
                type="button"
                onClick={() => setAdminOpen(false)}
                className="btn--ghost"
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
                className="input pin-input"
              />
              <button
                type="submit"
                disabled={adminLoading || !adminCode.trim()}
                className="btn btn--primary btn--block"
              >
                {adminLoading ? "Verifying…" : "Enter Dashboard"}
              </button>
              {adminError && (
                <p className="error-text" role="alert">
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
