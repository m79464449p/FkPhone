import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "fkTeal",
  primaryShade: 7,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: "750"
  },
  colors: {
    fkTeal: [
      "#e2f3f0",
      "#cfe9e5",
      "#a8d7d1",
      "#7cc2ba",
      "#55aea7",
      "#359b94",
      "#1f837e",
      "#0f6b68",
      "#0a5552",
      "#073f3d"
    ],
    fkBlue: [
      "#e6f0fa",
      "#d5e5f5",
      "#b4d0ec",
      "#8eb8df",
      "#6da2d2",
      "#4f8cc3",
      "#3b76aa",
      "#285c8f",
      "#1c4772",
      "#123253"
    ]
  },
  radius: {
    xs: "4px",
    sm: "6px",
    md: "8px",
    lg: "8px",
    xl: "8px"
  },
  defaultRadius: "md",
  shadows: {
    xs: "0 1px 2px rgb(15 23 42 / 6%)",
    sm: "0 1px 2px rgb(15 23 42 / 6%)",
    md: "0 12px 34px rgb(15 23 42 / 11%)",
    lg: "0 24px 80px rgb(15 23 42 / 22%)",
    xl: "0 24px 80px rgb(15 23 42 / 22%)"
  },
  breakpoints: {
    xs: "30em",
    sm: "48em",
    md: "64em",
    lg: "80em",
    xl: "90em"
  }
});
