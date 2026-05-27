import { TextareaRenderable, type KeyBinding } from "@opentui/core";
import { useRenderer } from "@opentui/react";
import { useCallback, useEffect, useRef } from "react";
import { useCommandMenu } from "../src/components/command-menu/use-command-menu";
import { CommandMenu } from "../src/components/commands-menu";
import { EmptyBorder } from "./border";
import { StatusBar } from "./status-bar";
import type { Command } from "../src/components/commands-menu/types";

type InputBarsProps = {
  onSubmit: (value: string) => void;
  disabled?: boolean;
};

export const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
  { name: "return", action: "submit" },
  { name: "enter", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "enter", shift: true, action: "newline" },
];

export function InputBars({ onSubmit, disabled }: InputBarsProps) {
  const textareaRef = useRef<TextareaRenderable>(null);
  const onSubmitRef = useRef<() => void>(() => {});
  const renderer = useRenderer();

  const {
    showCommandMenu,
    commandQuery,
    selectedIndex,
    scrollRef,
    handleContentChange,
    resolveCommand,
    setSelectedIndex,
  } = useCommandMenu();

  const handleCommandExecute = useCallback((
    index: number
  ) => {
    const command = resolveCommand(index);
    handleCommand(command);
  }, [])

  const handleTextareaContentChange = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    handleContentChange(textarea.plainText);
  }, []);

  const handleSubmit = useCallback(() => {
    if (disabled) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = textarea.plainText.trim();
    if (text.length === 0) return;

    onSubmit(text);
    textarea.setText("");
  }, [disabled, onSubmit]);

  const handleCommand = useCallback(
    (command: Command | undefined) => {
      const textarea = textareaRef.current;
      if (!textarea || !command) return;

      textarea.setText("");

      if (command.action) {
        command.action({
          exit: () => renderer.destroy(),
        });
      } else {
        textarea.insertText(command.value + " ");
      }
    },
    [renderer],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.onSubmit = () => {
      onSubmitRef.current();
    };
  }, []);

  onSubmitRef.current = () => {
    if (disabled) return;

    if (showCommandMenu) {
      const command = resolveCommand(selectedIndex);
      handleCommand(command);
      return;
    }

    handleSubmit();
  };

  return (
    <box width={"100%"} alignItems="center">
      <box
        border={["left"]}
        borderColor="cyan"
        customBorderChars={{
          ...EmptyBorder,
          vertical: "┃", // thicker than |
          bottomLeft: "┃",
          topLeft: "┃",
          topRight: "",
          horizontal: "",
          bottomRight: "",
          topT: "",
          bottomT: "",
        }}
        width={"100%"}
      >
        <box
          width={"100%"}
          position="relative"
          paddingX={2}
          paddingY={1}
          backgroundColor={"#1A1A24"}
          gap={1}
          justifyContent="center"
        >
          {showCommandMenu && (
            <box
              position="absolute"
              bottom={"100%"}
              left={0}
              width={"100%"}
              zIndex={10}
              backgroundColor="#1A1A24"
            >
              <CommandMenu 
                query=""
                selectedIndex={selectedIndex}
                scrollRef={scrollRef}
                onSelect={setSelectedIndex}
                onExecute={handleCommandExecute}
              />
            </box>
          )}
          <textarea
            keyBindings={TEXTAREA_KEY_BINDINGS}
            ref={textareaRef}
            onContentChange={handleTextareaContentChange}
            focused={!disabled}
            placeholder={`Give me a task... "Create an ecommerce website"`}
          />
          <StatusBar />
        </box>
      </box>
    </box>
  );
}
