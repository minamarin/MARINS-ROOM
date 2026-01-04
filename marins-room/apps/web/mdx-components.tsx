import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="text-4xl font-bold mt-8 mb-4 text-gray-900">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-3xl font-semibold mt-6 mb-3 text-gray-800">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-2xl font-medium mt-4 mb-2 text-gray-800">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-gray-700 leading-relaxed mb-4">{children}</p>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-primary-600 hover:text-primary-800 underline"
        target={href?.startsWith("http") ? "_blank" : undefined}
        rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside mb-4 text-gray-700">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside mb-4 text-gray-700">{children}</ol>
    ),
    li: ({ children }) => <li className="mb-1">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary-500 pl-4 italic text-gray-600 my-4">
        {children}
      </blockquote>
    ),
    code: ({ children }) => (
      <code className="bg-gray-100 rounded px-1.5 py-0.5 text-sm font-mono text-primary-700">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto mb-4">
        {children}
      </pre>
    ),
    ...components,
  };
}
