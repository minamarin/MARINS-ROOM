"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatMessage, WsMessage } from "@marins-room/shared";

import { clientApi, wsUrl } from "@/lib/api";

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await clientApi.startChatSession({});

      if (response.success && response.data) {
        setSessionId(response.data.sessionId);
        return response.data.sessionId;
      } else {
        setError(response.error?.message || "Failed to start chat session");
        return null;
      }
    } catch {
      setError("Failed to connect. Please try again.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectWebSocket = useCallback(
    (sid: string) => {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(
          JSON.stringify({
            type: "JOIN_SESSION",
            payload: { sessionId: sid },
          })
        );
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as WsMessage;

        switch (message.type) {
          case "SESSION_JOINED": {
            const { messages: history } = message.payload as {
              messages: ChatMessage[];
            };
            setMessages(history);
            break;
          }
          case "MESSAGE_RECEIVED":
          case "AI_RESPONSE": {
            const { message: newMsg } = message.payload as {
              message: ChatMessage;
            };
            setMessages((prev) => [...prev, newMsg]);
            setIsTyping(false);
            break;
          }
          case "TYPING_START":
            setIsTyping(true);
            break;
          case "TYPING_STOP":
            setIsTyping(false);
            break;
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
        setError("Connection error. Please refresh and try again.");
        setIsConnected(false);
      };

      wsRef.current = ws;
    },
    []
  );

  const handleStartChat = async () => {
    const sid = await startSession();
    if (sid) {
      connectWebSocket(sid);
    }
  };

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

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  if (!sessionId) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-xl mx-auto text-center">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Chat with Marin
          </h1>

          <p className="text-gray-600 mb-8">
            Have a question or just want to chat? Start a conversation with my AI
            assistant. I&apos;ll get back to you if needed!
          </p>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="p-4 bg-red-50 text-red-700 rounded-lg text-sm mb-6"
            >
              {error}
            </div>
          )}

          <button
            onClick={handleStartChat}
            disabled={isLoading}
            className="px-8 py-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Starting..." : "Start Chat"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold">M</span>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">
                  Chat with Marin
                </h2>
                <p className="text-xs text-gray-500">
                  {isConnected ? (
                    <span className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 bg-green-500 rounded-full"
                        aria-hidden="true"
                      />
                      <span aria-live="polite">Online</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 bg-gray-400 rounded-full"
                        aria-hidden="true"
                      />
                      <span aria-live="polite">Connecting...</span>
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            className="h-[400px] overflow-y-auto p-6 space-y-4"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "USER" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    message.role === "USER"
                      ? "bg-primary-600 text-white rounded-br-md"
                      : "bg-gray-100 text-gray-800 rounded-bl-md"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSendMessage}
            className="px-6 py-4 border-t border-gray-100"
          >
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                disabled={!isConnected}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || !isConnected}
                className="px-6 py-3 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm"
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
