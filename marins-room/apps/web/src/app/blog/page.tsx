import Link from "next/link";

import { getBlogPosts } from "@/lib/blog";

export const metadata = {
  title: "Blog",
  description: "Thoughts, tutorials, and stories from Marin",
};

export default function BlogPage() {
  const posts = getBlogPosts();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Blog</h1>
        <p className="text-gray-600 mb-12">
          Thoughts, tutorials, and stories about tech and life.
        </p>

        {posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">No posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="border-b border-gray-100 pb-8 last:border-0"
              >
                <Link href={`/blog/${post.slug}`} className="group">
                  <h2 className="text-2xl font-semibold text-gray-900 group-hover:text-primary-600 transition-colors mb-2">
                    {post.title}
                  </h2>
                </Link>
                <p className="text-gray-600 mb-3">{post.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <time dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                  {post.tags.length > 0 && (
                    <div className="flex gap-2">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-100 rounded-full text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
