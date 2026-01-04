"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/videos", label: "Videos" },
  { href: "/donate", label: "Donate" },
  { href: "/chat", label: "Chat" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <>
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <nav className="container mx-auto px-4 py-4" aria-label="Main navigation">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-primary-600">
              Marin&apos;s Room
            </Link>

            <ul className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className={`text-sm font-medium transition-colors ${
                      pathname === link.href
                        ? "text-primary-600"
                        : "text-gray-600 hover:text-primary-600"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Mobile menu button */}
            <button className="md:hidden p-2 text-gray-600" aria-label="Open menu">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </nav>
      </header>
    </>
  );
}
