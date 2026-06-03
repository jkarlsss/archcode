import { TextAttributes } from "@opentui/core";
import { usePromptConfig } from "../providers/prompt-config";
import { InputBars } from "./input-bars";
import { Spinner } from "./spinner";

type Props = {
  children?: React.ReactNode;
  onSubmit: (text: string) => void;
  inputDisabled?: boolean;
  loading?: boolean;
  interruptible?: boolean;
};

export function SessionShell({
  children,
  onSubmit,
  inputDisabled,
  loading,
  interruptible,
}: Props) {
  const { mode } = usePromptConfig();
  return (
    <box
      flexDirection="column"
      flexGrow={1}
      width={"100%"}
      height={"100%"}
      paddingY={1}
      paddingX={2}
      gap={1}
    >
      <scrollbox flexGrow={1} width={"100%"} stickyScroll stickyStart="bottom">
        <box gap={1}>{children}</box>
      </scrollbox>
      <box flexShrink={0}>
        <InputBars onSubmit={onSubmit} disabled={inputDisabled} />
      </box>
      <box
        flexShrink={0}
        flexDirection="row"
        justifyContent="space-between"
        width={"100%"}
        height={1}
        gap={2}
        paddingLeft={1}
      >
        <box flexDirection="row" alignItems="center" gap={2}>
          {loading ? (
            <>
              <Spinner mode={mode} />
              {interruptible ? <text>esc to interrupt</text> : null}
            </>
          ) : null}
        </box>

        <box flexDirection="row" flexShrink={0} marginLeft={"auto"}>
          <text>tab</text>
          <text attributes={TextAttributes.DIM}>{"\u00A0"}agents</text>{" "}
        </box>
      </box>
    </box>
  );
}
