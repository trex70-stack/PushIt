import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { CheckCircle, XCircle, Bell, ChevronLeft, Loader, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils.js";

interface Device {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  platformId: string | null;
}

interface Diagnostics {
  permission: NotificationPermission | "unbekannt" | "prüfen…";
  swState: "nicht unterstützt" | "nicht registriert" | "installing" | "waiting" | "active" | "prüfen…";
  swControlling: boolean;
  hasSubscription: boolean;
}

type RegistrationState = "idle" | "pending" | "success" | "error";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
  return view;
}

function DiagRow({ label, value, ok }: { label: string; value: string; ok: boolean | null }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={cn(
        "font-mono px-2 py-0.5 rounded",
        ok === true ? "bg-green-50 text-green-700" :
        ok === false ? "bg-red-50 text-red-600" :
        "bg-gray-100 text-gray-500"
      )}>{value}</span>
    </div>
  );
}

export function DeviceRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [state, setState] = useState<RegistrationState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [diag, setDiag] = useState<Diagnostics>({
    permission: "prüfen…" as const,
    swState: "prüfen…",
    swControlling: false,
    hasSubscription: false,
  });

  const { data: device, isLoading } = useQuery<Device>({
    queryKey: ["devices", id],
    queryFn: async () => (await api.get(`/devices/${id}`)).data,
  });

  const refreshDiag = async () => {
    const permission = "Notification" in window
      ? Notification.permission
      : ("unbekannt" as const);

    if (!("serviceWorker" in navigator)) {
      setDiag({ permission, swState: "nicht unterstützt", swControlling: false, hasSubscription: false });
      return;
    }

    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) {
      setDiag({ permission, swState: "nicht registriert", swControlling: false, hasSubscription: false });
      return;
    }

    const swState = reg.active ? "active" : reg.waiting ? "waiting" : reg.installing ? "installing" : "nicht registriert";
    const controlling = !!navigator.serviceWorker.controller;
    const sub = await reg.pushManager.getSubscription();

    setDiag({ permission, swState, swControlling: controlling, hasSubscription: !!sub });
  };

  useEffect(() => { refreshDiag(); }, [state]);

  const registerToken = useMutation({
    mutationFn: (platformId: string) =>
      api.post(`/devices/${id}/register-token`, { platformId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      setState("success");
    },
    onError: () => {
      setErrorMsg("Fehler beim Speichern der Subscription im Backend.");
      setState("error");
    },
  });

  const sendTestNotification = async () => {
    setTestMsg("");

    // Schritt 1: Direkte Notification-API testen (ohne SW)
    if (Notification.permission !== "granted") {
      setTestMsg("❌ Berechtigung nicht erteilt (Notification.permission = " + Notification.permission + ")");
      return;
    }

    // Schritt 2: SW-Zustand prüfen
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) {
      setTestMsg("❌ Kein Service Worker gefunden. Bitte erneut registrieren.");
      return;
    }

    if (!reg.active) {
      // Fallback: direkte Notification ohne SW
      try {
        new Notification("PushIt Test (direkt)", {
          body: "SW nicht aktiv – direkte Notification funktioniert!",
          icon: "/favicon.svg",
        });
        setTestMsg("⚠️ SW noch nicht aktiv – direkte Notification wurde gesendet. Seite neu laden und erneut versuchen.");
      } catch (e) {
        setTestMsg("❌ Direkte Notification fehlgeschlagen: " + String(e));
      }
      return;
    }

    // Schritt 3: SW showNotification
    try {
      await reg.showNotification("PushIt Test", {
        body: "Der Service Worker funktioniert korrekt!",
        icon: "/favicon.svg",
      });
      setTestMsg("✅ Notification über Service Worker gesendet – siehst du sie?");
    } catch (e) {
      // Letzter Fallback: direkte Notification
      try {
        new Notification("PushIt Test (direkt)", {
          body: "SW showNotification schlug fehl – direkte Notification als Fallback.",
          icon: "/favicon.svg",
        });
        setTestMsg("⚠️ SW showNotification fehlgeschlagen (" + String(e) + "). Direkte Notification gesendet.");
      } catch (e2) {
        setTestMsg("❌ Beide Methoden fehlgeschlagen: " + String(e2));
      }
    }
  };

  const handleActivate = async () => {
    setState("pending");
    setErrorMsg("");

    try {
      if (!("serviceWorker" in navigator)) {
        setErrorMsg("Dieser Browser unterstützt keine Service Worker.");
        setState("error");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setErrorMsg("Berechtigung verweigert. Bitte erlaube Benachrichtigungen in den Browser-Einstellungen und versuche es erneut.");
        setState("error");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

      // Warten bis SW wirklich aktiv und kontrollierend ist
      await new Promise<void>((resolve) => {
        if (navigator.serviceWorker.controller) { resolve(); return; }
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
        // Timeout-Fallback nach 3s
        setTimeout(resolve, 3000);
      });

      const { data: vapidData } = await api.get<{ publicKey: string }>("/notifications/vapid-public-key");
      if (!vapidData.publicKey) {
        setErrorMsg("VAPID Public Key nicht konfiguriert (Backend .env prüfen).");
        setState("error");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      await registerToken.mutateAsync(JSON.stringify(subscription));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader className="animate-spin text-gray-400" size={24} />
    </div>
  );

  if (!device) return (
    <div className="flex items-center justify-center min-h-screen text-gray-500">
      Gerät nicht gefunden.
    </div>
  );

  const allGood = diag.permission === "granted" && diag.swState === "active" && diag.swControlling && diag.hasSubscription;

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <Link
        to="/devices"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-8 transition-colors"
      >
        <ChevronLeft size={16} /> Zurück zu Geräten
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center mb-4">
        <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Bell size={24} className="text-violet-600" />
        </div>
        <h1 className="text-xl font-semibold mb-1">{device.name}</h1>
        <p className="text-sm text-gray-500 mb-8">
          Diesen Browser als Empfänger für Push-Nachrichten registrieren.
        </p>

        {state === "idle" && (
          <>
            {device.platformId && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                Bereits registriert – neue Registrierung überschreibt die alte.
              </p>
            )}
            <button
              onClick={handleActivate}
              className="w-full bg-violet-600 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              Push-Benachrichtigungen aktivieren
            </button>
          </>
        )}

        {state === "pending" && (
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <Loader size={24} className="animate-spin text-violet-500" />
            <p className="text-sm">Registrierung läuft…</p>
          </div>
        )}

        {state === "success" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle size={40} className="text-green-500" />
            <p className="text-sm font-medium text-green-700">Erfolgreich registriert!</p>
            <div className="flex flex-col gap-2 w-full mt-2">
              <button
                onClick={sendTestNotification}
                className="text-sm bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-lg transition-colors font-medium"
              >
                Test-Benachrichtigung senden
              </button>
              {testMsg && (
                <p className="text-xs text-left bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-600">{testMsg}</p>
              )}
              <Link to="/" className="text-sm text-violet-600 hover:underline mt-1">
                Zur Übersicht
              </Link>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3">
            <XCircle size={40} className="text-red-400" />
            <p className="text-sm font-medium text-red-600">Registrierung fehlgeschlagen</p>
            <p className="text-xs text-gray-500 text-center">{errorMsg}</p>
            <button onClick={() => setState("idle")} className="mt-2 text-sm text-violet-600 hover:underline">
              Erneut versuchen
            </button>
          </div>
        )}
      </div>

      {/* Diagnose-Panel */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Diagnose</span>
          <button onClick={refreshDiag} className="text-xs text-violet-600 hover:underline">Aktualisieren</button>
        </div>
        <DiagRow
          label="Benachrichtigungs-Berechtigung"
          value={diag.permission}
          ok={diag.permission === "granted" ? true : diag.permission === "denied" ? false : null}
        />
        <DiagRow
          label="Service Worker Status"
          value={diag.swState}
          ok={diag.swState === "active" ? true : diag.swState === "nicht unterstützt" || diag.swState === "nicht registriert" ? false : null}
        />
        <DiagRow
          label="SW kontrolliert Seite"
          value={diag.swControlling ? "ja" : "nein"}
          ok={diag.swControlling}
        />
        <DiagRow
          label="Push Subscription"
          value={diag.hasSubscription ? "vorhanden" : "fehlt"}
          ok={diag.hasSubscription}
        />

        {diag.permission === "granted" && diag.swState === "active" && !diag.swControlling && (
          <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>SW aktiv aber kontrolliert die Seite noch nicht. <strong>Seite neu laden</strong> (F5), dann erneut testen.</span>
          </div>
        )}
        {diag.permission === "denied" && (
          <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>Browser-Berechtigung verweigert. In den Browser-Einstellungen zurücksetzen.</span>
          </div>
        )}
        {allGood && (
          <div className="mt-3 flex items-start gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
            <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>Alles bereit. Falls Notifications trotzdem nicht erscheinen: <strong>macOS-Systemeinstellungen → Mitteilungen → {navigator.userAgent.includes("Firefox") ? "Firefox" : "Chrome/Safari"}</strong> prüfen.</span>
          </div>
        )}
      </div>
    </div>
  );
}
