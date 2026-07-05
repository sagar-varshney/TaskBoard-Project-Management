import "./globals.css";

export const metadata = {
  title: "TaskBoard Auth",
  description: "Login and register screens for TaskBoard"
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
      </body>
    </html>
  );
}
