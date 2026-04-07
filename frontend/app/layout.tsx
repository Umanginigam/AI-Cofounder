import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoFounder AI",
  description:
    "Your AI co-founder — a thinking partner that remembers everything and pushes back.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100">
        <AuthProvider>
          <div className="flex min-h-screen">
            <nav className="w-56 border-r border-gray-800 bg-gray-950 p-4 flex flex-col gap-1 fixed h-full">
              <h1 className="text-lg font-bold text-brand-400 mb-6 px-2">
                CoFounder AI
              </h1>
              <NavLink href="/">Dashboard</NavLink>
              <NavLink href="/session">Session</NavLink>
              <NavLink href="/call">Call</NavLink>
              <NavLink href="/decisions">Decisions</NavLink>
              <NavLink href="/commitments">Commitments</NavLink>
              <NavLink href="/assumptions">Assumptions</NavLink>
              <NavLink href="/history">Call History</NavLink>
              <div className="mt-auto">
                <NavLink href="/onboard">Onboard</NavLink>
              </div>
            </nav>
            <main className="ml-56 flex-1 p-8">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="block px-3 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
    >
      {children}
    </a>
  );
}
