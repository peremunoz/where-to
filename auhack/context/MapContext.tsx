"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CAMPUS_DATA,
  type Building,
  type Floor,
  type FloorLabel,
  type Room,
  type Seat,
  findBuildingById,
} from "@/lib/campus-data";
import {
  createBuilding,
  createFloor,
  createSeat,
  getBuildings,
  HARDCODED_INSTITUTION_ID,
  type ApiBuildingWithCapacity,
  type ApiPoint,
  type ApiSeat,
} from "@/lib/api";

export type UserRole = "admin" | "student";
export type ArchitectTool = "none" | "building" | "seat";
export type CreationPhase = 1 | 2 | 3;

export interface ArchitectSeat {
  id: string;
  floor: number;
  coordinates: [number, number];
  sensorId: string;
  spaceId: string;
}

export interface CurrentBuildingData {
  id: string;
  name: string;
  totalFloors: number;
  footprint: [number, number][];
  floorCapacities: Record<number, number>;
  seats: ArchitectSeat[];
}

interface MapContextValue {
  buildings: Building[];
  selectedBuilding: Building | null;
  selectedBuildingId: string | null;
  recentSavedBuildingId: string | null;
  buildingInfoOpen: boolean;
  isMobileViewport: boolean;
  activeFloor: FloorLabel;
  role: UserRole;
  editMode: boolean;
  isEditing: boolean;
  creationPhase: CreationPhase;
  activeTool: ArchitectTool;
  draftBuildingFootprint: [number, number][] | null;
  currentBuildingData: CurrentBuildingData | null;
  activeFloorNumber: number;
  notice: string | null;
  setRole: (role: UserRole) => void;
  setEditMode: (enabled: boolean) => void;
  setSelectedBuildingId: (buildingId: string | null) => void;
  setActiveFloor: (floor: FloorLabel) => void;
  setCreationPhase: (phase: CreationPhase) => void;
  setActiveTool: (tool: ArchitectTool) => void;
  setActiveFloorNumber: (floor: number) => void;
  setDraftBuildingFootprint: (polygon: [number, number][]) => void;
  openBuildingInfo: () => void;
  closeBuildingInfo: () => void;
  publishFootprint: (input: { name: string; totalFloors: number; floorCapacities: Record<number, number> }) => void;
  saveBuildingDesign: () => Promise<void>;
  addSeat: (input: { coordinates: [number, number]; sensorId?: string }) => void;
  updateBuildingFootprint: (polygon: [number, number][]) => void;
  deleteLastInterior: () => void;
  setNotice: (message: string | null) => void;
  clearRecentSavedBuilding: () => void;
}

const MapContext = createContext<MapContextValue | undefined>(undefined);

const DEFAULT_FLOOR: FloorLabel = "G";

const FLOOR_LABELS: FloorLabel[] = ["G", "1", "2", "3", "4"];

function floorNumberToLabel(floorNumber: number): FloorLabel {
  if (floorNumber <= 1) {
    return "G";
  }

  return FLOOR_LABELS[Math.min(floorNumber - 1, FLOOR_LABELS.length - 1)] as FloorLabel;
}

function polygonCenter(points: [number, number][]): [number, number] {
  if (points.length === 0) {
    return [0, 0];
  }

  const uniquePoints =
    points.length > 1 &&
    points[0]?.[0] === points[points.length - 1]?.[0] &&
    points[0]?.[1] === points[points.length - 1]?.[1]
      ? points.slice(0, -1)
      : points;

  const [lngSum, latSum] = uniquePoints.reduce(
    (accumulator, [lng, lat]) => [accumulator[0] + lng, accumulator[1] + lat],
    [0, 0],
  );

  return [lngSum / uniquePoints.length, latSum / uniquePoints.length];
}

function ensureClosedRing(points: [number, number][]): [number, number][] {
  if (points.length < 3) {
    return points;
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return points;
  }

  return [...points, first];
}

function apiPointToCoordinates(point: unknown): [number, number] | null {
  if (Array.isArray(point) && point.length >= 2) {
    const lng = Number(point[0]);
    const lat = Number(point[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return [lng, lat];
    }
    return null;
  }

  if (point && typeof point === "object" && "x" in point && "y" in point) {
    const maybePoint = point as ApiPoint;
    const lng = Number(maybePoint.x);
    const lat = Number(maybePoint.y);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return [lng, lat];
    }
  }

  return null;
}

