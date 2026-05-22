import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Providers } from "./providers";
import { AppNav } from "@/components/AppNav";
import { FloatingCartBar } from "@/components/cart/FloatingCartBar";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { InteractiveBackground } from "@/components/InteractiveBackground";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Menu MC",
  description: "Menu website"
};

// Blocking script: runs before first paint so the dark class is on <html> before
// SSR HTML is rendered, preventing the brief white flash on logout / hard reload.
const THEME_INIT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t !== 'light' && t !== 'dark') {
      t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    var root = document.documentElement;
    var c = root.classList;
    if (t === 'dark') { c.add('dark'); root.style.colorScheme = 'dark'; }
    else { c.remove('dark'); root.style.colorScheme = 'light'; }
  } catch (_) {}
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Browser UA chrome (scrollbars, form controls) follows this until the
            inline script below upgrades it to the user's chosen theme. */}
        <meta name="color-scheme" content="light dark" />
        {/* Parser-blocking inline script: sets theme class before the body paints. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <Providers session={session}>
          <InteractiveBackground />
          <div className="mx-auto max-w-5xl px-4 py-8">
            <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ThemeSwitch />
                <Link href="/" className="menu-title text-sm font-semibold tracking-[0.25em] text-accent">
                  MENU MC
                </Link>
              </div>
              <AppNav />
            </header>
            {children}
            <FloatingCartBar />
            <ChatWidget />
            <footer className="mt-10 border-t border-black/10 pt-6 text-xs text-black/60">
              Built with Next.js + Prisma + Auth
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}

