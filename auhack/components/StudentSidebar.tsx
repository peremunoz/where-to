"use client";

import { useMemo, useState } from "react";
import { Map as MapIcon, Search, X } from "lucide-react";
import { useMapContext } from "@/context/MapContext";
import type { SeatStatus, SeatType } from "@/lib/campus-data";

type AvailabilityFilter = "all" | SeatStatus;
type SortMode = "closest" | "name";

interface SearchResult {
  id: string;
  buildingId: string;
  title: string;
  subtitle: string;
  distanceMeters: number | null;
  seatStatus?: SeatStatus;
  floorLabel?: string;
}

function distanceMeters(from: [number, number], to: [number, number]): number {
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const dLat = toRadians(to[1] - from[1]);
  const dLng = toRadians(to[0] - from[0]);
  const lat1 = toRadians(from[1]);
  const lat2 = toRadians(to[1]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function formatDistance(meters: number | null): string | null {
  if (meters === null || !Number.isFinite(meters)) {
    return null;
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(2)} km`;
}

function seatStatusPill(status: SeatStatus): string {
  if (status === "Available") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Occupied") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-amber-100 text-amber-700";
}

export function StudentSidebar() {
  const { role, buildings, userLocation, setSelectedBuildingId, openBuildingInfo, activeFloor, setActiveFloor, isMobileViewport } = useMapContext();
  const [query, setQuery] = useState("");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [seatTypeFilter, setSeatTypeFilter] = useState<"all" | SeatType>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("closest");

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const hasSeatFilters = seatTypeFilter !== "all" || availabilityFilter !== "all";
    if (!normalized && !hasSeatFilters) {
      return [];
    }

    const isSeatTypeMode = seatTypeFilter !== "all";

    if (isSeatTypeMode) {
      const floorResults: SearchResult[] = buildings.flatMap((building) =>
        building.floors.flatMap((floor) => {
          const matchingSeats = floor.rooms.flatMap((room) =>
            room.seats.filter((seat) => {
              if (seat.type !== seatTypeFilter) {
                return false;
              }

              if (availabilityFilter !== "all" && seat.status !== availabilityFilter) {
                return false;
              }

              if (!normalized) {
                return true;
              }

              return (
                seat.sensorId.toLowerCase().includes(normalized) ||
                room.name.toLowerCase().includes(normalized) ||
                building.name.toLowerCase().includes(normalized) ||
                floor.label.toLowerCase().includes(normalized)
              );
            }),
          );

          if (matchingSeats.length === 0) {
            return [];
          }

          const availableCount = matchingSeats.filter((seat) => seat.status === "Available").length;

          return [
            {
              id: `${building.id}-${floor.id}-${seatTypeFilter}-${availabilityFilter}`,
              buildingId: building.id,
              title: `${building.name} · Floor ${floor.label}`,
              subtitle: `${matchingSeats.length} ${seatTypeFilter.toLowerCase()} seat(s) · ${availableCount} available`,
              distanceMeters: userLocation ? distanceMeters(userLocation, building.center) : null,
              floorLabel: floor.label,
            },
          ];
        }),
      );

      if (sortMode === "closest") {
        return floorResults.sort((a, b) => {
          if (a.distanceMeters === null && b.distanceMeters === null) {
            return a.title.localeCompare(b.title);
          }

          if (a.distanceMeters === null) {
            return 1;
          }

          if (b.distanceMeters === null) {
            return -1;
          }

          return a.distanceMeters - b.distanceMeters;
        });
      }

      return floorResults.sort((a, b) => a.title.localeCompare(b.title));
    }

    const searchMatches: SearchResult[] = buildings.flatMap((building) => {
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
              distanceMeters: userLocation ? distanceMeters(userLocation, building.center) : null,
              floorLabel: floor.label,
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
                distanceMeters: userLocation ? distanceMeters(userLocation, building.center) : null,
              },
            ]
          : []),
        ...matchedRooms,
      ];
    });

    const seatMatches: SearchResult[] = buildings.flatMap((building) =>
      building.floors
        .filter((floor) => floor.label === activeFloor)
        .flatMap((floor) =>
          floor.rooms.flatMap((room) =>
            room.seats
              .filter((seat) => {
                if (seatTypeFilter !== "all" && seat.type !== seatTypeFilter) {
                  return false;
                }

                if (availabilityFilter !== "all" && seat.status !== availabilityFilter) {
                  return false;
                }

                if (!normalized) {
                  return true;
                }

                return (
                  seat.sensorId.toLowerCase().includes(normalized) ||
                  room.name.toLowerCase().includes(normalized) ||
                  building.name.toLowerCase().includes(normalized)
                );
              })
              .map((seat) => ({
                id: `${building.id}-${seat.id}`,
                buildingId: building.id,
                title: `${seat.type} · ${seat.sensorId}`,
                subtitle: `${building.name} · Floor ${floor.label} · ${seat.status}`,
                distanceMeters: userLocation ? distanceMeters(userLocation, seat.coordinates) : null,
                seatStatus: seat.status,
                floorLabel: floor.label,
              })),
          ),
        ),
    );

    const merged = [...searchMatches, ...seatMatches];
    const deduped = new Map<string, SearchResult>();
    for (const result of merged) {
      deduped.set(result.id, result);
    }

    const finalResults = Array.from(deduped.values());
    if (sortMode === "closest") {
      return finalResults.sort((a, b) => {
        if (a.distanceMeters === null && b.distanceMeters === null) {
          return a.title.localeCompare(b.title);
        }

        if (a.distanceMeters === null) {
          return 1;
        }

        if (b.distanceMeters === null) {
          return -1;
        }

        return a.distanceMeters - b.distanceMeters;
      });
    }

    return finalResults.sort((a, b) => a.title.localeCompare(b.title));
  }, [activeFloor, availabilityFilter, buildings, query, seatTypeFilter, sortMode, userLocation]);

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
              <MapIcon size={18} />
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
              placeholder="Find buildings, rooms or seats"
              className="w-full rounded-2xl border border-slate-200/80 bg-white/90 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-900/20"
            />
          </label>

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Seat Type
              <select
                value={seatTypeFilter}
                onChange={(event) => setSeatTypeFilter(event.target.value as "all" | SeatType)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-2 py-2 text-xs text-slate-700 outline-none"
              >
                <option value="all">All types</option>
                <option value="COMPUTER">Computer</option>
                <option value="TABLE">Table</option>
                <option value="SOFA">Sofa</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Availability
              <select
                value={availabilityFilter}
                onChange={(event) => setAvailabilityFilter(event.target.value as AvailabilityFilter)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-2 py-2 text-xs text-slate-700 outline-none"
              >
                <option value="all">All statuses</option>
                <option value="Available">Available</option>
                <option value="Occupied">Occupied</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </label>

            <label className="sm:col-span-2 text-xs font-semibold text-slate-600">
              Sort Results
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-2 py-2 text-xs text-slate-700 outline-none"
              >
                <option value="closest">Closest first</option>
                <option value="name">Name A-Z</option>
              </select>
            </label>
          </div>

          {query || seatTypeFilter !== "all" || availabilityFilter !== "all" ? (
            <div className="mb-4 max-h-44 space-y-2 overflow-auto pr-1">
              {results.length === 0 ? (
                <div className="rounded-xl bg-slate-100/80 px-3 py-2 text-xs text-slate-500">
                  {seatTypeFilter !== "all"
                    ? "No building floors match that seat type with current filters."
                    : `No matching results on floor ${activeFloor} with current filters.`}
                </div>
              ) : (
                results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      setSelectedBuildingId(result.buildingId);
                      if (result.floorLabel) {
                        setActiveFloor(result.floorLabel);
                      }
                      openBuildingInfo();
                      if (isMobileViewport) {
                        setIsMobileSearchOpen(false);
                      }
                    }}
                    className="w-full rounded-xl bg-white/80 px-3 py-2 text-left transition hover:bg-slate-100"
                  >
                    <p className="text-sm font-semibold text-slate-800">{result.title}</p>
                    <p className="text-xs text-slate-500">{result.subtitle}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      {"seatStatus" in result && result.seatStatus ? (
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${seatStatusPill(result.seatStatus)}`}>
                          {result.seatStatus}
                        </span>
                      ) : null}
                      {formatDistance(result.distanceMeters) ? (
                        <span className="font-semibold text-sky-700">{formatDistance(result.distanceMeters)}</span>
                      ) : (
                        <span className="text-slate-400">Location unavailable</span>
                      )}
                    </div>
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
