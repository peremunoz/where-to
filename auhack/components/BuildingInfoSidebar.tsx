"use client";

import { useMemo } from "react";
import { Armchair, Building2, Circle, CircleOff, DoorOpen, Table2, Users, X } from "lucide-react";
import { useMapContext } from "@/context/MapContext";
import type { Seat, SeatType } from "@/lib/campus-data";

interface SeatSchemePoint {
  seat: Seat;
  left: number;
  top: number;
}

function toSeatSchemePoints(seats: Seat[]): SeatSchemePoint[] {
  if (seats.length === 0) {
    return [];
  }

  const lngs = seats.map((seat) => seat.coordinates[0]);
  const lats = seats.map((seat) => seat.coordinates[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lngSpan = Math.max(maxLng - minLng, 0.000001);
  const latSpan = Math.max(maxLat - minLat, 0.000001);

  return seats.map((seat) => {
    const left = ((seat.coordinates[0] - minLng) / lngSpan) * 100;
    const top = 100 - ((seat.coordinates[1] - minLat) / latSpan) * 100;

    return {
      seat,
      left: Math.min(96, Math.max(4, left)),
      top: Math.min(96, Math.max(4, top)),
    };
  });
}

function seatStatusClass(status: Seat["status"]): string {
  if (status === "Occupied") {
    return "bg-rose-500 text-white";
  }

  if (status === "Maintenance") {
    return "bg-amber-400 text-slate-900";
  }

  return "bg-emerald-500 text-white";
}

function SeatTypeIcon({ type }: { type: SeatType }) {
  if (type === "TABLE") {
    return <Table2 size={12} />;
  }

  if (type === "SOFA") {
    return <Armchair size={12} />;
  }

  return <Circle size={12} />;
}

export function BuildingInfoSidebar() {
  const {
    selectedBuilding,
    setSelectedBuildingId,
    buildingInfoOpen,
    closeBuildingInfo,
    directionsTargetBuildingId,
    setDirectionsTargetBuildingId,
    activeFloor,
    setActiveFloor,
    role,
    isEditing,
  } = useMapContext();

  const floorStats = useMemo(() => {
    if (!selectedBuilding) {
      return [];
    }

    return selectedBuilding.floors.map((floor) => {
      const seats = floor.rooms.flatMap((room) => room.seats);
      const total = seats.length;
      const occupied = seats.filter((seat) => seat.status === "Occupied").length;
      const maintenance = seats.filter((seat) => seat.status === "Maintenance").length;
      const free = seats.filter((seat) => seat.status === "Available").length;

      return {
        floorId: floor.id,
        floorLabel: floor.label,
        rooms: floor.rooms.length,
        total,
        free,
        occupied,
        maintenance,
        occupancy: total > 0 ? Math.round((occupied / total) * 100) : 0,
      };
    });
  }, [selectedBuilding]);

  const selectedFloorScheme = useMemo(() => {
    if (!selectedBuilding) {
      return null;
    }

    const floor = selectedBuilding.floors.find((item) => item.label === activeFloor);
    if (!floor) {
      return null;
    }

    const seats = floor.rooms.flatMap((room) => room.seats);
    return {
      label: floor.label,
      seats,
      points: toSeatSchemePoints(seats),
    };
  }, [activeFloor, selectedBuilding]);

  if (role === "admin" && isEditing) {
    return null;
  }

  const isVisible = buildingInfoOpen && selectedBuilding;

  return (
    <aside
      className={`absolute right-0 top-0 z-40 h-full w-full border-l border-white/60 bg-white/85 p-4 shadow-2xl shadow-slate-900/20 backdrop-blur-xl transition-transform duration-300 sm:w-[360px] sm:p-5 ${
        isVisible ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {selectedBuilding ? (
        <div className="flex h-full flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800">
              <Building2 size={18} />
              <h3 className="text-lg font-semibold">Building Insights</h3>
            </div>
            <button
              type="button"
              onClick={closeBuildingInfo}
              className="rounded-xl bg-white/80 p-2 text-slate-600 transition hover:bg-slate-100"
              title="Close details"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!selectedBuilding) {
                  return;
                }

                if (directionsTargetBuildingId === selectedBuilding.id) {
                  setDirectionsTargetBuildingId(null);
                  return;
                }

                setDirectionsTargetBuildingId(selectedBuilding.id);
              }}
              className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
            >
              {selectedBuilding && directionsTargetBuildingId === selectedBuilding.id
                ? "Clear Directions"
                : "Directions"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedBuildingId(null);
                setDirectionsTargetBuildingId(null);
                closeBuildingInfo();
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Deselect Building
            </button>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Selected Building</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{selectedBuilding.name}</p>
            <p className="mt-1 text-xs text-slate-500">{selectedBuilding.floors.length} floors</p>
          </div>

          {selectedFloorScheme ? (
            <div className="mt-4 rounded-2xl border border-white/80 bg-white/90 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Floor Scheme</p>
                <p className="text-xs font-semibold text-slate-700">Floor {selectedFloorScheme.label}</p>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {selectedBuilding.floors.map((floor) => (
                  <button
                    key={`info-floor-${floor.id}`}
                    type="button"
                    onClick={() => setActiveFloor(floor.label)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${activeFloor === floor.label ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {floor.label}
                  </button>
                ))}
              </div>

              <div className="relative h-44 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100">
                {selectedFloorScheme.points.map(({ seat, left, top }) => (
                  <div
                    key={seat.id}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1.5 shadow ${seatStatusClass(seat.status)}`}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    title={`${seat.sensorId} · ${seat.type} · ${seat.status}`}
                  >
                    <SeatTypeIcon type={seat.type} />
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Available</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />Occupied</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Maintenance</span>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex-1 space-y-3 overflow-auto pr-1">
            {floorStats.map((floor) => (
              <div key={floor.floorId} className="rounded-2xl border border-white/80 bg-white/90 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Floor {floor.floorLabel}</p>
                  <p className="text-xs font-semibold text-slate-600">{floor.occupancy}% occupied</p>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#34C759] via-[#FF9500] to-[#FF3B30]"
                    style={{ width: `${floor.occupancy}%` }}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="font-semibold">Rooms</p>
                    <p>{floor.rooms}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="font-semibold">Total Seats</p>
                    <p>{floor.total}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
                    <p className="flex items-center gap-1 font-semibold">
                      <DoorOpen size={13} />
                      Free Spaces
                    </p>
                    <p>{floor.free}</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
                    <p className="flex items-center gap-1 font-semibold">
                      <Users size={13} />
                      Occupied
                    </p>
                    <p>{floor.occupied}</p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-700">
                    <p className="flex items-center gap-1 font-semibold">
                      <CircleOff size={13} />
                      Maintenance
                    </p>
                    <p>{floor.maintenance}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
