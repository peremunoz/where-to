const DEFAULT_API_BASE_URL = "https://d825-185-45-22-133.ngrok-free.app";

// Replace this with your existing institution UUID from the backend.
export const HARDCODED_INSTITUTION_ID = "00000000-0000-0000-0000-000000000000";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
  const envBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!envBaseUrl) {
    return DEFAULT_API_BASE_URL;
  }

  return trimTrailingSlash(envBaseUrl);
}

export interface ApiPoint {
  x: number;
  y: number;
}

export interface ApiSeat {
  id: string;
  type: "TABLE" | "CHAIR" | "SOFA";
  label: string;
  status: "AVAILABLE" | "OCCUPIED";
  x: number | null;
  y: number | null;
  floorId: string;
}

export interface ApiFloor {
  id: string;
  floorNumber: number;
  capacity: number;
  blockedAreas: ApiPoint[][] | null;
  buildingId: string;
  seats?: ApiSeat[];
}

export interface ApiBuilding {
  id: string;
  name: string;
  polygon: ApiPoint[] | null;
  institutionId: string;
  floors: ApiFloor[];
}

export interface ApiInstitutionTree {
  id: string;
  name: string;
  address: string;
  buildings: ApiBuilding[];
}

export interface ApiBuildingWithCapacity extends ApiBuilding {
  totalCapacity?: number;
}

export interface CreateBuildingInput {
  name: string;
  institutionId: string;
  polygon?: ApiPoint[];
}

export interface CreateFloorInput {
  floorNumber: number;
  capacity: number;
  buildingId: string;
}

export interface CreateSeatInput {
  type: "TABLE" | "CHAIR" | "SOFA";
  label: string;
  status?: "AVAILABLE" | "OCCUPIED";
  x?: number;
  y?: number;
  floorId: string;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  const rawBody = init?.body;
  let parsedBody: unknown = undefined;

  if (typeof rawBody === "string") {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
  }

  if (rawBody !== undefined) {
    console.log("[API Request]", {
      method,
      url: `${getApiBaseUrl()}${path}`,
      body: parsedBody,
    });
  } else {
    console.log("[API Request]", {
      method,
      url: `${getApiBaseUrl()}${path}`,
    });
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("ngrok-skip-browser-warning", "true");

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers,
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    const message = text || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function getInstitutionTree(): Promise<ApiInstitutionTree[]> {
  return apiRequest<ApiInstitutionTree[]>("/institutions?includeTree=true");
}

export function getBuildings(): Promise<ApiBuildingWithCapacity[]> {
  return apiRequest<ApiBuildingWithCapacity[]>("/buildings");
}

export function createBuilding(input: CreateBuildingInput): Promise<ApiBuilding> {
  return apiRequest<ApiBuilding>("/buildings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createFloor(input: CreateFloorInput): Promise<ApiFloor> {
  return apiRequest<ApiFloor>("/floors", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createSeat(input: CreateSeatInput): Promise<ApiSeat> {
  return apiRequest<ApiSeat>("/seats", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
