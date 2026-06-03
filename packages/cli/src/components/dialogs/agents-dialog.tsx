import { Mode } from "@archcode/database/enums";
import { useCallback } from "react";
import { useDialog } from "../../providers/dialog";
import { DialogSearchList } from "../dialog-search-list";

const AVAILABLE_MODES: Mode[] = [Mode.PLAN, Mode.BUILD];

type AgentsDialogContentProps = {
  currentMode: Mode;
  onSelectMode: (mode: Mode) => void;
};

function getModelLabel(mode: Mode) {
  return mode === Mode.PLAN ? "Plan" : "Build";
}

export const AgentsDialogContent = ({
  currentMode,
  onSelectMode,
}: AgentsDialogContentProps) => {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (nextMode: Mode) => {
      onSelectMode(nextMode);

      dialog.close();
    },
    [onSelectMode, dialog.close],
  );

  return (
    <DialogSearchList
      items={AVAILABLE_MODES}
      onSelect={handleSelect}
      filterFn={(t, query) =>
        getModelLabel(t).toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(mode, isSelected) => (
        <text selectable={false} fg={isSelected ? "black" : "white"}>
          {mode === currentMode ? " • " : "   "}
          {getModelLabel(mode)}
        </text>
      )}
      getKey={(t) => t}
      placeHolder="Search agents"
      emptyText="No matching agents"
    />
  );
};
