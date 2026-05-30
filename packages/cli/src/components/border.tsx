export const EmptyBorder = {
  top: "",
  cross: "",
  leftT: "",
  rightT: "",
};

export const SplitBorder = {
  border: ['left' as const, 'right' as const],
  customBorderChars: {
    ...EmptyBorder,
    vertical: "|",
  }
};