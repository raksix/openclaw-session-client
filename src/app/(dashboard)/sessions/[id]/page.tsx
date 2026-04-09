"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Send,
  Globe,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  Bookmark,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { Message, LogEntry } from "@/types";

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const {
    sessions,
    activeSession,
    setActiveSession,
    messages,
    setMessages,
    addMessage,
    logs,
    setLogs,
    addLog,
    clearLogs,
  } = useSessionStore();

  const { logPanelOpen, toggleLogPanel, activeTab, setActiveTab } = useUIStore();
  const { user } = useAuthStore();

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [iframeUrl, setIframeUrl] = useState("");
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
  const [bookmarkTitle, setBookmarkTitle] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Find session from store or set from params
  useEffect(() => {
    const session = sessions.find((s) => s._id === sessionId);
    if (session) {
      setActiveSession(session);
    }
  }, [sessionId, sessions, setActiveSession]);

  // Fetch messages
  useEffect(() => {
    if (!sessionId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(sessionId, data);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      }
    };

    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/logs`);
        if (res.ok) {
          const data = await res.json();
          setLogs(sessionId, data);
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error);
      }
    };

    fetchMessages();
    fetchLogs();
  }, [sessionId, setMessages, setLogs]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages[sessionId]]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !sessionId) return;

    const userMessage: Message = {
      _id: `temp-${Date.now()}`,
      sessionId,
      userId: user?._id || "",
      role: "user",
      content: inputValue,
      attachments: [],
      createdAt: new Date(),
    };

    addMessage(sessionId, userMessage);
    setInputValue("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputValue }),
      });

      if (res.ok) {
        const assistantMessage = await res.json();
        addMessage(sessionId, assistantMessage);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveBookmark = async () => {
    if (!iframeUrl.trim() || !sessionId) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: iframeUrl,
          title: bookmarkTitle || iframeUrl,
        }),
      });

      if (res.ok) {
        setBookmarkDialogOpen(false);
        setBookmarkTitle("");
      }
    } catch (error) {
      console.error("Failed to save bookmark:", error);
    }
  };

  const sessionMessages = messages[sessionId] || [];
  const sessionLogs = logs[sessionId] || [];

  if (!activeSession) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <p className="text-muted-foreground">Session not found</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Session Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/sessions")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="font-semibold">{activeSession.name}</h2>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  activeSession.status === "online" && "bg-green-500",
                  activeSession.status === "idle" && "bg-yellow-500",
                  activeSession.status === "offline" && "bg-gray-500",
                  activeSession.status === "error" && "bg-red-500"
                )}
              />
              <span className="text-xs text-muted-foreground capitalize">
                {activeSession.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "chat" | "iframe")}>
            <TabsList>
              <TabsTrigger value="chat" className="gap-1">
                <FileText className="h-3.5 w-3.5" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="iframe" className="gap-1">
                <Globe className="h-3.5 w-3.5" />
                Web View
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLogPanel}
            className={cn(logPanelOpen && "bg-accent")}
          >
            <FileText className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat / iframe Area */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} className="flex-1 flex flex-col">
            <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0">
              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4" ref={chatContainerRef}>
                <div className="space-y-4 max-w-4xl mx-auto">
                  {sessionMessages.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">
                        No messages yet. Start a conversation!
                      </p>
                    </div>
                  ) : (
                    sessionMessages.map((message) => (
                      <div
                        key={message._id}
                        className={cn(
                          "flex",
                          message.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-4 py-2",
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">
                            {message.content}
                          </p>
                          <span
                            className={cn(
                              "text-xs mt-1 block",
                              message.role === "user"
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatRelativeTime(message.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" />
                          <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0.1s]" />
                          <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0.2s]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 border-t bg-card">
                <div className="flex gap-2 max-w-4xl mx-auto">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    disabled={activeSession.status === "offline"}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isLoading}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="iframe" className="flex-1 flex flex-col m-0 p-0">
              {/* URL Bar */}
              <div className="flex items-center gap-2 p-2 border-b bg-card">
                <Input
                  value={iframeUrl}
                  onChange={(e) => setIframeUrl(e.target.value)}
                  placeholder="Enter URL..."
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => iframeUrl && window.open(iframeUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setBookmarkDialogOpen(true);
                    setBookmarkTitle(iframeUrl);
                  }}
                  disabled={!iframeUrl}
                >
                  <Bookmark className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {/* iframe Content */}
              <div className="flex-1 bg-white">
                {iframeUrl ? (
                  <iframe
                    src={iframeUrl}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Enter a URL to browse
                  </div>
                )}
              </div>

              {/* Bookmarks Dropdown */}
              {activeSession.bookmarks?.length > 0 && (
                <div className="p-2 border-t bg-card">
                  <Select
                    onValueChange={(v) => setIframeUrl(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Bookmarks" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSession.bookmarks.map((bm) => (
                        <SelectItem key={bm._id} value={bm.url}>
                          {bm.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Log Panel (Right Sidebar) */}
        {logPanelOpen && (
          <div className="w-80 border-l bg-card flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="font-semibold text-sm">Logs</h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => clearLogs(sessionId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={toggleLogPanel}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sessionLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No logs yet
                  </p>
                ) : (
                  sessionLogs.map((log) => (
                    <div
                      key={log._id}
                      className="p-2 rounded bg-background/50 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={
                            log.level === "error"
                              ? "error"
                              : log.level === "warn"
                              ? "warning"
                              : "secondary"
                          }
                          className="text-[10px] px-1"
                        >
                          {log.source}
                        </Badge>
                        <Badge
                          variant={
                            log.level === "error"
                              ? "error"
                              : log.level === "warn"
                              ? "warning"
                              : log.level === "info"
                              ? "default"
                              : "secondary"
                          }
                          className="text-[10px] px-1"
                        >
                          {log.level}
                        </Badge>
                        <span className="text-muted-foreground">
                          {formatRelativeTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-foreground/80 break-all">{log.message}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
