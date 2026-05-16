import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { Monitor, Tv, Smartphone, Radio, ChevronLeft, Info, AlertTriangle, Siren } from "lucide-react";
import { cn } from "../lib/utils.js";

interface Device {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface Template {
  id: string;
  name: string;
  devices: Device[];
}

const categories = [
  {
    value: "info" as const,
    label: "Information",
    icon: Info,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-400",
    selectedBg: "bg-blue-50",
    selectedText: "text-blue-800",
  },
  {
    value: "warning" as const,
    label: "Warnung",
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-400",
    selectedBg: "bg-amber-50",
    selectedText: "text-amber-800",
  },
  {
    value: "emergency" as const,
    label: "Notfall",
    icon: Siren,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-500",
    selectedBg: "bg-red-50",
    selectedText: "text-red-800",
  },
] as const;

const schema = z.object({
  title: z.string().min(1, "Titel erforderlich").max(255),
  body: z.string().min(1, "Text erforderlich"),
  category: z.enum(["info", "warning", "emergency"]).default("info"),
  imageUrl: z.string().url("Ungültige URL").optional().or(z.literal("")),
  ttlSeconds: z.coerce.number().int().positive().optional(),
  deviceIds: z.array(z.string()).min(1, "Mindestens ein Gerät auswählen"),
  templateId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function DeviceIcon({ type }: { type: string }) {
  if (type.startsWith("desktop")) return <Monitor size={14} />;
  if (type === "samsung_tv") return <Tv size={14} />;
  if (type === "fire_tv") return <Radio size={14} />;
  return <Smartphone size={14} />;
}

const typeLabels: Record<string, string> = {
  desktop_windows: "Windows",
  desktop_macos: "macOS",
  desktop_linux: "Linux",
  samsung_tv: "Samsung TV",
  ios: "iOS",
  android: "Android",
  fire_tv: "Fire TV",
};

export function NewNotificationPage() {
  const navigate = useNavigate();

  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: ["devices"],
    queryFn: async () => (await api.get("/devices")).data,
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: async () => (await api.get("/templates")).data,
  });

  const activeDevices = devices.filter((d) => d.isActive);

  const { register, handleSubmit, control, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { deviceIds: [], category: "info" },
  });

  const selectedDeviceIds = watch("deviceIds");
  const selectedCategory = watch("category");

  const send = useMutation({
    mutationFn: (data: FormData) =>
      api.post("/notifications", {
        ...data,
        imageUrl: data.imageUrl || undefined,
        ttlSeconds: data.ttlSeconds || undefined,
        templateId: data.templateId || undefined,
      }),
    onSuccess: () => navigate("/"),
  });

  const onSubmit = (data: FormData) => send.mutateAsync(data);

  const applyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      setValue("deviceIds", tpl.devices.map((d) => d.id));
      setValue("templateId", templateId);
    }
  };

  const toggleDevice = (id: string) => {
    const current = selectedDeviceIds ?? [];
    setValue(
      "deviceIds",
      current.includes(id) ? current.filter((d) => d !== id) : [...current, id]
    );
  };

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft size={16} /> Zurück
      </button>

      <h1 className="text-2xl font-semibold mb-6">Neue Nachricht</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Template-Auswahl */}
        {templates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
            <select
              onChange={(e) => e.target.value && applyTemplate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">— Template wählen (optional) —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Kategorie */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Kategorie</label>
          <div className="grid grid-cols-3 gap-3">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const active = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setValue("category", cat.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all",
                    active
                      ? `${cat.border} ${cat.selectedBg}`
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <Icon size={22} className={active ? cat.color : "text-gray-400"} />
                  <span className={cn("text-xs font-semibold", active ? cat.selectedText : "text-gray-500")}>
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Titel */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
          <input
            {...register("title")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="z.B. Türklingel"
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>

        {/* Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nachricht</label>
          <textarea
            {...register("body")}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            placeholder="Nachrichtentext…"
          />
          {errors.body && <p className="text-red-500 text-xs mt-1">{errors.body.message}</p>}
        </div>

        {/* Bild-URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bild-URL (optional)</label>
          <input
            {...register("imageUrl")}
            type="url"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="https://example.com/bild.jpg"
          />
          {errors.imageUrl && <p className="text-red-500 text-xs mt-1">{errors.imageUrl.message}</p>}
        </div>

        {/* TTL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Anzeigedauer in Sekunden (optional)
          </label>
          <input
            {...register("ttlSeconds")}
            type="number"
            min={1}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="z.B. 300 = 5 Minuten"
          />
        </div>

        {/* Geräte-Auswahl */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Zielgeräte</label>
          <div className="grid grid-cols-1 gap-2">
            {activeDevices.map((device) => {
              const selected = selectedDeviceIds?.includes(device.id);
              return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => toggleDevice(device.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors",
                    selected
                      ? "border-violet-500 bg-violet-50 text-violet-800"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  )}
                >
                  <div className={selected ? "text-violet-600" : "text-gray-400"}>
                    <DeviceIcon type={device.type} />
                  </div>
                  <span className="text-sm font-medium">{device.name}</span>
                  <span className="ml-auto text-xs text-gray-400">{typeLabels[device.type]}</span>
                </button>
              );
            })}
            {activeDevices.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Keine aktiven Geräte vorhanden.</p>
            )}
          </div>
          {errors.deviceIds && (
            <p className="text-red-500 text-xs mt-1">{errors.deviceIds.message}</p>
          )}
        </div>

        {send.error && (
          <p className="text-red-500 text-sm">Fehler beim Senden. Bitte erneut versuchen.</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || send.isPending}
          className="w-full bg-violet-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {send.isPending ? "Wird gesendet…" : "Nachricht senden"}
        </button>
      </form>
    </div>
  );
}
