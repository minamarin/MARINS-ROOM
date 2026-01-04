import Link from "next/link";
import { notFound } from "next/navigation";

import { serverApi } from "@/lib/api";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props) {
  const response = await serverApi.getVideo(params.id);

  if (!response.success || !response.data) {
    return { title: "Video Not Found" };
  }

  return {
    title: response.data.title,
    description: response.data.description,
  };
}

export default async function VideoPage({ params }: Props) {
  const response = await serverApi.getVideo(params.id);

  if (!response.success || !response.data) {
    notFound();
  }

  const video = response.data;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/videos"
          className="text-primary-600 hover:text-primary-700 text-sm mb-6 inline-flex items-center gap-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Videos
        </Link>

        <div className="aspect-video bg-black rounded-lg overflow-hidden mb-6">
          {video.playbackUrl ? (
            <video
              src={video.playbackUrl}
              controls
              className="w-full h-full"
              poster={video.thumbnailUrl || undefined}
              aria-label={video.title}
            >
              {/* Captions track - add VTT files when available */}
              {/* <track kind="captions" src="/captions/video.vtt" srcLang="en" label="English" /> */}
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              Video not available
            </div>
          )}
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">{video.title}</h1>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
          <time dateTime={video.createdAt.toString()}>
            {new Date(video.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          {video.durationSeconds && (
            <>
              <span>•</span>
              <span>
                {Math.floor(video.durationSeconds / 60)}:
                {(video.durationSeconds % 60).toString().padStart(2, "0")}
              </span>
            </>
          )}
        </div>

        {video.description && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Description</h2>
            <p className="text-gray-600 whitespace-pre-wrap">{video.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
