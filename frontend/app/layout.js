import "./globals.css";

export const metadata = {
  title: "TaskBoard Auth",
  description: "Login and register screens for TaskBoard"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
