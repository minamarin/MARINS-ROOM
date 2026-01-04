import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <p className="text-gray-600 text-sm">
              &copy; {new Date().getFullYear()} Marin&apos;s Room. All rights reserved.
            </p>
          </div>

          <div className="flex gap-6">
            <Link
              href="/blog"
              className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/videos"
              className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
            >
              Videos
            </Link>
            <Link
              href="/donate"
              className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
            >
              Support
            </Link>
            <Link
              href="/chat"
              className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
