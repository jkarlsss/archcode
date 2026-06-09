import { DEFAULT_CHAT_MODEL_ID, Mode, type ModeType, type SupportChatModelId } from "@archcode/shared";
import { createContext, useCallback, useContext, useState } from "react";

type PromptConfigContextValue = {
  mode: ModeType;
  toggleMode: () => void;
  setMode: (mode: ModeType) => void;
  model: SupportChatModelId;
  setModel: (model: SupportChatModelId) => void;
}

const PromptConfigContext = createContext<PromptConfigContextValue | null>(null);

export function usePromptConfig(): PromptConfigContextValue {
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
  const [mode, setMode] = useState<ModeType>(Mode.BUILD);
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