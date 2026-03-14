"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, UploadCloud } from "lucide-react";
import { useMapContext } from "@/context/MapContext";

function ensureFloorCapacities(
  capacities: Record<number, number>,
  totalFloors: number,
): Record<number, number> {
  const next: Record<number, number> = {};

  for (let floor = 1; floor <= totalFloors; floor += 1) {
    const value = capacities[floor] ?? 0;
    next[floor] = Math.max(0, Math.floor(value));
  }

  return next;
}

export function EditingSidebar() {
  const {
    role,
    isEditing,
    creationPhase,
    draftBuildingFootprint,
    currentBuildingData,
    activeFloorNumber,
    setActiveFloorNumber,
    publishFootprint,
    saveBuildingDesign,
    notice,
  } = useMapContext();

  const [buildingName, setBuildingName] = useState("");
  const [floorCount, setFloorCount] = useState(4);
  const [floorCapacities, setFloorCapacities] = useState<Record<number, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  });

  const showPanel = creationPhase >= 2 && isEditing && role === "admin";

  const floorOptions = useMemo(() => {
    const totalFloors = currentBuildingData?.totalFloors ?? floorCount;
    return Array.from({ length: totalFloors }, (_, index) => index + 1);
  }, [currentBuildingData?.totalFloors, floorCount]);

  if (role !== "admin") {
    return null;
  }

  return (
    <aside className={`absolute top-0 right-0 h-full w-96 z-50 border-l border-white/60 bg-white/50 p-6 shadow-2xl shadow-slate-900/20 backdrop-blur-2xl transition-transform duration-500 ${showPanel ? "translate-x-0" : "translate-x-full"}`}>
      <div className="flex h-full flex-col">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">Campus Architect</h3>
        <p className="mt-1 text-sm text-slate-500">
          {creationPhase === 2 ? "Phase 2: Data Capture" : "Phase 3: Floor & Interior Design"}
        </p>

        {creationPhase === 2 ? (
          <div className="mt-6 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Building ID / Name
              <input
                value={buildingName}
                onChange={(event) => setBuildingName(event.target.value)}
                placeholder="Science Center A"
                className="mt-2 w-full rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#007AFF]/50"
              />
            </label>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Number Of Floors</p>
              <div className="mt-2 flex items-center justify-between rounded-2xl border border-white/80 bg-white/85 px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextFloorCount = Math.max(1, floorCount - 1);
                    setFloorCount(nextFloorCount);
                    setFloorCapacities((previous) => ensureFloorCapacities(previous, nextFloorCount));
                  }}
                  className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100"
                >
                  <Minus size={16} />
                </button>
                <span className="text-lg font-semibold text-slate-900">{floorCount}</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextFloorCount = Math.min(100, floorCount + 1);
                    setFloorCount(nextFloorCount);
                    setFloorCapacities((previous) => ensureFloorCapacities(previous, nextFloorCount));
                  }}
                  className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Floor Capacities</p>
              <div className="mt-3 max-h-52 space-y-2 overflow-auto pr-1">
                {floorOptions.map((floor) => (
                  <label
                    key={floor}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-700">Level {floor}</span>
                    <input
                      type="number"
                      min={0}
                      value={floorCapacities[floor] ?? 0}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setFloorCapacities((previous) => ({
                          ...previous,
                          [floor]: Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0,
                        }));
                      }}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm text-slate-800 outline-none focus:border-[#007AFF]/50"
                    />
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={!draftBuildingFootprint}
              onClick={() =>
                publishFootprint({
                  name: buildingName,
                  totalFloors: floorCount,
                  floorCapacities: ensureFloorCapacities(floorCapacities, floorCount),
                })
              }
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#007AFF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0062cc] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <UploadCloud size={16} />
              Publish Footprint
            </button>
          </div>
        ) : null}

        {creationPhase === 3 && currentBuildingData ? (
          <div className="mt-6 flex-1 space-y-4 overflow-auto pr-1">
            <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Building</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{currentBuildingData.name}</p>
              <p className="mt-1 text-xs text-slate-500">{currentBuildingData.totalFloors} Floors</p>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Floor Selector</p>
              <div className="mt-3 space-y-2">
                {floorOptions.map((floor) => {
                  const seats = currentBuildingData.seats.filter((seat) => seat.floor === floor).length;
                  const capacity = currentBuildingData.floorCapacities[floor] ?? 0;

                  return (
                    <button
                      key={floor}
                      type="button"
                      onClick={() => setActiveFloorNumber(floor)}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${activeFloorNumber === floor ? "border-[#007AFF]/50 bg-[#007AFF]/10 text-[#007AFF]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      <p className="text-sm font-semibold">Level {floor}</p>
                      <p className="text-xs opacity-80">
                        {seats} Seats · Capacity {capacity}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/80 p-4 text-xs text-slate-600">
              Use the User tool to place seats for the active floor.
            </div>

            <button
              type="button"
              onClick={saveBuildingDesign}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#34C759] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2da84b]"
            >
              <UploadCloud size={16} />
              Save Building
            </button>
          </div>
        ) : null}

        {notice ? (
          <div className="mt-4 rounded-xl bg-slate-900/90 px-3 py-2 text-xs text-white">{notice}</div>
        ) : null}
      </div>
    </aside>
  );
}