function normalizePolygonForApi(points: Array<[number, number] | ApiPoint | unknown>): ApiPoint[] {
  const normalized: ApiPoint[] = [];

  for (const point of points) {
    if (Array.isArray(point) && point.length >= 2) {
      const x = Number(point[0]);
      const y = Number(point[1]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        normalized.push({ x, y });
      }
      continue;
    }

    if (point && typeof point === "object" && "x" in point && "y" in point) {
      const candidate = point as ApiPoint;
      const x = Number(candidate.x);
      const y = Number(candidate.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        normalized.push({ x, y });
      }
    }
  }

  return normalized;
}

function mapApiSeatStatus(status: ApiSeat["status"]): Seat["status"] {
  if (status === "AVAILABLE") {
    return "Available";
  }

  if (status === "OCCUPIED") {
    return "Occupied";
  }

  return "Maintenance";
}

function fallbackPolygonFromSeats(seatCoordinates: [number, number][]): [number, number][] {
  const center = polygonCenter(seatCoordinates);
  const [lng, lat] = center;
  return [
    [lng - 0.0002, lat - 0.0002],
    [lng + 0.0002, lat - 0.0002],
    [lng + 0.0002, lat + 0.0002],
    [lng - 0.0002, lat + 0.0002],
    [lng - 0.0002, lat - 0.0002],
  ];
}

function mapApiBuildingToBuilding(apiBuilding: ApiBuildingWithCapacity): Building {
  const allSeatCoordinates = apiBuilding.floors
    .flatMap((floor) => floor.seats ?? [])
    .filter((seat) => typeof seat.x === "number" && typeof seat.y === "number")
    .map((seat) => [seat.x as number, seat.y as number] as [number, number]);

  const sourcePolygon = (apiBuilding.polygon ?? [])
    .map(apiPointToCoordinates)
    .filter((point): point is [number, number] => point !== null);
  const polygon =
    sourcePolygon.length >= 3
      ? ensureClosedRing(sourcePolygon)
      : fallbackPolygonFromSeats(allSeatCoordinates.length > 0 ? allSeatCoordinates : [[10.2039, 56.1712]]);

  const center = polygonCenter(polygon);

  const floors: Floor[] = [...apiBuilding.floors]
    .sort((a, b) => a.floorNumber - b.floorNumber)
    .map((apiFloor) => {
      const floorNumber = apiFloor.floorNumber;
      const floorLabel = floorNumberToLabel(floorNumber);
      const floorSeats: Seat[] = [...(apiFloor.seats ?? [])]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((seat) => ({
          id: seat.id,
          sensorId: seat.label,
          status: mapApiSeatStatus(seat.status),
          floor: floorLabel,
          coordinates:
            typeof seat.x === "number" && typeof seat.y === "number"
              ? [seat.x, seat.y]
              : center,
        }));

      const floorRoom: Room = {
        id: `${apiBuilding.id}-f${floorNumber}-room`,
        name: `Level ${floorNumber} Workspace`,
        floor: floorLabel,
        polygon,
        seats: floorSeats,
      };

      return {
        id: apiFloor.id,
        label: floorLabel,
        rooms: [floorRoom],
      };
    });

  return {
    id: apiBuilding.id,
    name: apiBuilding.name,
    center,
    polygon,
    floors,
    isCustom: true,
  };
}

function cloneSampleBuildings(): Building[] {
  return JSON.parse(JSON.stringify(CAMPUS_DATA.buildings)) as Building[];
}

