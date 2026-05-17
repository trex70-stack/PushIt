import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { CheckCircle, XCircle, Clock, Loader, Info, AlertTriangle, Siren, Trash2, Plus } from "lucide-react";
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

function NotificationRow({ n, selected, onToggle }: {
  n: Notification; selected: boolean; onToggle: () => void;
}) {
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
    <div className={cn("px-4 md:px-6 py-4 transition-colors", selected && "bg-red-50 dark:bg-red-900/10")}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-0.5 w-4 h-4 rounded accent-violet-600 cursor-pointer flex-shrink-0"
        />
        <div className={cn("mt-0.5 flex-shrink-0", isExpired ? "text-gray-300 dark:text-gray-600" : cat.color)}>
          {isExpired ? <Clock size={16} /> : <CatIcon size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
            {!isExpired && (
              <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full",
                n.category === "emergency" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                n.category === "warning"   ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                                             "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
              )}>
                {cat.label}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.body}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {new Date(n.createdAt).toLocaleString("de-DE")} · {n.createdBy}
          </p>
          {deliveries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {deliveries.map((d) => (
                <span key={d.id} title={d.errorMessage ?? d.status}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border",
                    d.status === "sent" || d.status === "delivered"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                      : d.status === "failed"
                      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                      : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500"
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
            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full hidden sm:inline">
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
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data,
    refetchInterval: 15_000,
  });

  const bulkRemove = useMutation({
    mutationFn: (ids: string[]) => api.delete("/notifications/bulk", { data: { ids } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setSelected(new Set());
      setConfirmBulk(false);
    },
  });

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelected(selected.size === notifications.length ? new Set() : new Set(notifications.map((n) => n.id)));

  const allSelected = notifications.length > 0 && selected.size === notifications.length;
  const someSelected = selected.size > 0 && selected.size < notifications.length;

  if (isLoading) return <div className="text-gray-400 dark:text-gray-500">Laden…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Nachrichten</h1>
        <Link
          to="/notifications/new"
          className="flex items-center gap-1.5 bg-violet-600 text-white rounded-lg px-3 py-2 md:px-4 text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Neue Nachricht</span>
          <span className="sm:hidden">Neu</span>
        </Link>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex-wrap">
          <span className="text-sm text-red-700 dark:text-red-400 font-medium flex-1">
            {selected.size} Nachricht{selected.size !== 1 ? "en" : ""} ausgewählt
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
        {notifications.length > 0 && (
          <div className="flex items-center gap-4 px-4 md:px-6 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-t-xl">
            <input type="checkbox" checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-violet-600 cursor-pointer"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Alle auswählen</span>
          </div>
        )}
        {notifications.length === 0 && (
          <p className="px-6 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">Noch keine Nachrichten gesendet.</p>
        )}
        {notifications.map((n) => (
          <NotificationRow key={n.id} n={n} selected={selected.has(n.id)} onToggle={() => toggleSelect(n.id)} />
        ))}
      </div>
    </div>
  );
}
