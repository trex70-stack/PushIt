import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { Copy } from "lucide-react";
import { DeleteButton } from "../components/ui/DeleteButton.js";

interface ApiKey {
  id: string;
  label: string;
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiKeysPage() {
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  const { data: keys = [] } = useQuery<ApiKey[]>({
    queryKey: ["api-keys"],
    queryFn: async () => (await api.get("/api-keys")).data,
  });

  const create = useMutation({
    mutationFn: (label: string) => api.post<ApiKey & { key: string }>("/api-keys", { label }),
    onSuccess: (res) => {
      setNewKey(res.data.key);
      setLabel("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">API-Keys</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">Neuen Key erstellen</h2>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Bezeichnung (z.B. Home Assistant)"
            className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button
            onClick={() => label.trim() && create.mutate(label.trim())}
            disabled={!label.trim() || create.isPending}
            className="bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            Erstellen
          </button>
        </div>
        {newKey && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">Key – wird nur einmalig angezeigt:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs break-all text-green-900 dark:text-green-300">{newKey}</code>
              <button onClick={() => navigator.clipboard.writeText(newKey)} className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 flex-shrink-0">
                <Copy size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {keys.length === 0 && (
          <p className="px-6 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">Noch keine API-Keys vorhanden.</p>
        )}
        {keys.map((key) => (
          <div key={key.id} className="flex items-center gap-4 px-6 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{key.label}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {key.lastUsedAt
                  ? `Zuletzt genutzt: ${new Date(key.lastUsedAt).toLocaleDateString("de-DE")}`
                  : "Noch nie genutzt"}
              </p>
            </div>
            <DeleteButton onConfirm={() => revoke.mutate(key.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
