import { useTheme } from "@/context/ThemeContext";

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1.5 py-1">
      <label className="flex items-center gap-1.5 cursor-pointer px-2 py-0.5 rounded-md transition-colors select-none">
        <input
          type="radio"
          name="theme"
          value="dark"
          checked={theme === "dark"}
          onChange={() => setTheme("dark")}
          className="sr-only"
        />
        <span className={`text-xs font-medium transition-colors ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`}>
          🌙 Dark
        </span>
      </label>
      <div className="w-px h-4 bg-border" />
      <label className="flex items-center gap-1.5 cursor-pointer px-2 py-0.5 rounded-md transition-colors select-none">
        <input
          type="radio"
          name="theme"
          value="light"
          checked={theme === "light"}
          onChange={() => setTheme("light")}
          className="sr-only"
        />
        <span className={`text-xs font-medium transition-colors ${theme === "light" ? "text-primary" : "text-muted-foreground"}`}>
          ☀️ Light
        </span>
      </label>
    </div>
  );
};

export default ThemeToggle;
