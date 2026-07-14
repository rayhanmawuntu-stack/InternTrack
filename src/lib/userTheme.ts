export type UserColorScheme = "rose" | "blue" | "violet" | "emerald" | "amber";

type ThemeDefinition = {
  id: UserColorScheme;
  label: string;
  swatches: [string, string, string];
  variables: Record<string, string>;
};

export const DEFAULT_USER_COLOR_SCHEME: UserColorScheme = "rose";

export const USER_COLOR_SCHEMES: ThemeDefinition[] = [
  {
    id:"rose",
    label:"Rose",
    swatches:["#f9a8d4", "#f472b6", "#e11d48"],
    variables:{
      "--it-primary":"#e11d48",
      "--it-primary-dark":"#be185d",
      "--it-primary-rgb":"225,29,72",
      "--it-primary-dark-rgb":"190,24,93",
      "--it-accent":"#f472b6",
      "--it-accent-rgb":"244,114,182",
      "--it-accent-light":"#f9a8d4",
      "--it-accent-light-rgb":"249,168,212",
      "--it-accent-pale":"#fbcfe8",
      "--it-accent-wash":"#fce4ec",
      "--it-accent-bright":"#ff80c0",
      "--it-bg-soft":"#fda4c8",
      "--it-bg-mid":"#e879a0",
      "--it-bg-deep":"#db2777",
      "--it-bg-end":"#be185d",
      "--it-ink":"#3d0a20",
      "--it-ink-rgb":"61,10,32",
    },
  },
  {
    id:"blue",
    label:"Ocean",
    swatches:["#93c5fd", "#60a5fa", "#2563eb"],
    variables:{
      "--it-primary":"#2563eb",
      "--it-primary-dark":"#1d4ed8",
      "--it-primary-rgb":"37,99,235",
      "--it-primary-dark-rgb":"29,78,216",
      "--it-accent":"#60a5fa",
      "--it-accent-rgb":"96,165,250",
      "--it-accent-light":"#93c5fd",
      "--it-accent-light-rgb":"147,197,253",
      "--it-accent-pale":"#dbeafe",
      "--it-accent-wash":"#eff6ff",
      "--it-accent-bright":"#7dd3fc",
      "--it-bg-soft":"#bfdbfe",
      "--it-bg-mid":"#60a5fa",
      "--it-bg-deep":"#3b82f6",
      "--it-bg-end":"#1d4ed8",
      "--it-ink":"#102a43",
      "--it-ink-rgb":"16,42,67",
    },
  },
  {
    id:"violet",
    label:"Violet",
    swatches:["#c4b5fd", "#a78bfa", "#7c3aed"],
    variables:{
      "--it-primary":"#7c3aed",
      "--it-primary-dark":"#6d28d9",
      "--it-primary-rgb":"124,58,237",
      "--it-primary-dark-rgb":"109,40,217",
      "--it-accent":"#a78bfa",
      "--it-accent-rgb":"167,139,250",
      "--it-accent-light":"#c4b5fd",
      "--it-accent-light-rgb":"196,181,253",
      "--it-accent-pale":"#ede9fe",
      "--it-accent-wash":"#f5f3ff",
      "--it-accent-bright":"#d8b4fe",
      "--it-bg-soft":"#ddd6fe",
      "--it-bg-mid":"#a78bfa",
      "--it-bg-deep":"#8b5cf6",
      "--it-bg-end":"#6d28d9",
      "--it-ink":"#2e1065",
      "--it-ink-rgb":"46,16,101",
    },
  },
  {
    id:"emerald",
    label:"Emerald",
    swatches:["#6ee7b7", "#34d399", "#059669"],
    variables:{
      "--it-primary":"#059669",
      "--it-primary-dark":"#047857",
      "--it-primary-rgb":"5,150,105",
      "--it-primary-dark-rgb":"4,120,87",
      "--it-accent":"#34d399",
      "--it-accent-rgb":"52,211,153",
      "--it-accent-light":"#6ee7b7",
      "--it-accent-light-rgb":"110,231,183",
      "--it-accent-pale":"#d1fae5",
      "--it-accent-wash":"#ecfdf5",
      "--it-accent-bright":"#5eead4",
      "--it-bg-soft":"#a7f3d0",
      "--it-bg-mid":"#34d399",
      "--it-bg-deep":"#10b981",
      "--it-bg-end":"#047857",
      "--it-ink":"#053b31",
      "--it-ink-rgb":"5,59,49",
    },
  },
  {
    id:"amber",
    label:"Amber",
    swatches:["#fcd34d", "#fbbf24", "#d97706"],
    variables:{
      "--it-primary":"#d97706",
      "--it-primary-dark":"#b45309",
      "--it-primary-rgb":"217,119,6",
      "--it-primary-dark-rgb":"180,83,9",
      "--it-accent":"#fbbf24",
      "--it-accent-rgb":"251,191,36",
      "--it-accent-light":"#fcd34d",
      "--it-accent-light-rgb":"252,211,77",
      "--it-accent-pale":"#fef3c7",
      "--it-accent-wash":"#fffbeb",
      "--it-accent-bright":"#fde047",
      "--it-bg-soft":"#fde68a",
      "--it-bg-mid":"#fbbf24",
      "--it-bg-deep":"#f59e0b",
      "--it-bg-end":"#b45309",
      "--it-ink":"#422006",
      "--it-ink-rgb":"66,32,6",
    },
  },
];

export function normalizeUserColorScheme(value: unknown): UserColorScheme {
  const candidate = String(value ?? "").toLowerCase();
  return USER_COLOR_SCHEMES.some(theme => theme.id === candidate)
    ? candidate as UserColorScheme
    : DEFAULT_USER_COLOR_SCHEME;
}

export function applyUserColorScheme(value: unknown): UserColorScheme {
  const id = normalizeUserColorScheme(value);
  const theme = USER_COLOR_SCHEMES.find(item => item.id === id) ?? USER_COLOR_SCHEMES[0];
  const root = document.documentElement;
  root.dataset.itColorScheme = id;
  Object.entries(theme.variables).forEach(([property, propertyValue]) => {
    root.style.setProperty(property, propertyValue);
  });
  return id;
}
