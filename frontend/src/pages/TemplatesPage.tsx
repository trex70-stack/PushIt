import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { Trash2 } from "lucide-react";
import { cn } from "../lib/utils.js";

interface Template {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export function TemplatesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: async () => (await api.get("/templates")).data,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  const bulkRemove = useMutation({
    mutationFn: (ids: string[]) => api.delete("/templates/bulk", { data: { ids } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setSelected(new Set());
      setConfirmBulk(false);
    },
  });

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelected(selected.size === templates.length ? new Set() : new Set(templates.map((t) => t.id)));

  const allSelected = templates.length > 0 && selected.size === templates.length;
  const someSelected = selected.size > 0 && selected.size < templates.length;

  if (isLoading) return <div className="text-gray-400 dark:text-gray-500">Laden…</div>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Templates</h1>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex-wrap">
          <span className="text-sm text-red-700 dark:text-red-400 font-medium flex-1">
            {selected.size} Template{selected.size !== 1 ? "s" : ""} ausgewählt
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
        {templates.length > 0 && (
          <div className="flex items-center gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-t-xl">
            <input type="checkbox" checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-violet-600 cursor-pointer"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Alle auswählen</span>
          </div>
        )}
        {templates.length === 0 && (
          <p className="px-6 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">Noch keine Templates angelegt.</p>
        )}
        {templates.map((tpl) => (
          <div key={tpl.id}
            className={cn("flex items-center gap-4 px-6 py-4 transition-colors", selected.has(tpl.id) && "bg-red-50 dark:bg-red-900/10")}
          >
            <input type="checkbox" checked={selected.has(tpl.id)} onChange={() => toggleSelect(tpl.id)}
              className="w-4 h-4 rounded accent-violet-600 cursor-pointer flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{tpl.name}</p>
              {tpl.description && <p className="text-xs text-gray-400 dark:text-gray-500">{tpl.description}</p>}
            </div>
            <button onClick={() => remove.mutate(tpl.id)}
              className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
              aria-label="Template löschen">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
