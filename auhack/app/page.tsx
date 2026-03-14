import { SmartCampusDashboard } from "@/components/SmartCampusDashboard";
import { MapProvider } from "@/context/MapContext";

export default function Home() {
  return (
    <MapProvider>
      <SmartCampusDashboard />
    </MapProvider>
  );
}
