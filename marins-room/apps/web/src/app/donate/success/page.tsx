import Link from "next/link";

export const metadata = {
  title: "Thank You!",
  description: "Thank you for your donation",
};

export default function DonateSuccessPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-xl mx-auto text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Thank You!
        </h1>

        <p className="text-gray-600 mb-8">
          Your donation has been received. I truly appreciate your support - it means
          the world to me and helps keep this site running.
        </p>

        <div className="flex justify-center gap-4">
          <Link
            href="/"
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/blog"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Read the Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
