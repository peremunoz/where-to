"use client";

import { Layers } from "lucide-react";
import { useMapContext } from "@/context/MapContext";
import type { FloorLabel } from "@/lib/campus-data";

const FLOORS: FloorLabel[] = ["4", "3", "2", "1", "G"];

export function FloorPicker() {
  const { role, activeFloor, setActiveFloor } = useMapContext();

  if (role !== "student") {
    return null;
  }

  return (
    <aside className="absolute right-6 top-1/2 z-20 -translate-y-1/2 rounded-[2rem] border border-white/50 bg-white/70 p-3 shadow-xl shadow-slate-900/10 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-center text-slate-500">
        <Layers size={16} />
      </div>
      <div className="flex flex-col gap-2">
        {FLOORS.map((floor) => (
          <button
            key={floor}
            type="button"
            onClick={() => setActiveFloor(floor)}
            className={`h-10 w-10 rounded-full text-sm font-semibold transition ${
              activeFloor === floor
                ? "bg-slate-900 text-white"
                : "bg-white/80 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {floor}
          </button>
        ))}
      </div>
    </aside>
  );
}
