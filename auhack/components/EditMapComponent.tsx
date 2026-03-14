"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type { FeatureCollection } from "geojson";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type LayerProps,
  type MapMouseEvent,
  type ViewStateChangeEvent,
  type MapRef,
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

const buildingExtrusionLayer: LayerProps = {
  id: "building-extrusion",
  type: "fill-extrusion",
  filter: ["==", ["get", "type"], "building"],
  paint: {
    "fill-extrusion-color": [
      "case",
      ["boolean", ["get", "isCustom"], false],
      "#7CCBFF",
      "#F3F4F6",
    ],
    "fill-extrusion-base": 0,
    "fill-extrusion-height": ["*", ["coalesce", ["get", "floorCount"], 1], 4.5],
    "fill-extrusion-opacity": 0.9,
    "fill-extrusion-height-transition": {
      duration: 1000,
      delay: 0,
    },
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
  type: "circle",
  paint: {
    "circle-color": "#34C759",
    "circle-radius": 5,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1,
  },
};

const inactiveSeatLayer: LayerProps = {
  id: "architect-seat-inactive",
  type: "circle",
  paint: {
    "circle-color": "#34C759",
    "circle-radius": 4,
    "circle-opacity": 0.2,
  },
};

function floorMatchFilter(floor: number) {
  return ["==", ["get", "floor"], floor];
}

function floorNonMatchFilter(floor: number) {
  return ["!=", ["get", "floor"], floor];
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

function seatsGeoJSON(seats: Array<{ id: string; floor: number; coordinates: [number, number]; spaceId: string }>): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: seats.map((seat) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: seat.coordinates },
      properties: {
        id: seat.id,
        floor: seat.floor,
        spaceId: seat.spaceId,
      },
    })),
  } as FeatureCollection;
}

export function EditMapComponent() {
  const {
    buildings,
    recentSavedBuildingId,
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
    clearRecentSavedBuilding,
    activeFloor,
  } = useMapContext();

  const mapRef = useRef<MapRef | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const buildingDrawIdRef = useRef<string | null>(null);
  const isHandlingDrawCreateRef = useRef(false);
  const drawCreateHandlerRef = useRef<((event: {
    features?: Array<{
      id?: string | number;
      geometry?: { type?: string; coordinates?: unknown };
    }>;
  }) => void) | null>(null);

  const [hoverCard, setHoverCard] = useState<HoverCard | null>(null);
  const [mapZoom, setMapZoom] = useState(15.2);
  const [is3DMode, setIs3DMode] = useState(false);
  const [hasMapLoaded, setHasMapLoaded] = useState(false);

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

  const availableSeats = useMemo(
    () =>
      buildings
        .flatMap((building) => building.floors)
        .flatMap((floor) => floor.rooms)
        .flatMap((room) => room.seats)
        .filter((seat) => seat.floor === activeFloor && seat.status === "Available"),
    [activeFloor, buildings],
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

    map.setLights([
      {
        id: "campus-flat-light",
        type: "flat",
        properties: {
          color: "white",
          intensity: 0.4,
        },
      },
    ] as never);

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
    ? ["building-fill", "building-extrusion", "active-floor-plate"]
    : ["building-fill"];

  useEffect(() => {
    applyDrawMode();
  }, [applyDrawMode]);

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

  const onMapClick = (event: MapMouseEvent) => {
    if (role === "admin" && isEditing) {
      return;
    }

    const buildingFeature = event.features?.find((feature) => {
      const layerId = feature.layer?.id;
      return layerId === "building-fill" || layerId === "building-extrusion" || layerId === "active-floor-plate";
    });
    const featureId = buildingFeature?.properties?.id as string | undefined;
    if (!featureId) {
      return;
    }

    const building = buildings.find((item) => item.id === featureId);
    if (!building) {
      return;
    }

    setSelectedBuildingId(building.id);
    openBuildingInfo();
    mapRef.current?.flyTo({ center: building.center, zoom: 19, duration: 1200 });
  };

  const onMapHover = (event: MapMouseEvent) => {
    const buildingFeature = event.features?.find((feature) => feature.layer?.id === "building-fill");
    if (!buildingFeature) {
      setHoverCard(null);
      return;
    }

    setHoverCard({
      lng: event.lngLat.lng,
      lat: event.lngLat.lat,
      name: String(buildingFeature.properties?.name ?? "Building"),
      occupancy: Number(buildingFeature.properties?.occupancy ?? 0),
    });
  };

  const onMapMove = (event: ViewStateChangeEvent) => {
    setMapZoom(event.viewState.zoom);
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
      style={{ width: "100%", height: "100%" }}
      cursor={isEditing && role === "admin" && activeTool !== "none" ? "crosshair" : "grab"}
      doubleClickZoom={false}
      minPitch={0}
      maxPitch={75}
      dragRotate={canAdjustCamera}
      touchPitch={canAdjustCamera}
      pitchWithRotate={canAdjustCamera}
      interactiveLayerIds={isEditing && role === "admin" ? [] : interactiveBuildingLayerIds}
      onClick={onMapClick}
      onMouseMove={onMapHover}
      onMouseLeave={() => setHoverCard(null)}
      onMove={onMapMove}
      onLoad={handleMapLoad}
      onIdle={handleMapIdle}
    >
      <NavigationControl position="bottom-right" showCompass />

      {canRenderMapSources ? (
        <>
          <Source id="buildings" type="geojson" data={baseBuildingsData}>
            <Layer {...buildingFillLayer} />
            <Layer {...buildingOutlineLayer} />
            {shouldRender3D ? <Layer {...buildingExtrusionLayer} /> : null}
          </Source>

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

          <Source id="architect-seats" type="geojson" data={architectSeatsData}>
            <Layer
              {...({
                ...inactiveSeatLayer,
                filter: floorNonMatchFilter(activeFloorNumber),
                paint: {
                  ...inactiveSeatLayer.paint,
                  "circle-translate": [0, shouldRender3D ? -activeFloorNumber * 6 : 0],
                },
              } as LayerProps)}
            />
            <Layer
              {...({
                ...activeSeatLayer,
                filter: floorMatchFilter(activeFloorNumber),
                paint: {
                  ...activeSeatLayer.paint,
                  "circle-translate": [0, shouldRender3D ? -activeFloorNumber * 6 : 0],
                },
              } as LayerProps)}
            />
          </Source>
        </>
      ) : null}

      {availableSeats.map((seat) => (
        <Marker key={`pulse-${seat.id}`} longitude={seat.coordinates[0]} latitude={seat.coordinates[1]}>
          <span className="block h-3 w-3 rounded-full bg-[#34C759]/40 ring-2 ring-[#34C759]/30 animate-pulse" />
        </Marker>
      ))}

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
