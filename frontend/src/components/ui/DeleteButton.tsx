import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "../../lib/utils.js";

interface Props {
  onConfirm: () => void;
  disabled?: boolean;
}

export function DeleteButton({ onConfirm, disabled }: Props) {
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => { onConfirm(); setConfirm(false); }}
          className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
        >
          Ja, löschen
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Nein
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      disabled={disabled}
      className={cn(
        "text-gray-400 hover:text-red-500 transition-colors p-1 rounded",
        disabled && "opacity-30 cursor-not-allowed"
      )}
      title="Löschen"
    >
      <Trash2 size={15} />
    </button>
  );
}
