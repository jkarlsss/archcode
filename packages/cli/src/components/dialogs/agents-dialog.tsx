import { useCallback } from "react";
import { useDialog } from "../../providers/dialog";
import { DialogSearchList } from "../dialog-search-list";
import { Mode, type ModeType } from "@archcode/shared";

const AVAILABLE_MODES: ModeType[] = [Mode.PLAN, Mode.BUILD];

type AgentsDialogContentProps = {
  currentMode: ModeType;
  onSelectMode: (mode: ModeType) => void;
};

function getModelLabel(mode: ModeType) {
  return mode === Mode.PLAN ? "Plan" : "Build";
}

export const AgentsDialogContent = ({
  currentMode,
  onSelectMode,
}: AgentsDialogContentProps) => {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (nextMode: ModeType) => {
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
