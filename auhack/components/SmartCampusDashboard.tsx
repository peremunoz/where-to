"use client";

import { EditMapComponent } from "@/components/EditMapComponent";
import { BuildingInfoSidebar } from "@/components/BuildingInfoSidebar";
import { EditingSidebar } from "@/components/EditingSidebar";
import { MapToolbar } from "@/components/MapToolbar";
import { RoleToggle } from "@/components/RoleToggle";
import { StudentSidebar } from "@/components/StudentSidebar";

export function SmartCampusDashboard() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_10%_10%,rgba(56,189,248,0.15),transparent_30%),radial-gradient(circle_at_90%_20%,rgba(34,197,94,0.14),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#dbeafe_100%)]">
      <EditMapComponent />
      <RoleToggle />
      <StudentSidebar />
      <BuildingInfoSidebar />
      <MapToolbar />
      <EditingSidebar />
    </main>
  );
}
