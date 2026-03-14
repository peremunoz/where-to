"use client";

import { Map, Settings, Users } from "lucide-react";
import { useMapContext } from "@/context/MapContext";

export function RoleToggle() {
  const { role, setRole, editMode, setEditMode, isMobileViewport } = useMapContext();

  if (isMobileViewport) {
    return null;
  }

  return (
    <div className="absolute right-3 top-3 z-30 space-y-3 sm:right-6 sm:top-6">
      <div className="rounded-2xl border border-white/60 bg-white/80 p-1.5 shadow-lg shadow-slate-900/10 backdrop-blur-md">
        <div className={`grid gap-1 ${isMobileViewport ? "grid-cols-1" : "grid-cols-2"}`}>
          <button
            type="button"
            onClick={() => {
              setRole("student");
              setEditMode(false);
            }}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              role === "student"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users size={16} />
            Student
          </button>
          {!isMobileViewport ? (
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                role === "admin"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Settings size={16} />
              Admin
            </button>
          ) : null}
        </div>
      </div>

      {role === "admin" ? (
        <button
          type="button"
          onClick={() => setEditMode(!editMode)}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md transition ${
            editMode
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-800"
              : "border-white/60 bg-white/80 text-slate-700"
          }`}
        >
          <Map size={16} />
          {editMode ? "Edit Mode Active" : "Enter Edit Mode"}
        </button>
      ) : null}
    </div>
  );
}
