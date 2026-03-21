import "./globals.css";
import BottomNav from "../components/BottomNav";

export const metadata = {
  title: "Evenly",
  description: "Split costs with roommates and friends.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className="bg-[#F7F7F5] text-[#1C1917] antialiased"
        style={{
          fontFamily: "Styrene A, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
          fontWeight: 500,
        }}
      >
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
