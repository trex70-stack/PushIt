import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { Monitor, Tv, Smartphone, Radio, Link2, Trash2, Copy, Check } from "lucide-react";
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

const typeLabels: Record<string, string> = {
  desktop_windows: "Windows", desktop_macos: "macOS", desktop_linux: "Linux",
  desktop_tauri: "Desktop (Tauri)", desktop_electron: "Desktop (Electron)",
  samsung_tv: "Samsung TV", ios: "iOS", android: "Android", fire_tv: "Fire TV",
};

function DeviceIcon({ type }: { type: string }) {
  if (type.startsWith("desktop")) return <Monitor size={16} />;
  if (type === "samsung_tv") return <Tv size={16} />;
  if (type === "fire_tv") return <Radio size={16} />;
  return <Smartphone size={16} />;
}

const tauriTypes = ["desktop_tauri", "desktop_electron", "fire_tv"];

export function DevicesPage() {
  const qc = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const { data: devices = [], isLoading } = useQuery<Device[]>({
    queryKey: ["devices"],
    queryFn: async () => (await api.get("/devices")).data,
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

  const bulkRemove = useMutation({
    mutationFn: (ids: string[]) => api.delete("/devices/bulk", { data: { ids } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      setSelected(new Set());
      setConfirmBulk(false);
    },
  });

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelected(selected.size === devices.length ? new Set() : new Set(devices.map((d) => d.id)));

  const copyUuid = (device: Device) => {
    navigator.clipboard.writeText(device.id);
    setCopiedId(device.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyRegLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/register`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const allSelected = devices.length > 0 && selected.size === devices.length;
  const someSelected = selected.size > 0 && selected.size < devices.length;

  if (isLoading) return <div className="text-gray-400 dark:text-gray-500">Laden…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Geräte</h1>
        <button
          onClick={copyRegLink}
          className="flex items-center gap-2 bg-violet-600 text-white rounded-lg px-3 py-2 md:px-4 text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          {linkCopied ? <Check size={14} /> : <Link2 size={14} />}
          <span className="hidden sm:inline">{linkCopied ? "Link kopiert!" : "Registrierungslink kopieren"}</span>
          <span className="sm:hidden">{linkCopied ? "✓" : "Link"}</span>
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex-wrap">
          <span className="text-sm text-red-700 dark:text-red-400 font-medium flex-1">
            {selected.size} Gerät{selected.size !== 1 ? "e" : ""} ausgewählt
          </span>
          {confirmBulk ? (
            <>
              <span className="text-sm text-red-700 dark:text-red-400">Wirklich löschen?</span>
              <button onClick={() => bulkRemove.mutate([...selected])} disabled={bulkRemove.isPending}
                className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                Ja, löschen
              </button>
              <button onClick={() => setConfirmBulk(false)}
                className="text-xs px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                Abbrechen
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setSelected(new Set())}
                className="text-xs px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                Aufheben
              </button>
              <button onClick={() => setConfirmBulk(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors">
                <Trash2 size={13} />{selected.size} löschen
              </button>
            </>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {devices.length > 0 && (
          <div className="flex items-center gap-4 px-4 md:px-6 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-t-xl">
            <input type="checkbox" checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-violet-600 cursor-pointer"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Alle auswählen</span>
          </div>
        )}
        {devices.length === 0 && (
          <p className="px-6 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
            Noch keine Geräte. Teile den Registrierungslink mit Browser-Nutzern oder starte den Tauri-Client.
          </p>
        )}
        {devices.map((device) => (
          <div key={device.id}
            className={cn("flex items-center gap-3 px-4 md:px-6 py-4 transition-colors", selected.has(device.id) && "bg-red-50 dark:bg-red-900/10")}
          >
            <input type="checkbox" checked={selected.has(device.id)} onChange={() => toggleSelect(device.id)}
              className="w-4 h-4 rounded accent-violet-600 cursor-pointer flex-shrink-0"
            />
            <div className={cn("text-gray-400 flex-shrink-0", !device.isActive && "opacity-40")}>
              <DeviceIcon type={device.type} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", device.isActive ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500")}>
                {device.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-gray-400 dark:text-gray-500">{typeLabels[device.type] ?? device.type}</span>
                {device.platformId ? (
                  <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-full">registriert</span>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">nicht registriert</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
              {tauriTypes.includes(device.type) && (
                <button onClick={() => copyUuid(device)}
                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 px-2 py-1.5 rounded-lg transition-colors font-medium">
                  {copiedId === device.id ? <Check size={12} /> : <Copy size={12} />}
                  <span className="hidden sm:inline">{copiedId === device.id ? "Kopiert" : "UUID kopieren"}</span>
                </button>
              )}
              <button
                onClick={() => toggle.mutate({ id: device.id, isActive: !device.isActive })}
                className={cn(
                  "text-xs px-2 py-1.5 rounded-full font-medium transition-colors",
                  device.isActive
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
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
