"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type { FeatureCollection } from "geojson";
import mapboxgl from "mapbox-gl";
import Map, {
  GeolocateControl,
  Layer,
  NavigationControl,
  Popup,
  Source,
  type LayerProps,
  type MapMouseEvent,
  type MapRef,
  type MapTouchEvent,
} from "react-map-gl/mapbox";
import { useMapContext } from "@/context/MapContext";
import { buildingsToGeoJSON } from "@/lib/campus-data";
import { Layers3 } from "lucide-react";

interface HoverCard {
  lng: number;
  lat: number;
  name: string;
  occupancy: number;
}

interface HoveredFloor {
  buildingId: string;
  floorNumber: number;
}

const FLOOR_HEIGHT = 4.5;
const LIGHT_PRESETS = ["dawn", "day", "dusk", "night"] as const;
type LightPreset = (typeof LIGHT_PRESETS)[number];

const buildingFillLayer: LayerProps = {
  id: "building-fill",
  type: "fill",
  paint: {
    "fill-color": [
      "case",
      ["boolean", ["get", "isCustom"], false],
      "#7CCBFF",
      [
        "interpolate",
        ["linear"],
        ["get", "occupancy"],
        0,
        "#34C759",
        50,
        "#FF9500",
        100,
        "#FF3B30",
      ],
    ],
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.72, 16, 0.35, 17.5, 0],
  },
};

const buildingOutlineLayer: LayerProps = {
  id: "building-outline",
  type: "line",
  paint: {
    "line-color": "#0f172a",
    "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.8, 18, 1.6],
    "line-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.5, 16, 0.15, 17.5, 0],
  },
};

const floorExtrusionLayer: LayerProps = {
  id: "floor-extrusion",
  type: "fill-extrusion",
  filter: ["==", ["coalesce", ["get", "isAboveSelected"], 0], 0],
  paint: {
    "fill-extrusion-color": [
      "interpolate",
      ["linear"],
      ["coalesce", ["get", "occupancy"], 0],
      0,
      "#22c55e",
      40,
      "#84cc16",
      70,
      "#f59e0b",
      100,
      "#ef4444",
    ],
    "fill-extrusion-base": ["*", ["-", ["coalesce", ["get", "floorNumber"], 1], 1], FLOOR_HEIGHT],
    "fill-extrusion-height": ["*", ["coalesce", ["get", "floorNumber"], 1], FLOOR_HEIGHT],
    "fill-extrusion-opacity": 0.86,
    "fill-extrusion-height-transition": {
      duration: 1000,
      delay: 0,
    },
  },
};

const floorExtrusionDimmedLayer: LayerProps = {
  id: "floor-extrusion-dimmed",
  type: "fill-extrusion",
  filter: ["==", ["coalesce", ["get", "isAboveSelected"], 0], 1],
  paint: {
    "fill-extrusion-color": "#f8fafc",
    "fill-extrusion-base": ["*", ["-", ["coalesce", ["get", "floorNumber"], 1], 1], FLOOR_HEIGHT],
    "fill-extrusion-height": ["*", ["coalesce", ["get", "floorNumber"], 1], FLOOR_HEIGHT],
    "fill-extrusion-opacity": 0.28,
  },
};

const floorExtrusionHoveredLayer: LayerProps = {
  id: "floor-extrusion-hovered",
  type: "fill-extrusion",
  filter: ["==", ["coalesce", ["get", "isHoveredFloor"], 0], 1],
  paint: {
    "fill-extrusion-color": [
      "interpolate",
      ["linear"],
      ["coalesce", ["get", "occupancy"], 0],
      0,
      "#22c55e",
      40,
      "#84cc16",
      70,
      "#f59e0b",
      100,
      "#ef4444",
    ],
    "fill-extrusion-base": ["*", ["-", ["coalesce", ["get", "floorNumber"], 1], 1], FLOOR_HEIGHT],
    "fill-extrusion-height": ["*", ["coalesce", ["get", "floorNumber"], 1], FLOOR_HEIGHT],
    "fill-extrusion-opacity": 0.98,
  },
};

const floorRoofHighlightLayer: LayerProps = {
  id: "floor-roof-highlight",
  type: "fill-extrusion",
  filter: ["==", ["coalesce", ["get", "isHoveredFloor"], 0], 1],
  paint: {
    "fill-extrusion-color": "#bfdbfe",
    "fill-extrusion-base": ["*", ["coalesce", ["get", "floorNumber"], 1], FLOOR_HEIGHT],
    "fill-extrusion-height": ["+", ["*", ["coalesce", ["get", "floorNumber"], 1], FLOOR_HEIGHT], 0.35],
    "fill-extrusion-opacity": 0.65,
  },
};

