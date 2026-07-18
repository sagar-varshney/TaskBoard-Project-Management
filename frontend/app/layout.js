import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  title: "TaskBoard",
  description: "Project planning, ticket tracking, sprint management, and AI-assisted task insights."
};

export default function RootLayout({ children }) {
  const themeScript = `
    (function () {
      try {
        var savedTheme = localStorage.getItem("taskboardTheme");
        var theme = savedTheme === "dark" || savedTheme === "light"
          ? savedTheme
          : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
      } catch (error) {
        document.documentElement.dataset.theme = "light";
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
