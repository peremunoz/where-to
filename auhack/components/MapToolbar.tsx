"use client";

import { Square, Trash2, User } from "lucide-react";
import { useMapContext } from "@/context/MapContext";

export function MapToolbar() {
  const {
    role,
    isEditing,
    creationPhase,
    activeTool,
    setActiveTool,
    deleteLastInterior,
  } = useMapContext();

  if (role !== "admin" || !isEditing) {
    return null;
  }

  return (
    <aside className="absolute left-6 top-1/2 z-40 -translate-y-1/2 rounded-[2rem] border border-white/60 bg-white/55 p-3 shadow-2xl shadow-slate-900/15 backdrop-blur-xl">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setActiveTool("building")}
          className={`rounded-2xl p-3 transition ${activeTool === "building" ? "bg-[#007AFF] text-white" : "bg-white/80 text-slate-600 hover:bg-slate-100"}`}
          title="Draw Building"
        >
          <Square size={18} />
        </button>

        <button
          type="button"
          onClick={() => setActiveTool("seat")}
          disabled={creationPhase !== 3}
          className={`rounded-2xl p-3 transition ${activeTool === "seat" ? "bg-[#34C759] text-white" : "bg-white/80 text-slate-600 hover:bg-slate-100"} disabled:cursor-not-allowed disabled:opacity-40`}
          title="Place Seat"
        >
          <User size={18} />
        </button>

        <button
          type="button"
          onClick={deleteLastInterior}
          disabled={creationPhase !== 3}
          className="rounded-2xl bg-white/80 p-3 text-slate-600 transition hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] disabled:cursor-not-allowed disabled:opacity-40"
          title="Delete Last"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </aside>
  );
}