const activeFloorPlateLayer: LayerProps = {
  id: "active-floor-plate",
  type: "fill-extrusion",
  filter: ["==", ["get", "type"], "building"],
  paint: {
    "fill-extrusion-color": "#007AFF",
    "fill-extrusion-base": ["*", ["coalesce", ["get", "activeFloorNumber"], 1], 4.5],
    "fill-extrusion-height": [
      "+",
      ["*", ["coalesce", ["get", "activeFloorNumber"], 1], 4.5],
      0.45,
    ],
    "fill-extrusion-opacity": 0.55,
  },
};

const activeSeatLayer: LayerProps = {
  id: "architect-seat-active",
  type: "fill-extrusion",
  paint: {
    "fill-extrusion-color": "#10b981",
    "fill-extrusion-base": ["coalesce", ["get", "seatBase"], 0],
    "fill-extrusion-height": ["coalesce", ["get", "seatTop"], 0.6],
    "fill-extrusion-opacity": 0.98,
  },
};

const inactiveSeatLayer: LayerProps = {
  id: "architect-seat-inactive",
  type: "fill-extrusion",
  paint: {
    "fill-extrusion-color": "#10b981",
    "fill-extrusion-base": ["coalesce", ["get", "seatBase"], 0],
    "fill-extrusion-height": ["coalesce", ["get", "seatTop"], 0.6],
    "fill-extrusion-opacity": 0.28,
  },
};

const userLocationLayer: LayerProps = {
  id: "user-location",
  type: "circle",
  paint: {
    "circle-color": "#2563eb",
    "circle-radius": 7,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 2,
  },
};

const buildingDistanceLabelLayer: LayerProps = {
  id: "building-distance-labels",
  type: "symbol",
  layout: {
    "text-field": ["concat", ["get", "name"], "  ", ["get", "distanceText"]],
    "text-size": 12,
    "text-anchor": "left",
    "text-offset": [1.2, 0],
    "text-allow-overlap": true,
    "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
  },
  paint: {
    "text-color": "#0f172a",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.4,
  },
};

const directionsRouteLayer: LayerProps = {
  id: "directions-route",
  type: "line",
  paint: {
    "line-color": "#0ea5e9",
    "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 5, 19, 8],
    "line-opacity": 0.95,
  },
};

function floorMatchFilter(floor: number) {
  return ["==", ["get", "floor"], floor];
}

function floorLabelToNumber(label: string): number {
  if (label === "G") {
    return 1;
  }

  const parsed = Number(label);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed + 1;
}

function seatHalfSizeByType(type: "TABLE" | "CHAIR" | "SOFA"): number {
  if (type === "TABLE") {
    return 0.000026;
  }

  if (type === "SOFA") {
    return 0.00003;
  }

  return 0.00002;
}

function seatHeightByType(type: "TABLE" | "CHAIR" | "SOFA"): number {
  if (type === "TABLE") {
    return 1.1;
  }

  if (type === "SOFA") {
    return 0.9;
  }

  return 0.75;
}

function seatPolygonFromPoint(
  coordinates: [number, number],
  type: "TABLE" | "CHAIR" | "SOFA",
): [number, number][] {
  const [lng, lat] = coordinates;
  const half = seatHalfSizeByType(type);

  return [
    [lng - half, lat - half],
    [lng + half, lat - half],
    [lng + half, lat + half],
    [lng - half, lat + half],
    [lng - half, lat - half],
  ];
}

