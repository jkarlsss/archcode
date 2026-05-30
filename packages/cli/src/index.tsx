import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Header } from "./components/header";
import { InputBars } from "./components/input-bars";
import { DialogProvider } from "./providers/dialog";
import { KeyboardLayerProvider } from "./providers/keyboard-layer";
import { ThemeProvider, useTheme } from "./providers/theme";
import { ToastProvider } from "./providers/toast";
import { createMemoryRouter, RouterProvider } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { Home } from "./screens/home";
import { NewSessions } from "./screens/new-sessions";
import { Session } from "./screens/session";

const router = createMemoryRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "sessions/new", element: <NewSessions />},
      { path: "sessions/:id", element: <Session /> }
    ]
  }
])

function App() {
  return (
    <RouterProvider router={router} />
  );
}

const renderer = await createCliRenderer({
  targetFps: 60,
  exitOnCtrlC: false,
});
createRoot(renderer).render(<App />);
