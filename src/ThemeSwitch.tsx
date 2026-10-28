import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemePreference } from "./useTheme";

const options = [
  {
    value: "light",
    label: "Светлая",
    accessibleLabel: "Светлая тема",
    Icon: Sun,
  },
  {
    value: "dark",
    label: "Тёмная",
    accessibleLabel: "Тёмная тема",
    Icon: Moon,
  },
  {
    value: "system",
    label: "Авто",
    accessibleLabel: "Тема как на устройстве",
    Icon: Monitor,
  },
] as const;

export default function ThemeSwitch({
  preference,
  onChange,
}: {
  preference: ThemePreference;
  onChange: (value: ThemePreference) => void;
}) {
  const ActiveIcon = options.find(
    (option) => option.value === preference,
  )!.Icon;
  return (
    <>
      <div
        className="desktop-theme-switch"
        role="group"
        aria-label="Тема оформления сайта"
      >
        {options.map(({ value, label, accessibleLabel, Icon }) => (
          <button
            key={value}
            type="button"
            aria-label={accessibleLabel}
            title={accessibleLabel}
            aria-pressed={preference === value}
            onClick={() => onChange(value)}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <label
        className="theme-control mobile-theme-control"
        title="Тема оформления"
      >
        <ActiveIcon size={18} />
        <select
          aria-label="Тема оформления"
          value={preference}
          onChange={(event) => onChange(event.target.value as ThemePreference)}
        >
          <option value="system">Авто</option>
          <option value="light">Светлая</option>
          <option value="dark">Тёмная</option>
        </select>
      </label>
    </>
  );
}
