export const SETTINGS_SECTIONS = [
  { to: "/settings/profile", label: "Profile", hint: "Name, email and timezone" },
  { to: "/settings/reflection", label: "Reflection preferences", hint: "How your companion responds" },
  { to: "/settings/voice", label: "Voice", hint: "Voice reflections and playback" },
  { to: "/settings/memory", label: "Memory", hint: "What Reflective remembers" },
  { to: "/settings/privacy", label: "Privacy & Data", hint: "Export or delete your data" },
  { to: "/settings/notifications", label: "Notifications", hint: "Reminder preferences" },
  { to: "/settings/appearance", label: "Appearance", hint: "Light, dark or system" },
  { to: "/settings/account", label: "Account", hint: "Password, sign out, delete account" },
] as const;
