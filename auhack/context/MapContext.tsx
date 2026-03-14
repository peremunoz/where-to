"use client";

import {
  createContext,
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
  publishFootprint: (input: { name: string; totalFloors: number }) => void;
  saveBuildingDesign: () => void;
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

function normalizeBuildingId(name: string): string {
  const cleaned = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || `building-${Date.now()}`;
}

function createBuildingFromDraft(draft: CurrentBuildingData): Building {
  const id = normalizeBuildingId(draft.name);
  const center = polygonCenter(draft.footprint);

  const floors: Floor[] = Array.from({ length: draft.totalFloors }, (_, index) => {
    const floorNumber = index + 1;
    const floorLabel = floorNumberToLabel(floorNumber);
    const floorSeats: Seat[] = draft.seats
      .filter((seat) => seat.floor === floorNumber)
      .map((seat) => ({
        id: seat.id,
        sensorId: seat.sensorId,
        status: "Available",
        floor: floorLabel,
        coordinates: seat.coordinates,
      }));

    const floorRoom: Room = {
      id: `${id}-f${floorNumber}-room`,
      name: `Level ${floorNumber} Workspace`,
      floor: floorLabel,
      polygon: draft.footprint,
      seats: floorSeats,
    };

    return {
      id: `${id}-f${floorNumber}`,
      label: floorLabel,
      rooms: [floorRoom],
    };
  });

  return {
    id,
    name: draft.name,
    center,
    polygon: draft.footprint,
    floors,
    isCustom: true,
  };
}

export function MapProvider({ children }: { children: ReactNode }) {
  const [buildings, setBuildings] = useState<Building[]>(() =>
    JSON.parse(JSON.stringify(CAMPUS_DATA.buildings)) as Building[],
  );
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    CAMPUS_DATA.buildings[0]?.id ?? null,
  );
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

    setRoleState("student");
    setEditModeState(false);
    setActiveTool("none");
    setNotice("Admin mode is only available on desktop.");
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

  const publishFootprint = ({ name, totalFloors }: { name: string; totalFloors: number }) => {
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

  const saveBuildingDesign = () => {
    if (!currentBuildingData) {
      setNotice("No building design to save yet.");
      return;
    }

    const savedBuilding = createBuildingFromDraft(currentBuildingData);

    setBuildings((previous) => {
      const withoutExisting = previous.filter((building) => building.id !== savedBuilding.id);
      return [...withoutExisting, savedBuilding];
    });

    setSelectedBuildingId(savedBuilding.id);
    setRecentSavedBuildingId(savedBuilding.id);
    setDraftBuildingFootprintState(null);
    setCurrentBuildingData(null);
    setCreationPhase(1);
    setActiveFloorNumber(1);
    setActiveTool("none");
    setEditModeState(false);
    setBuildingInfoOpen(true);
    setNotice(`Saved ${savedBuilding.name}. Switched to map view.`);
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
