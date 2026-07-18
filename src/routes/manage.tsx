import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/manage")({
  head: () => ({
    meta: [
      { title: "Not Found" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  loader: () => {
    throw notFound();
  },
  component: () => null,
});