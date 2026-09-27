import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { meta } from "@/components/page-states";
import { ChoiceGroup, Section, useSaveProfile } from "@/components/settings-ui";
import { applyTheme, currentTheme, type ThemePref } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/settings/appearance")({
  head: () => meta("Appearance", "Light, dark or match your device."),
  component: AppearanceSettings,
});

function AppearanceSettings() {
  const save = useSaveProfile("Appearance saved.");
  const [theme, setTheme] = useState<ThemePref>("system");
  useEffect(() => setTheme(currentTheme()), []);
  return (
    <Section title="Appearance" description="System follows your device's light or dark setting.">
      <ChoiceGroup
        label="Theme"
        value={theme}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        onChange={(t) => {
          setTheme(t);
          applyTheme(t);
          save.mutate({ theme: t });
        }}
      />
    </Section>
  );
}
