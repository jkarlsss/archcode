import { Mode } from "@archcode/database/enums";
import type { SupportChatModelId } from "@archcode/shared";
import { useCallback } from "react";
import { useDialog } from "../../providers/dialog";
import { DialogSearchList } from "../dialog-search-list";

type ModelsDialogContentProps = {
  models: SupportChatModelId[];
  onSelectModel: (model: SupportChatModelId) => void;
};

function getModelLabel(mode: Mode) {
  return mode === Mode.PLAN ? "Plan" : "Build";
}

export const ModelsDialogContent = ({
  models,
  onSelectModel,
}: ModelsDialogContentProps) => {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (modelId: SupportChatModelId) => {
      onSelectModel(modelId);

      dialog.close();
    },
    [onSelectModel, dialog.close],
  );

  return (
    <DialogSearchList
      items={models}
      onSelect={handleSelect}
      filterFn={(modelId, query) =>
        modelId.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(modelId, isSelected) => (
        <text selectable={false} fg={isSelected ? "black" : "white"}>
          {modelId}
        </text>
      )}
      getKey={(modelId) => modelId}
      placeHolder="Search models"
      emptyText="No matching models"
    />
  );
};
