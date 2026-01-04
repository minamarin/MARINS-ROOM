"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatMessage, ChatSession, WsMessage } from "@marins-room/shared";

import { wsUrl } from "@/lib/api";

export default function AdminSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectWebSocket = useCallback(() => {
    // Get admin key from prompt (in production, use proper auth)
    const adminKey = window.prompt("Enter admin API key:");
    if (!adminKey) {
      setError("Admin key required");
      return;
    }

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(
        JSON.stringify({
          type: "JOIN_SESSION",
          payload: {
            sessionId,
            isAdmin: true,
            adminKey,
          },
        })
      );
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as WsMessage;

      switch (message.type) {
        case "SESSION_JOINED": {
          const {
            session: sess,
            messages: history,
          } = message.payload as {
            session: ChatSession;
            messages: ChatMessage[];
          };
          setSession(sess);
          setMessages(history);
          break;
        }
        case "MESSAGE_RECEIVED":
        case "AI_RESPONSE": {
          const { message: newMsg } = message.payload as {
            message: ChatMessage;
          };
          setMessages((prev) => [...prev, newMsg]);
          break;
        }
        case "ERROR": {
          const { message: errMsg } = message.payload as { message: string };
          setError(errMsg);
          break;
        }
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setError("Connection error");
      setIsConnected(false);
    };

    wsRef.current = ws;
  }, [sessionId]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current || !isConnected) return;

    wsRef.current.send(
      JSON.stringify({
        type: "SEND_MESSAGE",
        payload: { content: input.trim() },
      })
    );

    setInput("");
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/admin"
          className="text-primary-600 hover:text-primary-700 text-sm mb-6 inline-flex items-center gap-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {session?.visitorName || "Anonymous"}&apos;s Chat
                </h1>
                <p className="text-sm text-gray-500">
                  Session: {sessionId.slice(0, 8)}...
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  isConnected
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "USER" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    message.role === "USER"
                      ? "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
                      : "bg-primary-600 text-white rounded-br-md"
                  }`}
                >
                  <div className="text-xs opacity-70 mb-1">
                    {message.role === "USER" ? "Visitor" : "Response"}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSendMessage}
            className="px-6 py-4 border-t border-gray-100 bg-white"
          >
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Reply as Marin..."
                disabled={!isConnected}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || !isConnected}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
