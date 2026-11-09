"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowsClockwise, WarningCircle } from "@phosphor-icons/react";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/errors";
import type { Viewer } from "@/lib/types";
import { Button } from "@/components/ui/button";

const ViewerContext = createContext<Viewer | null>(null);

export function useViewer(): Viewer {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error("useViewer must be used inside WorkspaceGate");
  return viewer;
}

function OpeningScreen() {
  return (
    <div className="grid min-h-[100dvh] place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="bg-moss text-on-moss mx-auto grid size-10 place-items-center rounded-full">
          <ArrowsClockwise size={20} className="animate-[spin_5s_linear_infinite]" />
        </div>
        <p className="text-ink mt-5 text-center text-sm font-medium">
          Opening your loop…
        </p>
        <div className="mt-7 space-y-2.5">
          <div className="bg-sunken h-3 w-full rounded-full" />
          <div className="bg-sunken/80 h-3 w-4/5 rounded-full" />
          <div className="bg-sunken/60 h-3 w-2/3 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const viewer = useQuery(api.users.viewer);
  const ensureViewer = useMutation(api.users.ensureViewer);
  const [created, setCreated] = useState<Viewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const provision = useCallback(async () => {
    setError(null);
    started.current = true;
    try {
      const result = await ensureViewer();
      if (result) setCreated(result);
    } catch (cause) {
      setError(getErrorMessage(cause, "We could not open your profile."));
      started.current = false;
    }
  }, [ensureViewer]);

  useEffect(() => {
    if (!isLoaded || authLoading || !isAuthenticated || started.current) return;
    void provision();
  }, [authLoading, isAuthenticated, isLoaded, provision]);

  if (error) {
    return (
      <div className="grid min-h-[100dvh] place-items-center px-6">
        <div className="border-line bg-surface rounded-card w-full max-w-md border p-7">
          <div className="bg-clay/10 text-clay grid size-10 place-items-center rounded-full">
            <WarningCircle size={21} />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-[-0.02em]">
            Profile setup paused
          </h1>
          <p className="text-muted mt-2 text-sm leading-6">{error}</p>
          <p className="text-faint mt-3 text-xs leading-5">
            If this mentions an email claim, enable the Convex JWT template in Clerk
            with an email claim, then try again.
          </p>
          <div className="mt-6 flex gap-2">
            <Button onClick={() => void provision()}>Try again</Button>
            <Link
              href="/"
              className="text-muted hover:bg-sunken hover:text-ink inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition"
            >
              Back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeViewer = viewer ?? created;

  if (!isLoaded || authLoading || !activeViewer) {
    return <OpeningScreen />;
  }

  return (
    <ViewerContext.Provider value={activeViewer}>{children}</ViewerContext.Provider>
  );
}
