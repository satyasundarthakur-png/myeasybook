import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const PageboundApp = lazy(() => import("../pagebound/App"));

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <ClientOnly
      fallback={
        <div className="flex h-screen items-center justify-center bg-ink text-paper font-mono text-xs tracking-widest">
          LOADING PAGEBOUND…
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center bg-ink text-paper font-mono text-xs tracking-widest">
            LOADING PAGEBOUND…
          </div>
        }
      >
        <PageboundApp />
      </Suspense>
    </ClientOnly>
  );
}
