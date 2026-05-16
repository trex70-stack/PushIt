import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { Monitor, Tv, Smartphone, Radio, Link2, Plus, X } from "lucide-react";
import { DeleteButton } from "../components/ui/DeleteButton.js";
import { cn } from "../lib/utils.js";

interface Device {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  platformId: string | null;
  createdAt: string;
}

const deviceTypes = [
  { value: "desktop_tauri", label: "Tauri Client (Desktop)" },
  { value: "desktop_windows", label: "Windows (Browser)" },
  { value: "desktop_macos", label: "macOS (Browser)" },
  { value: "desktop_linux", label: "Linux (Browser)" },
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
  { value: "samsung_tv", label: "Samsung TV" },
  { value: "fire_tv", label: "Fire TV" },
] as const;

const typeLabels: Record<string, string> = Object.fromEntries(
  deviceTypes.map((t) => [t.value, t.label])
);

function DeviceIcon({ type }: { type: string }) {
  if (type.startsWith("desktop")) return <Monitor size={16} />;
  if (type === "samsung_tv") return <Tv size={16} />;
  if (type === "fire_tv") return <Radio size={16} />;
  return <Smartphone size={16} />;
}

const webPushTypes = ["desktop_windows", "desktop_macos", "desktop_linux"];
const tauriTypes = ["desktop_tauri", "desktop_electron", "fire_tv"];

export function DevicesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("desktop_tauri");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: devices = [], isLoading } = useQuery<Device[]>({
    queryKey: ["devices"],
    queryFn: async () => (await api.get("/devices")).data,
  });

  const create = useMutation({
    mutationFn: () => api.post("/devices", { name: name.trim(), type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      setName("");
      setType("desktop_macos");
      setShowForm(false);
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/devices/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/devices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
  });

  const copyRegistrationLink = (device: Device) => {
    // Für Tauri/Electron-Client: nur die UUID kopieren; für Web-Push: Registrierungs-URL
    const text = tauriTypes.includes(device.type)
      ? device.id
      : `${window.location.origin}/devices/${device.id}/register`;
    navigator.clipboard.writeText(text);
    setCopiedId(device.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) return <div className="text-gray-400">Laden…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Geräte</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Abbrechen" : "Gerät hinzufügen"}
        </button>
      </div>

      {/* Erstellungsformular */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <h2 className="text-sm font-medium mb-4">Neues Gerät</h2>
          <div className="flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (z.B. Wohnzimmer-PC)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {deviceTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              onClick={() => name.trim() && create.mutate()}
              disabled={!name.trim() || create.isPending}
              className="bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              Erstellen
            </button>
          </div>
        </div>
      )}

      {/* Geräteliste */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {devices.length === 0 && (
          <p className="px-6 py-8 text-center text-gray-400 text-sm">
            Noch keine Geräte. Klicke auf „Gerät hinzufügen".
          </p>
        )}
        {devices.map((device) => (
          <div key={device.id} className="flex items-center gap-4 px-6 py-4">
            <div className={cn("text-gray-400", !device.isActive && "opacity-40")}>
              <DeviceIcon type={device.type} />
            </div>

            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", !device.isActive && "text-gray-400")}>
                {device.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400">{typeLabels[device.type] ?? device.type}</span>
                {device.platformId ? (
                  <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">registriert</span>
                ) : (
                  <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">nicht registriert</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {webPushTypes.includes(device.type) && (
                <Link
                  to={`/devices/${device.id}/register`}
                  className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  title="Diesen Browser registrieren"
                >
                  <Link2 size={12} />
                  Browser registrieren
                </Link>
              )}
              {tauriTypes.includes(device.type) && (
                <button
                  onClick={() => copyRegistrationLink(device)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  title={`Device-ID: ${device.id}`}
                >
                  <Link2 size={12} />
                  {copiedId === device.id ? "✓ UUID kopiert" : "UUID kopieren"}
                </button>
              )}

              <button
                onClick={() => toggle.mutate({ id: device.id, isActive: !device.isActive })}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full font-medium transition-colors",
                  device.isActive
                    ? "bg-green-50 text-green-700 hover:bg-green-100"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                {device.isActive ? "Aktiv" : "Inaktiv"}
              </button>
              <DeleteButton onConfirm={() => remove.mutate(device.id)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
