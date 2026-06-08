import { useCallback, useEffect, useRef } from "react";
import { useDialog } from "../../providers/dialog";
import { useTheme } from "../../providers/theme";
import { THEMES, type Theme } from "../../providers/theme/theme";
import { DialogSearchList } from "../dialog-search-list";

export const ThemeDialogContent = () => {
  const dialog = useDialog();

  const { previewTheme, commitTheme, currentTheme, colors } = useTheme();

  const originalThemeRef = useRef(currentTheme);

  const confirmedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (!confirmedRef.current) {
        previewTheme(originalThemeRef.current.name);
      }
    };
  }, [previewTheme]);

  const handleSelect = useCallback(
    (theme: Theme) => {
      confirmedRef.current = true;

      commitTheme(theme.name);

      dialog.close();
    },
    [commitTheme, dialog.close],
  );

  const handleHighlight = useCallback(
    (theme: Theme) => {
      previewTheme(theme.name);
    },
    [previewTheme],
  );

  return (
    <DialogSearchList
      items={THEMES}
      onSelect={handleSelect}
      onHighlight={handleHighlight}
      filterFn={(t, query) =>
        t.name.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(theme, isSelected) => {
        const contrastForeColor = (hex: string) => {
          const normalized = hex.replace(/^#/, "");
          const r = parseInt(normalized.substring(0, 2), 16);
          const g = parseInt(normalized.substring(2, 4), 16);
          const b = parseInt(normalized.substring(4, 6), 16);
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          return lum < 128 ? "#FFFFFF" : "#000000";
        };

        const fg = isSelected
          ? contrastForeColor(colors.selection)
          : contrastForeColor(colors.dialogSurface);

        return (
          <text selectable={false} fg={fg}>
            {theme.name === originalThemeRef.current.name
              ? "\u0020\u2022\u0020"
              : "\u0020\u0020\u0020"}
            {theme.name}
          </text>
        );
      }}
      getKey={(t) => t.name}
      placeHolder="Select theme"
      emptyText="No matching themes"
    />
  );
};