function asRing(coords: unknown): [number, number][] | null {
  if (!Array.isArray(coords) || coords.length === 0) {
    return null;
  }

  const firstRing = coords[0];
  if (!Array.isArray(firstRing)) {
    return null;
  }

  const ring = firstRing
    .filter((vertex) => Array.isArray(vertex) && vertex.length >= 2)
    .map((vertex) => [Number(vertex[0]), Number(vertex[1])] as [number, number]);

  return ring.length >= 4 ? ring : null;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(2)} km`;
}

function architectBuildingGeoJSON(footprint: [number, number][] | null, name: string): FeatureCollection {
  if (!footprint || footprint.length < 4) {
    return { type: "FeatureCollection", features: [] } as FeatureCollection;
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [footprint] },
        properties: {
          id: name,
          name,
          type: "building",
          floorCount: 1,
          activeFloorNumber: 1,
        },
      },
    ],
  } as FeatureCollection;
}

function seatsGeoJSON(seats: Array<{ id: string; floor: number; coordinates: [number, number]; type: "TABLE" | "CHAIR" | "SOFA"; spaceId: string }>): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: seats.map((seat) => ({
      type: "Feature" as const,
      geometry: { type: "Polygon" as const, coordinates: [seatPolygonFromPoint(seat.coordinates, seat.type)] },
      properties: {
        id: seat.id,
        floor: seat.floor,
        type: seat.type,
        spaceId: seat.spaceId,
        seatBase: (Math.max(1, seat.floor) - 1) * FLOOR_HEIGHT + 0.08,
        seatTop: (Math.max(1, seat.floor) - 1) * FLOOR_HEIGHT + 0.08 + seatHeightByType(seat.type),
      },
    })),
  } as FeatureCollection;
}

function buildingFloorsGeoJSON(
  buildings: ReturnType<typeof useMapContext>["buildings"],
  selectedFloor: HoveredFloor | null,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: buildings.flatMap((building) =>
      building.floors.map((floor) => {
        const floorNumber = floorLabelToNumber(floor.label);
        const seats = floor.rooms.flatMap((room) => room.seats);
        const total = seats.length;
        const occupied = seats.filter((seat) => seat.status === "Occupied").length;
        const free = seats.filter((seat) => seat.status === "Available").length;
        const occupancy = total > 0 ? Math.round((occupied / total) * 100) : 0;
        const isHoveredFloor =
          selectedFloor?.buildingId === building.id && selectedFloor.floorNumber === floorNumber ? 1 : 0;
        const isHoveredBuilding = selectedFloor?.buildingId === building.id ? 1 : 0;
        const isAboveSelected =
          selectedFloor?.buildingId === building.id && floorNumber > selectedFloor.floorNumber ? 1 : 0;

        return {
          type: "Feature" as const,
          geometry: {
            type: "Polygon" as const,
            coordinates: [building.polygon],
          },
          properties: {
            id: `${building.id}-f${floorNumber}`,
            buildingId: building.id,
            buildingName: building.name,
            floorNumber,
            floorLabel: floor.label,
            occupancy,
            total,
            free,
            occupied,
            isHoveredFloor,
            isHoveredBuilding,
            isAboveSelected,
          },
        };
      }),
    ),
  } as FeatureCollection;
}

function buildingSeatsGeoJSON(
  buildings: ReturnType<typeof useMapContext>["buildings"],
  selectedFloor: HoveredFloor | null,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: buildings.flatMap((building) =>
      building.floors.flatMap((floor) => {
        const floorNumber = floorLabelToNumber(floor.label);
        const isHoveredFloor =
          selectedFloor?.buildingId === building.id && selectedFloor.floorNumber === floorNumber ? 1 : 0;

        return floor.rooms.flatMap((room) =>
          room.seats.map((seat) => ({
            type: "Feature" as const,
            geometry: {
              type: "Polygon" as const,
              coordinates: [seatPolygonFromPoint(seat.coordinates, seat.type)],
            },
            properties: {
              id: seat.id,
              buildingId: building.id,
              floorNumber,
              type: seat.type,
              status: seat.status,
              isHoveredFloor,
              seatBase: (Math.max(1, floorNumber) - 1) * FLOOR_HEIGHT + 0.08,
              seatTop:
                (Math.max(1, floorNumber) - 1) * FLOOR_HEIGHT + 0.08 + seatHeightByType(seat.type),
            },
          })),
        );
      }),
    ),
  } as FeatureCollection;
}

function userLocationGeoJSON(userLocation: [number, number] | null): FeatureCollection {
  if (!userLocation) {
    return { type: "FeatureCollection", features: [] } as FeatureCollection;
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: userLocation,
        },
        properties: {
          id: "current-user-location",
        },
      },
    ],
  } as FeatureCollection;
}

function buildingDistanceGeoJSON(
  buildings: ReturnType<typeof useMapContext>["buildings"],
  userLocation: [number, number] | null,
): FeatureCollection {
  if (!userLocation) {
    return { type: "FeatureCollection", features: [] } as FeatureCollection;
  }

  const userLngLat = new mapboxgl.LngLat(userLocation[0], userLocation[1]);

  return {
    type: "FeatureCollection",
    features: buildings.map((building) => {
      const buildingLngLat = new mapboxgl.LngLat(building.center[0], building.center[1]);
      const distanceMeters = userLngLat.distanceTo(buildingLngLat);

      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: building.center,
        },
        properties: {
          id: `${building.id}-distance-label`,
          name: building.name,
          distanceText: formatDistance(distanceMeters),
        },
      };
    }),
  } as FeatureCollection;
}

export function EditMapComponent() {
  const {
    buildings,
    recentSavedBuildingId,
    directionsTargetBuildingId,
    role,
    isEditing,
    creationPhase,
    activeTool,
    currentBuildingData,
    draftBuildingFootprint,
    activeFloorNumber,
    setDraftBuildingFootprint,
    setNotice,
    addSeat,
    setSelectedBuildingId,
    openBuildingInfo,
    buildingInfoOpen,
    clearRecentSavedBuilding,
  } = useMapContext();

  const mapRef = useRef<MapRef | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const buildingDrawIdRef = useRef<string | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isHandlingDrawCreateRef = useRef(false);
  const drawCreateHandlerRef = useRef<((event: {
    features?: Array<{
      id?: string | number;
      geometry?: { type?: string; coordinates?: unknown };
    }>;
  }) => void) | null>(null);

  const [hoverCard, setHoverCard] = useState<HoverCard | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<HoveredFloor | null>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [hasMapLoaded, setHasMapLoaded] = useState(false);
  const [lightPreset, setLightPreset] = useState<LightPreset>("day");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [directionsRouteData, setDirectionsRouteData] = useState<FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const baseBuildingsData = useMemo(() => buildingsToGeoJSON(buildings), [buildings]);

  const architectBuildingData = useMemo(
    () => {
      const base = architectBuildingGeoJSON(
        currentBuildingData?.footprint ?? draftBuildingFootprint,
        currentBuildingData?.name ?? "Draft Building",
      );

      if (base.features.length === 0) {
        return base;
      }

      const floorCount = currentBuildingData?.totalFloors ?? 1;
      return {
        ...base,
        features: base.features.map((feature) => ({
          ...feature,
          properties: {
            ...(feature.properties ?? {}),
            type: "building",
            floorCount,
            activeFloorNumber,
          },
        })),
      } as FeatureCollection;
    },
    [activeFloorNumber, currentBuildingData?.footprint, currentBuildingData?.name, currentBuildingData?.totalFloors, draftBuildingFootprint],
  );

  const architectSeatsData = useMemo(
    () => seatsGeoJSON(currentBuildingData?.seats ?? []),
    [currentBuildingData?.seats],
  );

  const architectSeatFloors = useMemo(() => {
    const totalFloors = Math.max(1, currentBuildingData?.totalFloors ?? 1);
    const floors = new Set<number>([activeFloorNumber]);

    for (let floor = 1; floor <= totalFloors; floor += 1) {
      floors.add(floor);
    }

    return Array.from(floors).sort((a, b) => a - b);
  }, [activeFloorNumber, currentBuildingData?.totalFloors]);

  const buildingFloorsData = useMemo(
    () => buildingFloorsGeoJSON(buildings, selectedFloor),
    [buildings, selectedFloor],
  );

  const buildingSeatsData = useMemo(
    () => buildingSeatsGeoJSON(buildings, selectedFloor),
    [buildings, selectedFloor],
  );

  const userLocationData = useMemo(
    () => userLocationGeoJSON(userLocation),
    [userLocation],
  );

  const buildingDistanceData = useMemo(
    () => buildingDistanceGeoJSON(buildings, userLocation),
    [buildings, userLocation],
  );

  const directionsTargetBuilding = useMemo(
    () => buildings.find((building) => building.id === directionsTargetBuildingId) ?? null,
    [buildings, directionsTargetBuildingId],
  );

  const togglePerspective = useCallback(() => {
    const nextMode = !is3DMode;
    setIs3DMode(nextMode);
    mapRef.current?.flyTo({
      pitch: nextMode ? 60 : 0,
      bearing: nextMode ? -20 : 0,
      zoom: nextMode ? 17 : 16,
      duration: 1200,
    });
  }, [is3DMode]);

  const adjustCamera = useCallback((input: { pitchDelta?: number; bearingDelta?: number }) => {
    const map = mapRef.current?.getMap();
    if (!map) {
      return;
    }

    const nextPitch = Math.max(0, Math.min(75, map.getPitch() + (input.pitchDelta ?? 0)));
    const nextBearing = map.getBearing() + (input.bearingDelta ?? 0);

    map.easeTo({
      pitch: nextPitch,
      bearing: nextBearing,
      duration: 280,
    });
  }, []);

  const applyDrawMode = useCallback(() => {
    const draw = drawRef.current;
    if (!draw || !isEditing || role !== "admin") {
      return;
    }

    if (activeTool === "building" && (creationPhase === 1 || creationPhase === 2)) {
      draw.changeMode("draw_polygon");
      return;
    }

    if (activeTool === "seat" && creationPhase === 3) {
      draw.changeMode("draw_point");
      return;
    }

    draw.changeMode("simple_select");
  }, [activeTool, creationPhase, isEditing, role]);

  const rearmDrawMode = useCallback((mode: "draw_point" | "draw_polygon" | "simple_select") => {
    const draw = drawRef.current;
    if (!draw) {
      return;
    }

    requestAnimationFrame(() => {
      const target = drawRef.current;
      if (!target) {
        return;
      }

      if (mode === "draw_point") {
        target.changeMode("draw_point");
        return;
      }

      if (mode === "draw_polygon") {
        target.changeMode("draw_polygon");
        return;
      }

      target.changeMode("simple_select");
    });
  }, []);

  const handleDrawCreate = useCallback((event: {
    features?: Array<{
      id?: string | number;
      geometry?: { type?: string; coordinates?: unknown };
    }>;
  }) => {
    if (isHandlingDrawCreateRef.current) {
      return;
    }

    isHandlingDrawCreateRef.current = true;

    try {
    const draw = drawRef.current;
    if (!draw || !isEditing) {
      return;
    }

    const feature = event.features?.[0];
    if (!feature || !feature.geometry) {
      return;
    }

    if (feature.geometry.type === "Polygon") {
      const ring = asRing(feature.geometry.coordinates);
      if (!ring || !feature.id) {
        return;
      }

      const featureId = String(feature.id);

      if (activeTool === "building" && (creationPhase === 1 || creationPhase === 2)) {
        if (buildingDrawIdRef.current && buildingDrawIdRef.current !== featureId) {
          draw.delete(buildingDrawIdRef.current);
        }

        buildingDrawIdRef.current = featureId;
        setDraftBuildingFootprint(ring);
        setNotice("Footprint captured. Complete Building ID and Floors to publish.");
        draw.changeMode("simple_select", { featureIds: [featureId] });
        return;
      }

      // No interior space polygons in seat-only mode.
      draw.delete(featureId);
      setNotice("Only building footprint polygons are supported. Use seat mode to place seats.");
      draw.changeMode("draw_point");
    }

    if (feature.geometry.type === "Point") {
      if (activeTool !== "seat" || creationPhase !== 3) {
        if (feature.id) {
          draw.delete(String(feature.id));
        }
        rearmDrawMode("simple_select");
        return;
      }

      const coords = feature.geometry.coordinates as [number, number];
      if (feature.id) {
        draw.delete(String(feature.id));
      }

      if (!currentBuildingData?.footprint) {
        setNotice("Publish the building footprint first.");
        rearmDrawMode("draw_point");
        return;
      }

      addSeat({ coordinates: coords });
      setNotice(`Seat added on Level ${activeFloorNumber}.`);
      rearmDrawMode("draw_point");
    }
    } finally {
      isHandlingDrawCreateRef.current = false;
    }
  }, [activeFloorNumber, activeTool, addSeat, creationPhase, currentBuildingData?.footprint, isEditing, rearmDrawMode, setDraftBuildingFootprint, setNotice]);

  useEffect(() => {
    drawCreateHandlerRef.current = handleDrawCreate;
  }, [handleDrawCreate]);

  const onDrawCreate = useCallback((event: {
    features?: Array<{
      id?: string | number;
      geometry?: { type?: string; coordinates?: unknown };
    }>;
  }) => {
    drawCreateHandlerRef.current?.(event);
  }, []);

  const initializeDraw = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || drawRef.current || !map.isStyleLoaded()) {
      return;
    }

    if ((map as unknown as { __campusDrawInitialized?: boolean }).__campusDrawInitialized) {
      return;
    }

    const draw = new MapboxDraw({ displayControlsDefault: false });
    drawRef.current = draw;
    map.addControl(draw, "top-left");
    map.on("draw.create", onDrawCreate as never);

    if (!map.getLayer("campus-sky")) {
      map.addLayer({
        id: "campus-sky",
        type: "sky",
        paint: {
          "sky-type": "atmosphere",
          "sky-atmosphere-sun": [0.0, 0.0],
          "sky-atmosphere-sun-intensity": 10,
        },
      } as never);
    }

    (map as unknown as { __campusDrawInitialized?: boolean }).__campusDrawInitialized = true;

    // Draw can initialize after effects run; force-sync active mode here.
    applyDrawMode();
  }, [applyDrawMode, onDrawCreate]);

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    setHasMapLoaded(true);
    initializeDraw();
  }, [initializeDraw]);

  const handleMapIdle = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    if (!hasMapLoaded) {
      setHasMapLoaded(true);
    }

    initializeDraw();
  }, [hasMapLoaded, initializeDraw]);

  const canRenderMapSources = hasMapLoaded;
  const canAdjustCamera = true;
  const shouldRender3D = is3DMode || !isEditing;
  const interactiveBuildingLayerIds = shouldRender3D
    ? ["building-fill", "floor-extrusion", "floor-roof-highlight", "active-floor-plate"]
    : ["building-fill"];

  useEffect(() => {
    applyDrawMode();
  }, [applyDrawMode]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    map.setConfigProperty("basemap", "lightPreset", lightPreset);
  }, [hasMapLoaded, lightPreset]);

  useEffect(() => {
    if (!buildingInfoOpen) {
      setSelectedFloor(null);
    }
  }, [buildingInfoOpen]);

  useEffect(() => {
    if (!token || !userLocation || !directionsTargetBuilding) {
      setDirectionsRouteData({ type: "FeatureCollection", features: [] });
      return;
    }

    const controller = new AbortController();

    const loadRoute = async () => {
      try {
        const from = `${userLocation[0]},${userLocation[1]}`;
        const to = `${directionsTargetBuilding.center[0]},${directionsTargetBuilding.center[1]}`;
        const requestUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${from};${to}?alternatives=false&continue_straight=true&geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token)}`;

        const response = await fetch(requestUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Failed to load route");
        }

        const payload = (await response.json()) as {
          routes?: Array<{ geometry?: { type?: string; coordinates?: unknown } }>;
        };

        const geometry = payload.routes?.[0]?.geometry;
        if (geometry?.type !== "LineString" || !Array.isArray(geometry.coordinates)) {
          setDirectionsRouteData({ type: "FeatureCollection", features: [] });
          return;
        }

        const lineCoordinates = geometry.coordinates
          .filter((point) => Array.isArray(point) && point.length >= 2)
          .map((point) => [Number(point[0]), Number(point[1])] as [number, number])
          .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));

        if (lineCoordinates.length < 2) {
          setDirectionsRouteData({ type: "FeatureCollection", features: [] });
          return;
        }

        setDirectionsRouteData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: lineCoordinates,
              },
              properties: {
                id: `route-${directionsTargetBuilding.id}`,
              },
            },
          ],
        } as FeatureCollection);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setDirectionsRouteData({ type: "FeatureCollection", features: [] });
      }
    };

    void loadRoute();

    return () => {
      controller.abort();
    };
  }, [directionsTargetBuilding, token, userLocation]);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.longitude, position.coords.latitude]);
      },
      () => {
        // Ignore geolocation errors so the map remains fully usable.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 12000,
      },
    );
  }, []);

  useEffect(() => {
    if (!recentSavedBuildingId) {
      return;
    }

    const savedBuilding = buildings.find((building) => building.id === recentSavedBuildingId);
    if (!savedBuilding) {
      return;
    }

    setIs3DMode(true);
    mapRef.current?.flyTo({
      center: savedBuilding.center,
      zoom: 17.8,
      pitch: 62,
      bearing: -24,
      duration: 1200,
    });
    clearRecentSavedBuilding();
  }, [buildings, clearRecentSavedBuilding, recentSavedBuildingId]);

  const handleFeatureSelection = (event: {
    features?: MapMouseEvent["features"];
    lngLat: { lng: number; lat: number };
  }) => {
    if (role === "admin" && isEditing && activeTool !== "none") {
      return;
    }

    const buildingFeature = event.features?.find((feature) => {
      const layerId = feature.layer?.id;
      return (
        layerId === "building-fill" ||
        layerId === "floor-extrusion" ||
        layerId === "floor-roof-highlight" ||
        layerId === "active-floor-plate"
      );
    });
    const buildingId =
      (buildingFeature?.properties?.buildingId as string | undefined) ??
      (buildingFeature?.properties?.id as string | undefined);

    if (!buildingId) {
      return;
    }

    const building = buildings.find((item) => item.id === buildingId);
    if (!building) {
      return;
    }

    const clickedFloorNumber = Number(buildingFeature?.properties?.floorNumber);
    if (Number.isFinite(clickedFloorNumber) && clickedFloorNumber > 0) {
      setSelectedFloor({ buildingId: building.id, floorNumber: clickedFloorNumber });
    } else {
      setSelectedFloor(null);
    }

    setSelectedBuildingId(building.id);
    openBuildingInfo();
  };

  const onMapClick = (event: MapMouseEvent) => {
    handleFeatureSelection(event);
  };

  const onMapTouchStart = (event: MapTouchEvent) => {
    const touch = event.originalEvent.touches[0];
    if (!touch) {
      touchStartRef.current = null;
      return;
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  };

  const onMapTouchEnd = (event: MapTouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;

    const touch = event.originalEvent.changedTouches[0];
    if (!start || !touch) {
      return;
    }

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const distance = Math.hypot(dx, dy);
    const duration = Date.now() - start.time;

    // Treat only short, small-movement gestures as taps; keep drag/pinch free for camera control.
    if (distance > 12 || duration > 350) {
      return;
    }

    handleFeatureSelection({
      features: event.features,
      lngLat: event.lngLat,
    });
  };

  const onMapHover = (event: MapMouseEvent) => {
    const floorFeature = event.features?.find(
      (feature) => feature.layer?.id === "floor-extrusion" || feature.layer?.id === "floor-roof-highlight",
    );

    if (floorFeature?.properties?.buildingId && floorFeature?.properties?.floorNumber) {
      setHoverCard({
        lng: event.lngLat.lng,
        lat: event.lngLat.lat,
        name: `${String(floorFeature.properties.buildingName ?? "Building")} · Floor ${String(
          floorFeature.properties.floorLabel ?? floorFeature.properties.floorNumber,
        )}`,
        occupancy: Number(floorFeature.properties.occupancy ?? 0),
      });

      return;
    }

    const buildingFeature = event.features?.find((feature) => feature.layer?.id === "building-fill");
    if (buildingFeature) {
      setHoverCard({
        lng: event.lngLat.lng,
        lat: event.lngLat.lat,
        name: String(buildingFeature.properties?.name ?? "Building"),
        occupancy: Number(buildingFeature.properties?.occupancy ?? 0),
      });
      return;
    }

    setHoverCard(null);
  };

  useEffect(() => {
    const map = mapRef.current?.getMap();
    return () => {
      if (map && drawRef.current) {
        map.off("draw.create", onDrawCreate as never);
        map.removeControl(drawRef.current);
        (map as unknown as { __campusDrawInitialized?: boolean }).__campusDrawInitialized = false;
      }
      drawRef.current = null;
    };
  }, [onDrawCreate]);

  if (!token) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-slate-950/90 text-slate-100">
        <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900/90 p-6 text-center">
          <h3 className="text-lg font-semibold">Mapbox token missing</h3>
          <p className="mt-2 text-sm text-slate-300">Add NEXT_PUBLIC_MAPBOX_TOKEN in .env.local</p>
        </div>
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={token}
      initialViewState={{ longitude: 10.2039, latitude: 56.1712, zoom: 15.2, pitch: 20, bearing: 50 }}
      mapStyle="mapbox://styles/mapbox/standard"
      styleDiffing
      style={{ width: "100%", height: "100%" }}
      cursor={isEditing && role === "admin" && activeTool !== "none" ? "crosshair" : "grab"}
      doubleClickZoom={false}
      minPitch={0}
      maxPitch={75}
      dragRotate={canAdjustCamera}
      touchPitch={canAdjustCamera}
      pitchWithRotate={canAdjustCamera}
      interactiveLayerIds={isEditing && role === "admin" && activeTool !== "none" ? [] : interactiveBuildingLayerIds}
      onClick={onMapClick}
      onTouchStart={onMapTouchStart}
      onTouchEnd={onMapTouchEnd}
      onMouseMove={onMapHover}
      onMouseLeave={() => {
        setHoverCard(null);
      }}
      onLoad={handleMapLoad}
      onIdle={handleMapIdle}
    >
      <NavigationControl position="bottom-right" showCompass />
      <GeolocateControl
        position="bottom-right"
        positionOptions={{ enableHighAccuracy: true }}
        trackUserLocation
        showUserHeading
        onGeolocate={(position) => {
          setUserLocation([position.coords.longitude, position.coords.latitude]);
        }}
      />

      {canRenderMapSources ? (
        <>
          <Source id="buildings" type="geojson" data={baseBuildingsData}>
            <Layer {...buildingFillLayer} />
            <Layer {...buildingOutlineLayer} />
          </Source>

          {directionsRouteData.features.length > 0 ? (
            <Source id="directions-route" type="geojson" data={directionsRouteData}>
              <Layer {...directionsRouteLayer} />
            </Source>
          ) : null}

          {userLocation ? (
            <Source id="user-location" type="geojson" data={userLocationData}>
              <Layer {...userLocationLayer} />
            </Source>
          ) : null}

          {userLocation ? (
            <Source id="building-distance-labels" type="geojson" data={buildingDistanceData}>
              <Layer {...buildingDistanceLabelLayer} />
            </Source>
          ) : null}

          {shouldRender3D ? (
            <Source id="building-floors" type="geojson" data={buildingFloorsData}>
              <Layer {...floorExtrusionLayer} />
              <Layer {...floorExtrusionDimmedLayer} />
              <Layer {...floorExtrusionHoveredLayer} />
              <Layer {...floorRoofHighlightLayer} />
            </Source>
          ) : null}

          {shouldRender3D ? (
            <Source id="building-floor-seats" type="geojson" data={buildingSeatsData} tolerance={0}>
              <Layer
                id="building-seat-available"
                type="fill-extrusion"
                filter={[
                  "all",
                  ["==", ["coalesce", ["get", "isHoveredFloor"], 0], 1],
                  ["==", ["get", "status"], "Available"],
                ]}
                paint={{
                  "fill-extrusion-color": "#22c55e",
                  "fill-extrusion-base": ["coalesce", ["get", "seatBase"], 0],
                  "fill-extrusion-height": ["coalesce", ["get", "seatTop"], 0.6],
                  "fill-extrusion-opacity": 0.98,
                }}
              />
              <Layer
                id="building-seat-occupied"
                type="fill-extrusion"
                filter={[
                  "all",
                  ["==", ["coalesce", ["get", "isHoveredFloor"], 0], 1],
                  ["==", ["get", "status"], "Occupied"],
                ]}
                paint={{
                  "fill-extrusion-color": "#ef4444",
                  "fill-extrusion-base": ["coalesce", ["get", "seatBase"], 0],
                  "fill-extrusion-height": ["coalesce", ["get", "seatTop"], 0.6],
                  "fill-extrusion-opacity": 0.98,
                }}
              />
              <Layer
                id="building-seat-maintenance"
                type="fill-extrusion"
                filter={[
                  "all",
                  ["==", ["coalesce", ["get", "isHoveredFloor"], 0], 1],
                  ["==", ["get", "status"], "Maintenance"],
                ]}
                paint={{
                  "fill-extrusion-color": "#f59e0b",
                  "fill-extrusion-base": ["coalesce", ["get", "seatBase"], 0],
                  "fill-extrusion-height": ["coalesce", ["get", "seatTop"], 0.6],
                  "fill-extrusion-opacity": 0.98,
                }}
              />
            </Source>
          ) : null}

          {architectBuildingData.features.length > 0 ? (
            <Source id="architect-building" type="geojson" data={architectBuildingData}>
              <Layer
                id="architect-building-line"
                type="line"
                paint={{ "line-color": "#007AFF", "line-width": 3 }}
              />
              <Layer
                id="architect-building-fill"
                type="fill"
                paint={{ "fill-color": "#007AFF", "fill-opacity": 0.08 }}
              />
              {shouldRender3D ? <Layer {...activeFloorPlateLayer} /> : null}
            </Source>
          ) : null}

          <Source id="architect-seats" type="geojson" data={architectSeatsData} tolerance={0}>
            {architectSeatFloors.map((floor) => {
              const isActiveFloor = floor === activeFloorNumber;
              const layerBase = isActiveFloor ? activeSeatLayer : inactiveSeatLayer;

              return (
                <Layer
                  key={`architect-seat-floor-${floor}`}
                  {...({
                    ...layerBase,
                    id: `architect-seat-${isActiveFloor ? "active" : "inactive"}-f${floor}`,
                    filter: floorMatchFilter(floor),
                    paint: layerBase.paint,
                  } as LayerProps)}
                />
              );
            })}
          </Source>
        </>
      ) : null}

      {hoverCard ? (
        <Popup
          longitude={hoverCard.lng}
          latitude={hoverCard.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={20}
        >
          <div className="w-44 rounded-xl bg-white p-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">{hoverCard.name}</p>
            <p className="mt-1 text-[11px] text-slate-500">Current Capacity</p>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#34C759] via-[#FF9500] to-[#FF3B30]"
                style={{ width: `${hoverCard.occupancy}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[11px] font-semibold">{hoverCard.occupancy}% occupied</p>
          </div>
        </Popup>
      ) : null}

      <div className="absolute left-1/2 top-14 z-20 w-[calc(100%-1rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-white/70 bg-white/85 p-1.5 shadow-xl shadow-slate-900/15 backdrop-blur-md sm:top-4 sm:z-40 sm:w-auto sm:max-w-none">
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pr-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {LIGHT_PRESETS.map((preset) => {
            const isActive = lightPreset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setLightPreset(preset);
                }}
                className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold capitalize transition sm:px-3 sm:text-xs ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white/90 text-slate-700 hover:bg-slate-100"
                }`}
                title={`Set map light to ${preset}`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={togglePerspective}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/70 bg-white/80 text-slate-700 shadow-xl shadow-slate-900/15 backdrop-blur-md transition hover:scale-[1.03]"
          title="Toggle 3D Perspective"
        >
          <Layers3 size={18} />
        </button>

        {is3DMode ? (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-white/70 bg-white/80 p-2 shadow-xl shadow-slate-900/15 backdrop-blur-md">
            <button
              type="button"
              onClick={() => adjustCamera({ pitchDelta: 8 })}
              className="rounded-xl bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              title="Tilt Up"
            >
              Tilt +
            </button>
            <button
              type="button"
              onClick={() => adjustCamera({ pitchDelta: -8 })}
              className="rounded-xl bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              title="Tilt Down"
            >
              Tilt -
            </button>
            <button
              type="button"
              onClick={() => adjustCamera({ bearingDelta: -12 })}
              className="rounded-xl bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              title="Rotate Left"
            >
              Left
            </button>
            <button
              type="button"
              onClick={() => adjustCamera({ bearingDelta: 12 })}
              className="rounded-xl bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              title="Rotate Right"
            >
              Right
            </button>
          </div>
        ) : null}
      </div>

    </Map>
  );
}
