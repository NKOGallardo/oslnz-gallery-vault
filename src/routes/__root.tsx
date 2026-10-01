import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="center-screen">
      <div style={{ maxWidth: "28rem" }}>
        <h1 className="notfound__code">404</h1>
        <h2 style={{ marginTop: "1rem", fontSize: "1.25rem" }}>Page not found</h2>
        <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div style={{ marginTop: "1.5rem" }}>
          <Link to="/" className="btn btn--primary">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="center-screen">
      <div style={{ maxWidth: "28rem" }}>
        <h1 style={{ fontSize: "1.25rem" }}>This page didn't load</h1>
        <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div style={{ marginTop: "1.5rem", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.5rem" }}>
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn btn--primary"
          >
            Try again
          </button>
          <a href="/" className="btn btn--outline">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OSLNZ — Private Client Gallery" },
      { name: "description", content: "Enter your private OSLNZ gallery PIN to securely view and download your photos." },
      { name: "author", content: "OSLNZ" },
      { property: "og:title", content: "OSLNZ — Private Client Gallery" },
      { property: "og:description", content: "Enter your private OSLNZ gallery PIN to securely view and download your photos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "twitter:title", content: "OSLNZ — Private Client Gallery" },
      { name: "twitter:description", content: "Enter your private OSLNZ gallery PIN to securely view and download your photos." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c5c2e741-e717-4953-a116-026218ba15a6/id-preview-6f7534b4--e24504e1-d255-45c5-9a48-f0b737a90c91.lovable.app-1784547167577.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c5c2e741-e717-4953-a116-026218ba15a6/id-preview-6f7534b4--e24504e1-d255-45c5-9a48-f0b737a90c91.lovable.app-1784547167577.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
