import "./globals.css";
import BottomNav from "../components/BottomNav";
import ThemeProvider from "../components/ThemeProvider";

export const metadata = {
  title: "Evenly",
  description: "Split costs with roommates and friends.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased transition-colors duration-300"
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
