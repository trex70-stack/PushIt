import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { CheckCircle, XCircle, Clock, Loader, Info, AlertTriangle, Siren } from "lucide-react";
import { cn } from "../lib/utils.js";
import { DeleteButton } from "../components/ui/DeleteButton.js";

interface Delivery {
  id: string;
  status: "pending" | "sent" | "delivered" | "failed" | "expired";
  errorMessage: string | null;
  device: { id: string; name: string; type: string };
}

type NotificationCategory = "info" | "warning" | "emergency";

interface Notification {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  deliveries?: Delivery[];
}

const categoryConfig: Record<NotificationCategory, { icon: React.ElementType; color: string; label: string }> = {
  info:      { icon: Info,          color: "text-blue-500",  label: "Information" },
  warning:   { icon: AlertTriangle, color: "text-amber-500", label: "Warnung"      },
  emergency: { icon: Siren,         color: "text-red-500",   label: "Notfall"      },
};

function StatusIcon({ status }: { status: Delivery["status"] }) {
  switch (status) {
    case "sent":
    case "delivered":
      return <CheckCircle size={13} className="text-green-500" />;
    case "failed":
      return <XCircle size={13} className="text-red-400" />;
    case "expired":
      return <Clock size={13} className="text-gray-300" />;
    default:
      return <Loader size={13} className="text-gray-300 animate-spin" />;
  }
}

function NotificationRow({ n }: { n: Notification }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const { data: detail } = useQuery<Notification>({
    queryKey: ["notifications", n.id],
    queryFn: async () => (await api.get(`/notifications/${n.id}`)).data,
    staleTime: 10_000,
  });

  const deliveries = detail?.deliveries ?? [];
  const isExpired = n.expiresAt && new Date(n.expiresAt) < new Date();
  const cat = categoryConfig[n.category ?? "info"];
  const CatIcon = cat.icon;

  return (
    <div className="px-6 py-4">
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex-shrink-0", isExpired ? "text-gray-300" : cat.color)}>
          {isExpired ? <Clock size={16} /> : <CatIcon size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">{n.title}</p>
            {!isExpired && (
              <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full",
                n.category === "emergency" ? "bg-red-100 text-red-700" :
                n.category === "warning"   ? "bg-amber-100 text-amber-700" :
                                             "bg-blue-100 text-blue-700"
              )}>
                {cat.label}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{n.body}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(n.createdAt).toLocaleString("de-DE")} · {n.createdBy}
          </p>

          {/* Delivery-Status je Gerät */}
          {deliveries.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {deliveries.map((d) => (
                <span
                  key={d.id}
                  title={d.errorMessage ?? d.status}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border",
                    d.status === "sent" || d.status === "delivered"
                      ? "bg-green-50 border-green-200 text-green-700"
                      : d.status === "failed"
                      ? "bg-red-50 border-red-200 text-red-600"
                      : d.status === "expired"
                      ? "bg-gray-50 border-gray-200 text-gray-400"
                      : "bg-gray-50 border-gray-200 text-gray-400"
                  )}
                >
                  <StatusIcon status={d.status} />
                  {d.device.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isExpired && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Abgelaufen
            </span>
          )}
          <DeleteButton onConfirm={() => remove.mutate(n.id)} />
        </div>
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data,
    refetchInterval: 15_000,
  });

  if (isLoading) return <div className="text-gray-400">Laden…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Nachrichten</h1>
        <Link
          to="/notifications/new"
          className="bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          + Neue Nachricht
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {notifications.length === 0 && (
          <p className="px-6 py-8 text-center text-gray-400 text-sm">
            Noch keine Nachrichten gesendet.
          </p>
        )}
        {notifications.map((n) => (
          <NotificationRow key={n.id} n={n} />
        ))}
      </div>
    </div>
  );
}
