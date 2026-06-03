import { Mode } from "@archcode/database/enums";
import { DEFAULT_CHAT_MODEL_ID, type SupportChatModelId } from "@archcode/shared";
import { createContext, useCallback, useContext, useState } from "react";

type PrompConfigContextValue = {
  mode: Mode;
  toggleMode: () => void;
  setMode: (mode: Mode) => void;
  model: SupportChatModelId;
  setModel: (model: SupportChatModelId) => void;
}

const PromptConfigContext = createContext<PrompConfigContextValue | null>(null);

export function usePromptConfig(): PrompConfigContextValue {
  const context = useContext(PromptConfigContext);
  if (!context) {
    throw new Error("usePromptConfig must be used within a PromptConfigProvider");
  }
  return context;
};

type PromptConfigProviderProps = {
  children: React.ReactNode;
};

export function PromptConfigProvider({ children }: PromptConfigProviderProps) {
  const [mode, setMode] = useState<Mode>(Mode.BUILD);
  const [model, setModel] = useState<SupportChatModelId>(DEFAULT_CHAT_MODEL_ID);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === Mode.BUILD ? Mode.PLAN : Mode.BUILD));
  }, []);

  const value = {
    mode,
    toggleMode,
    setMode,
    model,
    setModel
  };

  return (
    <PromptConfigContext.Provider value={value}>
      {children}
    </PromptConfigContext.Provider>
  );
};