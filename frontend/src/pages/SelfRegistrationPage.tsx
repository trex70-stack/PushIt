import { useState } from "react";
import { Bell, CheckCircle, XCircle, Loader } from "lucide-react";

function detectDeviceType(): "desktop_windows" | "desktop_macos" | "desktop_linux" {
  const ua = navigator.userAgent;
  if (ua.includes("Win")) return "desktop_windows";
  if (ua.includes("Mac")) return "desktop_macos";
  return "desktop_linux";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
  return view;
}

export function SelfRegistrationPage() {
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleRegister = async () => {
    if (!name.trim()) return;
    setState("pending");
    setErrorMsg("");

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Dieser Browser unterstützt keine Push-Benachrichtigungen.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Berechtigung verweigert. Bitte erlaube Benachrichtigungen in den Browser-Einstellungen.");
      }

      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

      await new Promise<void>((resolve) => {
        if (navigator.serviceWorker.controller) { resolve(); return; }
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
        setTimeout(resolve, 3000);
      });

      const vapidRes = await fetch("/api/v1/notifications/vapid-public-key");
      const { publicKey } = await vapidRes.json() as { publicKey: string };
      if (!publicKey) throw new Error("VAPID-Key nicht konfiguriert (Backend .env prüfen).");

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch("/api/v1/devices/self-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: detectDeviceType(),
          subscription: subscription.toJSON(),
        }),
      });

      if (!res.ok) throw new Error("Registrierung fehlgeschlagen (Status " + res.status + ").");

      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="w-14 h-14 bg-violet-50 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bell size={24} className="text-violet-600 dark:text-violet-400" />
          </div>
          <h1 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">PushIt</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Diesen Browser für Push-Benachrichtigungen registrieren.
          </p>

          {state === "idle" && (
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                placeholder="Name für dieses Gerät (z.B. Büro-PC)"
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <button
                onClick={handleRegister}
                disabled={!name.trim()}
                className="w-full bg-violet-600 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                Aktivieren
              </button>
            </div>
          )}

          {state === "pending" && (
            <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
              <Loader size={24} className="animate-spin text-violet-500" />
              <p className="text-sm">Registrierung läuft…</p>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle size={40} className="text-green-500" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Erfolgreich registriert!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Dieses Gerät empfängt ab jetzt Push-Benachrichtigungen.
              </p>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-3">
              <XCircle size={40} className="text-red-400" />
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Registrierung fehlgeschlagen</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">{errorMsg}</p>
              <button
                onClick={() => setState("idle")}
                className="mt-1 text-sm text-violet-600 dark:text-violet-400 hover:underline"
              >
                Erneut versuchen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
