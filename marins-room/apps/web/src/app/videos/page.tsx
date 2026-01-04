import Link from "next/link";

import { serverApi } from "@/lib/api";

export const metadata = {
  title: "Videos",
  description: "Watch videos from Marin",
};

export const revalidate = 60; // Revalidate every minute

export default async function VideosPage() {
  const response = await serverApi.listVideos(1, 20);

  const videos = response.success && response.data ? response.data.items : [];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Videos</h1>
        <p className="text-gray-600 mb-12">
          Watch tutorials, vlogs, and creative content.
        </p>

        {videos.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-gray-500">No videos yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Link
                key={video.id}
                href={`/videos/${video.id}`}
                className="group block"
              >
                <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden mb-3">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg
                        className="w-12 h-12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <h2 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                  {video.title}
                </h2>
                {video.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {video.description}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(video.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
