import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tv, Radio, Monitor, Smartphone, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { api } from "../lib/api.js";
import { getToken } from "../lib/auth.js";

interface PairInfo {
  deviceType: string;
  createdAt: string;
  expiresAt: string;
  completed: boolean;
}

const typeLabels: Record<string, string> = {
  desktop_windows: "Windows (Browser)",
  desktop_macos: "macOS (Browser)",
  desktop_linux: "Linux (Browser)",
  desktop_electron: "Electron Client",
  desktop_tauri: "Tauri Client (Desktop)",
  samsung_tv: "Samsung TV",
  ios: "iOS",
  android: "Android",
  fire_tv: "Fire TV Cube",
};

function DeviceIcon({ type }: { type: string }) {
  const cls = "text-violet-500";
  if (type === "samsung_tv") return <Tv size={36} className={cls} />;
  if (type === "fire_tv") return <Radio size={36} className={cls} />;
  if (type.startsWith("desktop")) return <Monitor size={36} className={cls} />;
  return <Smartphone size={36} className={cls} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="text-center mb-8">
          <span className="text-xl font-semibold tracking-tight text-violet-600">PushIt</span>
          <p className="text-xs text-gray-400 mt-0.5">Gerät bestätigen</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PairConfirmPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const isLoggedIn = !!getToken();

  const { data, isLoading, error } = useQuery<PairInfo>({
    queryKey: ["pair", code],
    queryFn: async () => (await api.get(`/pair/${code}`)).data,
    retry: false,
    enabled: !!code,
  });

  const confirm = useMutation({
    mutationFn: () => api.post(`/pair/${code}/complete`, { deviceName: name.trim() }),
  });

  if (isLoading) {
    return <Shell><p className="text-center text-sm text-gray-400">Lade…</p></Shell>;
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle size={40} className="text-red-400" />
          <p className="font-medium text-gray-800">Code nicht gefunden oder abgelaufen</p>
          <p className="text-sm text-gray-500">Bitte starte das Pairing am Gerät neu.</p>
        </div>
      </Shell>
    );
  }

  if (data.completed || confirm.isSuccess) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle size={40} className="text-green-500" />
          <p className="font-medium text-gray-800">Pairing abgeschlossen!</p>
          <p className="text-sm text-gray-500">Das Gerät verbindet sich jetzt automatisch.</p>
        </div>
      </Shell>
    );
  }

  const expiresAt = new Date(data.expiresAt);
  const expired = expiresAt < new Date();
  const expiresTime = expiresAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  if (!isLoggedIn) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 text-center">
          <DeviceIcon type={data.deviceType} />
          <div>
            <p className="font-semibold text-gray-800">{typeLabels[data.deviceType] ?? data.deviceType}</p>
            <p className="font-mono text-xs text-gray-400 mt-1">{code}</p>
          </div>
          <p className="text-sm text-gray-500">
            Melde dich als Admin an, um dieses Gerät zu bestätigen.
          </p>
          <button
            onClick={() => navigate(`/login?redirect=/pair/${code}`)}
            className="w-full bg-violet-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-violet-700 transition-colors"
          >
            Als Admin anmelden
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        {/* Geräteinformation */}
        <div className="flex flex-col items-center gap-3 text-center">
          <DeviceIcon type={data.deviceType} />
          <div>
            <p className="text-lg font-semibold text-gray-800">
              {typeLabels[data.deviceType] ?? data.deviceType}
            </p>
            <p className="font-mono text-xs text-gray-400 mt-0.5">{code}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock size={11} />
            {expired
              ? <span className="text-red-500 font-medium">Abgelaufen</span>
              : <span>Gültig bis {expiresTime}</span>
            }
          </div>
        </div>

        {expired ? (
          <p className="text-center text-sm text-red-500">
            Dieser Code ist abgelaufen. Bitte starte das Pairing am Gerät neu.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gerätename
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && confirm.mutate()}
                placeholder="z.B. Wohnzimmer TV"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                autoFocus
              />
            </div>
            {confirm.error && (
              <p className="text-sm text-red-500">
                Fehler beim Bestätigen. Bist du als Admin angemeldet?
              </p>
            )}
            <button
              onClick={() => name.trim() && confirm.mutate()}
              disabled={!name.trim() || confirm.isPending}
              className="w-full bg-violet-600 text-white rounded-lg px-4 py-3 text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {confirm.isPending ? "Wird bestätigt…" : "Gerät bestätigen"}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
