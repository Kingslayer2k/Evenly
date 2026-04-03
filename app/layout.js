import "./globals.css";
import BottomNav from "../components/BottomNav";
import ThemeProvider from "../components/ThemeProvider";
import PwaRegistrar from "../components/PwaRegistrar";

export const metadata = {
  title: "Evenly",
  description: "Split costs with roommates and friends.",
  applicationName: "Evenly",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Evenly",
  },
};

export const viewport = {
  themeColor: "#0f1412",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {supabaseHost ? (
          <>
            <link rel="preconnect" href={`https://${supabaseHost}`} />
            <link rel="dns-prefetch" href={`https://${supabaseHost}`} />
          </>
        ) : null}
      </head>
      <body
        className="min-h-screen antialiased"
        style={{
          fontFamily: "Styrene A, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
          fontWeight: 500,
        }}
      >
        <ThemeProvider />
        <PwaRegistrar />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