export function MapProvider({ children }: { children: ReactNode }) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [activeFloor, setActiveFloor] = useState<FloorLabel>(DEFAULT_FLOOR);
  const [role, setRoleState] = useState<UserRole>("student");
  const [editMode, setEditModeState] = useState(false);

  const [creationPhase, setCreationPhase] = useState<CreationPhase>(1);
  const [activeTool, setActiveTool] = useState<ArchitectTool>("building");
  const [activeFloorNumber, setActiveFloorNumber] = useState(1);
  const [draftBuildingFootprint, setDraftBuildingFootprintState] = useState<[number, number][] | null>(null);
  const [currentBuildingData, setCurrentBuildingData] = useState<CurrentBuildingData | null>(null);
  const [recentSavedBuildingId, setRecentSavedBuildingId] = useState<string | null>(null);
  const [buildingInfoOpen, setBuildingInfoOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isEditing = role === "admin" && editMode;

  const selectedBuilding = useMemo(
    () => findBuildingById(buildings, selectedBuildingId),
    [buildings, selectedBuildingId],
  );

  const syncBuildingsFromApi = useCallback(async () => {
    const apiBuildings = await getBuildings();
    const nextBuildings = apiBuildings.map(mapApiBuildingToBuilding);

    setBuildings(nextBuildings);
    setSelectedBuildingId((previous) => {
      if (previous && nextBuildings.some((building) => building.id === previous)) {
        return previous;
      }

      return nextBuildings[0]?.id ?? null;
    });

    return nextBuildings;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const synced = await syncBuildingsFromApi();
        if (!cancelled && synced.length === 0) {
          setNotice("No buildings found in the API yet.");
        }
      } catch {
        if (cancelled) {
          return;
        }

        const fallbackBuildings = cloneSampleBuildings();
        setBuildings(fallbackBuildings);
        setSelectedBuildingId(fallbackBuildings[0]?.id ?? null);
        setNotice("API unavailable. Showing local sample data.");
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [syncBuildingsFromApi]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport || role === "student") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRoleState("student");
      setEditModeState(false);
      setActiveTool("none");
      setNotice("Admin mode is only available on desktop.");
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isMobileViewport, role]);

  const setRole = (nextRole: UserRole) => {
    if (isMobileViewport && nextRole === "admin") {
      setRoleState("student");
      setEditModeState(false);
      setNotice("Admin mode is only available on desktop.");
      return;
    }

    setRoleState(nextRole);
    if (nextRole === "student") {
      setEditModeState(false);
    }
  };

  const setEditMode = (enabled: boolean) => {
    if (enabled && isMobileViewport) {
      setRoleState("student");
      setEditModeState(false);
      setNotice("Editing is disabled on mobile devices.");
      return;
    }

    setEditModeState(enabled);
    if (!enabled) {
      setActiveTool("none");
      setNotice(null);
      return;
    }

    if (!currentBuildingData && !draftBuildingFootprint) {
      setCreationPhase(1);
      setActiveTool("building");
      setNotice("Phase 1: Draw the building footprint.");
      return;
    }

    if (draftBuildingFootprint && !currentBuildingData) {
      setCreationPhase(2);
      setActiveTool("building");
      setNotice("Phase 2: Adjust footprint or publish building details.");
      return;
    }

    setCreationPhase(3);
    setActiveTool("seat");
  };

  const setDraftBuildingFootprint = (polygon: [number, number][]) => {
    setDraftBuildingFootprintState(polygon);
    setCreationPhase(2);
    setActiveTool("building");
  };

  const publishFootprint = ({
    name,
    totalFloors,
    floorCapacities,
  }: {
    name: string;
    totalFloors: number;
    floorCapacities: Record<number, number>;
  }) => {
    if (!draftBuildingFootprint || draftBuildingFootprint.length < 4) {
      setNotice("Draw a valid building polygon before publishing.");
      return;
    }

    const buildingName = name.trim() || "Untitled Building";
    const floors = Math.min(100, Math.max(1, totalFloors));

    setCurrentBuildingData({
      id: buildingName,
      name: buildingName,
      totalFloors: floors,
      footprint: draftBuildingFootprint,
      floorCapacities,
      seats: [],
    });

    setCreationPhase(3);
    setActiveFloorNumber(1);
    setActiveTool("seat");
    setNotice("Phase 3: Select a floor and place seats.");
  };

  const addSeat = ({ coordinates, sensorId }: { coordinates: [number, number]; sensorId?: string }) => {
    setCurrentBuildingData((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        seats: [
          ...previous.seats,
          {
            id: `seat-${activeFloorNumber}-${Date.now()}`,
            floor: activeFloorNumber,
            coordinates,
            sensorId: sensorId?.trim() || `S-${Date.now().toString().slice(-5)}`,
            spaceId: `floor-${activeFloorNumber}`,
          },
        ],
      };
    });
  };

  const updateBuildingFootprint = (polygon: [number, number][]) => {
    if (!currentBuildingData) {
      setDraftBuildingFootprintState(polygon);
      return;
    }

    setCurrentBuildingData((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        footprint: polygon,
      };
    });
  };

  const deleteLastInterior = () => {
    setCurrentBuildingData((previous) => {
      if (!previous) {
        return previous;
      }

      const seatsOnFloor = previous.seats.filter((seat) => seat.floor === activeFloorNumber);
      if (seatsOnFloor.length > 0) {
        const lastSeatId = seatsOnFloor[seatsOnFloor.length - 1]?.id;
        return {
          ...previous,
          seats: previous.seats.filter((seat) => seat.id !== lastSeatId),
        };
      }

      return previous;
    });
  };

  const saveBuildingDesign = async () => {
    if (!currentBuildingData) {
      setNotice("No building design to save yet.");
      return;
    }

    try {
      setNotice("Saving building to API...");

      const polygonForApi = normalizePolygonForApi(currentBuildingData.footprint);
      if (polygonForApi.length < 3) {
        setNotice("Cannot save building: polygon coordinates are invalid.");
        return;
      }

      const savedBuilding = await createBuilding({
        name: currentBuildingData.name,
        institutionId: HARDCODED_INSTITUTION_ID,
        polygon: polygonForApi,
      });

      const seatsPerFloor = currentBuildingData.seats.reduce<Record<number, number>>((accumulator, seat) => {
        accumulator[seat.floor] = (accumulator[seat.floor] ?? 0) + 1;
        return accumulator;
      }, {});

      const savedFloors = await Promise.all(
        Array.from({ length: currentBuildingData.totalFloors }, (_, index) => {
          const floorNumber = index + 1;
          const configuredCapacity = currentBuildingData.floorCapacities[floorNumber];
          const normalizedCapacity = Number.isFinite(configuredCapacity)
            ? Math.max(0, Math.floor(configuredCapacity))
            : seatsPerFloor[floorNumber] ?? 0;

          return createFloor({
            floorNumber,
            capacity: normalizedCapacity,
            buildingId: savedBuilding.id,
          });
        }),
      );

      const floorIdByNumber = new Map(savedFloors.map((floor) => [floor.floorNumber, floor.id]));

      await Promise.all(
        currentBuildingData.seats.map((seat, index) => {
          const floorId = floorIdByNumber.get(seat.floor);
          if (!floorId) {
            return Promise.resolve();
          }

          const label = seat.sensorId?.trim() || `Seat ${seat.floor}-${index + 1}`;

          return createSeat({
            type: "CHAIR",
            label,
            status: "AVAILABLE",
            x: seat.coordinates[0],
            y: seat.coordinates[1],
            floorId,
          });
        }),
      );

      await syncBuildingsFromApi();
      setSelectedBuildingId(savedBuilding.id);
      setRecentSavedBuildingId(savedBuilding.id);
      setDraftBuildingFootprintState(null);
      setCurrentBuildingData(null);
      setCreationPhase(1);
      setActiveFloorNumber(1);
      setActiveTool("none");
      setEditModeState(false);
      setBuildingInfoOpen(true);
      setNotice(`Saved ${currentBuildingData.name}. Switched to map view.`);
    } catch {
      setNotice("Failed to save building to API. Check that backend is running.");
    }
  };

  const clearRecentSavedBuilding = () => {
    setRecentSavedBuildingId(null);
  };

  const openBuildingInfo = () => {
    setBuildingInfoOpen(true);
  };

  const closeBuildingInfo = () => {
    setBuildingInfoOpen(false);
  };

  const value: MapContextValue = {
    buildings,
    selectedBuilding,
    selectedBuildingId,
    recentSavedBuildingId,
    buildingInfoOpen,
    isMobileViewport,
    activeFloor,
    role,
    editMode,
    isEditing,
    creationPhase,
    activeTool,
    draftBuildingFootprint,
    currentBuildingData,
    activeFloorNumber,
    notice,
    setRole,
    setEditMode,
    setSelectedBuildingId,
    setActiveFloor,
    setCreationPhase,
    setActiveTool,
    setActiveFloorNumber,
    setDraftBuildingFootprint,
    openBuildingInfo,
    closeBuildingInfo,
    publishFootprint,
    saveBuildingDesign,
    addSeat,
    updateBuildingFootprint,
    deleteLastInterior,
    setNotice,
    clearRecentSavedBuilding,
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMapContext() {
  const context = useContext(MapContext);

  if (!context) {
    throw new Error("useMapContext must be used inside a MapProvider");
  }

  return context;
}
