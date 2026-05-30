import { useCallback, useEffect, useRef } from "react";
import { DialogSearchList } from "../components/dialog-search-list";
import { useDialog } from "../providers/dialog";
import { useTheme } from "../providers/theme";
import { THEMES, type Theme } from "../providers/theme/theme";

export const ThemeDialogContent = () => {
  const dialog = useDialog();

  const { previewTheme, commitTheme } = useTheme();

  const originalThemeRef = useRef(commitTheme);

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
      renderItem={(theme, isSelected) => (
        <text selectable={false} fg={isSelected ? "black" : "white"}>
          {theme.name === originalThemeRef.current.name
            ? "\u0020\u2022\u0020"
            : "\u0020\u0020\u0020"}
          {theme.name}
        </text>
      )}
      getKey={(t) => t.name}
      placeHolder="Select theme"
      emptyText="No matching themes"
    />
  );
};
