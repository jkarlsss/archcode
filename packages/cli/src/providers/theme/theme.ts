export type ThemeColors = {
  primary: string;
  planMode: string;
  selection: string;
  thinking: string;
  success: string;
  error: string;
  info: string;
  background: string;
  surface: string;
  dialogSurface: string;
  thinkingBorder: string;
  dimSeparator: string;
};

export type Theme = {
  name: string;
  colors: ThemeColors;
};

export const THEMES: Theme[] = [
  {
    name: "Nightfox",
    colors: {
      primary: "#719cd6",
      planMode: "#dbc475",
      selection: "#2b3b51",
      thinking: "#9d7cd8",
      success: "#81b29a",
      error: "#c94f6d",
      info: "#7dcfff",
      background: "#192330",
      surface: "#212e3f",
      dialogSurface: "#29394f",
      thinkingBorder: "#b494f4",
      dimSeparator: "#2e3f53",
    }
  },
  {
    name: "Gruvbox Dark",
    colors: {
      primary: "#fabd2f",         // Retro gold/yellow
      planMode: "#b8bb26",        // Earthy green
      selection: "#504945",       // Dark warm grey
      thinking: "#d3869b",        // Muted rose
      success: "#8ec07c",         // Pale aqua/green
      error: "#fb4934",           // Vibrant orange-red
      info: "#83a598",            // Dusty teal
      background: "#1d2021",      // Near-black chocolate
      surface: "#282828",         // Hard charcoal
      dialogSurface: "#32302f",   // Soft brown-grey
      thinkingBorder: "#fe8019",  // Bright orange
      dimSeparator: "#3c3836",    // Medium warm grey
    }
  },
  {
    name: "Tokyo Night",
    colors: {
      primary: "#7aa2f7",         // Electric blue
      planMode: "#e0af68",        // Bright amber
      selection: "#33467c",       // Deep neon blue
      thinking: "#bb9af7",        // Cyber purple
      success: "#9ece6a",         // Lime green
      error: "#f7768e",           // Soft pink-red
      info: "#0db9d7",            // Cyan
      background: "#1a1b26",      // Deep indigo
      surface: "#24283b",         // Rich navy
      dialogSurface: "#2f3549",   // Elevated indigo
      thinkingBorder: "#9d7cd8",  // Vivid violet
      dimSeparator: "#3b4261",    // Slate blue
    }
  },
  {
    name: "Monochrome Deep",
    colors: {
      primary: "#ffffff",         // Pure white
      planMode: "#a0a0a0",        // Mid-grey
      selection: "#333333",       // Dark grey highlight
      thinking: "#e0e0e0",        // Light grey
      success: "#ffffff",         // Minimalist (use icons)
      error: "#ff4d4d",           // Red is the only color allowed
      info: "#cccccc",            // Light silver
      background: "#000000",      // True black
      surface: "#121212",         // Darkest grey
      dialogSurface: "#1e1e1e",   // Standard material grey
      thinkingBorder: "#ffffff",  // Stark white
      dimSeparator: "#262626",    // Very subtle grey
    }
  }
];

export const DEFAULT_THEME = THEMES.find((theme) => theme.name === "Nightfox")!;