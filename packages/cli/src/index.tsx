import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Header } from "../components/header";
import { InputBars } from "../components/input-bars";

function App() {
  return (
    <box
      alignItems="center"
      justifyContent="center"
      width={"100%"}
      height={"100%"}
      gap={2}
    >
      <Header />
      <box
        width={"100%"}
        maxWidth={78}
        paddingX={2}>
        <InputBars onSubmit={() => {}} />
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({
  targetFps: 60,
  exitOnCtrlC: false,
});
createRoot(renderer).render(<App />);
