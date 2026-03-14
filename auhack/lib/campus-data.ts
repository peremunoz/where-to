import type { FeatureCollection } from "geojson";

export type SeatStatus = "Available" | "Occupied" | "Maintenance";
export type SeatType = "TABLE" | "COMPUTER" | "SOFA";
export type FloorLabel = string;

export interface Seat {
  id: string;
  sensorId: string;
  type: SeatType;
  status: SeatStatus;
  floor: FloorLabel;
  coordinates: [number, number];
}

export interface Room {
  id: string;
  name: string;
  floor: FloorLabel;
  polygon: [number, number][];
  seats: Seat[];
}

export interface Floor {
  id: string;
  label: FloorLabel;
  capacity?: number;
  rooms: Room[];
}

export interface Building {
  id: string;
  name: string;
  center: [number, number];
  polygon: [number, number][];
  floors: Floor[];
  isCustom?: boolean;
}

export interface CampusData {
  buildings: Building[];
}

function rectangleFromCenter(
  center: [number, number],
  deltaLng: number,
  deltaLat: number,
): [number, number][] {
  const [lng, lat] = center;
  return [
    [lng - deltaLng, lat - deltaLat],
    [lng + deltaLng, lat - deltaLat],
    [lng + deltaLng, lat + deltaLat],
    [lng - deltaLng, lat + deltaLat],
    [lng - deltaLng, lat - deltaLat],
  ];
}

function createRoomGrid(
  baseId: string,
  floor: FloorLabel,
  buildingCenter: [number, number],
  startSeatIndex: number,
): Room[] {
  const [lng, lat] = buildingCenter;
  const roomSpecs = [
    { id: `${baseId}-r1`, name: "Collaborative Lab", offset: [-0.00022, 0.00018] as [number, number] },
    { id: `${baseId}-r2`, name: "Focus Studio", offset: [0.0002, 0.00018] as [number, number] },
    { id: `${baseId}-r3`, name: "Maker Bay", offset: [-0.00022, -0.0002] as [number, number] },
    { id: `${baseId}-r4`, name: "Open Commons", offset: [0.0002, -0.0002] as [number, number] },
  ];

  const statuses: SeatStatus[] = ["Available", "Occupied", "Maintenance", "Available"];

  return roomSpecs.map((spec, roomIndex) => {
    const roomCenter: [number, number] = [lng + spec.offset[0], lat + spec.offset[1]];
    const roomPolygon = rectangleFromCenter(roomCenter, 0.00013, 0.0001);

    const seats: Seat[] = [0, 1, 2].map((seatOffset) => ({
      id: `${spec.id}-s${seatOffset + 1}`,
      sensorId: `S-${baseId.toUpperCase()}-${String(startSeatIndex + roomIndex * 3 + seatOffset).padStart(3, "0")}`,
      type: "COMPUTER",
      status: statuses[(roomIndex + seatOffset) % statuses.length],
      floor,
      coordinates: [
        roomCenter[0] + (seatOffset - 1) * 0.00004,
        roomCenter[1] + (seatOffset % 2 === 0 ? 0.00002 : -0.00002),
      ],
    }));

    return {
      id: spec.id,
      name: spec.name,
      floor,
      polygon: roomPolygon,
      seats,
    };
  });
}

function createBuilding(
  id: string,
  name: string,
  center: [number, number],
  seatStart: number,
  floorLabels: FloorLabel[] = ["G", "1", "2", "3", "4"],
): Building {
  return {
    id,
    name,
    center,
    polygon: rectangleFromCenter(center, 0.00045, 0.00035),
    floors: floorLabels.map((label, index) => ({
      id: `${id}-f${label}`,
      label,
      rooms: createRoomGrid(`${id}-f${label}`, label, center, seatStart + index * 24),
    })),
  };
}

export const CAMPUS_DATA: CampusData = {
  buildings: [
    createBuilding("innovation-hub", "Innovation Hub", [-122.1697, 37.4277], 1, ["G", "1", "2", "3", "4"]),
    createBuilding("science-center", "Science Center", [-122.1684, 37.4282], 301, ["G", "1", "2", "3"]),
    createBuilding("library-commons", "Library Commons", [-122.1701, 37.4289], 601, ["G", "1", "2"]),
  ],
};

export function getBuildingOccupancy(building: Building): number {
  const allSeats = building.floors.flatMap((floor) => floor.rooms.flatMap((room) => room.seats));
  if (allSeats.length === 0) {
    return 0;
  }

  const occupied = allSeats.filter((seat) => seat.status === "Occupied").length;
  return Math.round((occupied / allSeats.length) * 100);
}

export function findBuildingById(buildings: Building[], buildingId: string | null): Building | null {
  if (!buildingId) {
    return null;
  }

  return buildings.find((building) => building.id === buildingId) ?? null;
}

export function findNearestBuilding(
  buildings: Building[],
  coordinates: [number, number],
): Building | null {
  if (buildings.length === 0) {
    return null;
  }

  const [targetLng, targetLat] = coordinates;
  return [...buildings].sort((a, b) => {
    const da = (a.center[0] - targetLng) ** 2 + (a.center[1] - targetLat) ** 2;
    const db = (b.center[0] - targetLng) ** 2 + (b.center[1] - targetLat) ** 2;
    return da - db;
  })[0];
}

export function buildingsToGeoJSON(buildings: Building[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: buildings.map((building) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [building.polygon],
      },
      properties: {
        id: building.id,
        name: building.name,
        type: "building",
        isCustom: Boolean(building.isCustom),
        floorCount: building.floors.length,
        occupancy: getBuildingOccupancy(building),
      },
    })),
  } as FeatureCollection;
}

export function roomsToGeoJSON(buildings: Building[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: buildings.flatMap((building) =>
      building.floors.flatMap((floor) =>
        floor.rooms.map((room) => ({
          type: "Feature" as const,
          geometry: {
            type: "Polygon" as const,
            coordinates: [room.polygon],
          },
          properties: {
            id: room.id,
            buildingId: building.id,
            buildingName: building.name,
            roomName: room.name,
            floor: floor.label,
          },
        })),
      ),
    ),
  } as FeatureCollection;
}

export function seatsToGeoJSON(buildings: Building[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: buildings.flatMap((building) =>
      building.floors.flatMap((floor) =>
        floor.rooms.flatMap((room) =>
          room.seats.map((seat) => ({
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: seat.coordinates,
            },
            properties: {
              id: seat.id,
              roomId: room.id,
              roomName: room.name,
              buildingId: building.id,
              buildingName: building.name,
              floor: floor.label,
              sensorId: seat.sensorId,
              type: seat.type,
              status: seat.status,
            },
          })),
        ),
      ),
    ),
  } as FeatureCollection;
}
