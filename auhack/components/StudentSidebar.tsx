"use client";

import { useMemo, useState } from "react";
import { Map, Search, X } from "lucide-react";
import { useMapContext } from "@/context/MapContext";

export function StudentSidebar() {
  const { role, buildings, setSelectedBuildingId, openBuildingInfo, activeFloor, isMobileViewport } = useMapContext();
  const [query, setQuery] = useState("");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    return buildings.flatMap((building) => {
      const matchedRooms = building.floors
        .filter((floor) => floor.label === activeFloor)
        .flatMap((floor) =>
          floor.rooms
            .filter((room) => room.name.toLowerCase().includes(normalized))
            .map((room) => ({
              id: `${building.id}-${room.id}`,
              buildingId: building.id,
              title: room.name,
              subtitle: `${building.name} · Floor ${floor.label}`,
            })),
        );

      const matchesBuilding = building.name.toLowerCase().includes(normalized);

      return [
        ...(matchesBuilding
          ? [
              {
                id: building.id,
                buildingId: building.id,
                title: building.name,
                subtitle: "Building",
              },
            ]
          : []),
        ...matchedRooms,
      ];
    });
  }, [activeFloor, buildings, query]);

  if (role !== "student") {
    return null;
  }

  const showSearchPanel = !isMobileViewport || isMobileSearchOpen;

  return (
    <>
      {isMobileViewport ? (
        <button
          type="button"
          onClick={() => setIsMobileSearchOpen((value) => !value)}
          className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-2xl border border-white/60 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur-md"
        >
          <Search size={15} />
          Search
        </button>
      ) : null}

      {showSearchPanel ? (
        <aside className="absolute left-3 right-3 top-16 z-20 w-auto rounded-3xl border border-white/60 bg-white/70 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-md sm:left-6 sm:right-auto sm:top-6 sm:w-[320px] sm:p-5">
          <div className="mb-4 flex items-center justify-between text-slate-700">
            <div className="flex items-center gap-2">
              <Map size={18} />
              <h2 className="text-lg font-semibold tracking-tight">Campus Discovery</h2>
            </div>
            {isMobileViewport ? (
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(false)}
                className="rounded-xl bg-white/80 p-2 text-slate-600"
                title="Close search"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          <label className="relative mb-4 block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find buildings or rooms"
              className="w-full rounded-2xl border border-slate-200/80 bg-white/90 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-900/20"
            />
          </label>

          {query ? (
            <div className="mb-4 max-h-44 space-y-2 overflow-auto pr-1">
              {results.length === 0 ? (
                <div className="rounded-xl bg-slate-100/80 px-3 py-2 text-xs text-slate-500">
                  No matching building or room on floor {activeFloor}.
                </div>
              ) : (
                results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      setSelectedBuildingId(result.buildingId);
                      openBuildingInfo();
                      if (isMobileViewport) {
                        setIsMobileSearchOpen(false);
                      }
                    }}
                    className="w-full rounded-xl bg-white/80 px-3 py-2 text-left transition hover:bg-slate-100"
                  >
                    <p className="text-sm font-semibold text-slate-800">{result.title}</p>
                    <p className="text-xs text-slate-500">{result.subtitle}</p>
                  </button>
                ))
              )}
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/80 bg-white/70 p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-700">Live Legend</p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Available
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Occupied
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Maintenance
              </div>
            </div>
          </div>
        </aside>
      ) : null}
    </>
  );
}
