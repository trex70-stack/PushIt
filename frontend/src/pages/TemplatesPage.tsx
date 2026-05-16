import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { Trash2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export function TemplatesPage() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: async () => (await api.get("/templates")).data,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  if (isLoading) return <div className="text-gray-400">Laden…</div>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Templates</h1>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {templates.length === 0 && (
          <p className="px-6 py-8 text-center text-gray-400 text-sm">Noch keine Templates angelegt.</p>
        )}
        {templates.map((tpl) => (
          <div key={tpl.id} className="flex items-center gap-4 px-6 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{tpl.name}</p>
              {tpl.description && <p className="text-xs text-gray-400">{tpl.description}</p>}
            </div>
            <button
              onClick={() => remove.mutate(tpl.id)}
              className="text-gray-400 hover:text-red-500 transition-colors"
              aria-label="Template löschen"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
