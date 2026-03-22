import "./globals.css";
import BottomNav from "../components/BottomNav";
import ThemeProvider from "../components/ThemeProvider";

export const metadata = {
  title: "Evenly",
  description: "Split costs with roommates and friends.",
  icons: {
    icon: "/app-icon.svg",
    shortcut: "/app-icon.svg",
    apple: "/app-icon.svg",
  },
};

export const viewport = {
  themeColor: "#3A4E43",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen antialiased transition-colors duration-300"
        style={{
          fontFamily: "Styrene A, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
          fontWeight: 500,
        }}
      >
        <ThemeProvider />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
