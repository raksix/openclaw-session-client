"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4002";

interface StreamMessage {
  type: "status" | "chunk" | "complete" | "error" | "pong";
  content?: string;
  sessionId?: string;
  error?: string;
  raw?: any;
}

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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          setMessages(sessionId, data.messages || []);
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
          setLogs(sessionId, data.logs || []);
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error);
      }
    };

    fetchMessages();
    fetchLogs();
  }, [sessionId, setMessages, setLogs]);

  // WebSocket connection for streaming
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected to stream server");
    };

    ws.onmessage = (event) => {
      try {
        const msg: StreamMessage = JSON.parse(event.data);
        console.log("[WS] Message:", msg.type, msg.content?.substring(0, 50));

        if (msg.type === "status") {
          // Agent is starting
          addLog(sessionId, {
            _id: `log-${Date.now()}`,
            sessionId,
            level: "info",
            message: "Agent başlatıldı...",
            timestamp: new Date(),
          });
        } else if (msg.type === "chunk") {
          // Streaming chunk received - could update UI in real-time
        } else if (msg.type === "complete") {
          // Final response received
          const assistantMessage: Message = {
            _id: `msg-${Date.now()}`,
            sessionId,
            userId: "assistant",
            role: "assistant",
            content: msg.content || "Yanıt alındı",
            attachments: [],
            createdAt: new Date(),
          };
          addMessage(sessionId, assistantMessage);
          setIsLoading(false);

          addLog(sessionId, {
            _id: `log-${Date.now()}`,
            sessionId,
            level: "info",
            message: `Yanıt tamamlandı (${msg.content?.length || 0} karakter)`,
            timestamp: new Date(),
          });
        } else if (msg.type === "error") {
          console.error("[WS] Error:", msg.error);
          const errorMessage: Message = {
            _id: `msg-${Date.now()}`,
            sessionId,
            userId: "assistant",
            role: "assistant",
            content: `Hata: ${msg.error}`,
            attachments: [],
            createdAt: new Date(),
          };
          addMessage(sessionId, errorMessage);
          setIsLoading(false);

          addLog(sessionId, {
            _id: `log-${Date.now()}`,
            sessionId,
            level: "error",
            message: msg.error || "Bilinmeyen hata",
            timestamp: new Date(),
          });
        }
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      wsRef.current = null;
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
    };
  }, [sessionId, addMessage, addLog]);

  // Connect WebSocket on mount
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

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

    // Send via WebSocket for streaming
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat",
        sessionId,
        message: inputValue,
        agentId: "main"
      }));

      addLog(sessionId, {
        _id: `log-${Date.now()}`,
        sessionId,
        level: "info",
        message: `Mesaj gönderildi: ${inputValue.substring(0, 50)}...`,
        timestamp: new Date(),
      });
    } else {
      console.error("[WS] WebSocket not connected");
      setIsLoading(false);
      
      const errorMessage: Message = {
        _id: `msg-${Date.now()}`,
        sessionId,
        userId: "assistant",
        role: "assistant",
        content: "Bağlantı hatası: WebSocket sunucusuna bağlanılamadı",
        attachments: [],
        createdAt: new Date(),
      };
      addMessage(sessionId, errorMessage);
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
        setIframeUrl("");
        setBookmarkTitle("");
        setBookmarkDialogOpen(false);
      }
    } catch (error) {
      console.error("Failed to save bookmark:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages/${messageId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMessages(
          sessionId,
          sessionMessages.filter((m) => m._id !== messageId)
        );
      }
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

  const handleClearChat = async () => {
    if (!sessionId || !confirm("Tüm sohbet temizlenecek. Emin misin?")) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}/clear`, {
        method: "POST",
      });

      if (res.ok) {
        setMessages(sessionId, []);
        clearLogs(sessionId);
      }
    } catch (error) {
      console.error("Failed to clear chat:", error);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionId || !confirm("Bu oturum silinecek. Emin misin?")) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/sessions");
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  // Get messages for this session
  const sessionMessages = messages[sessionId] || [];

  // Group messages by date
  const groupedMessages = sessionMessages.reduce((groups, message) => {
    const date = new Date(message.createdAt).toLocaleDateString("tr-TR");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionMessages]);

  if (!activeSession && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Oturum Yükleniyor...</h2>
          <p className="text-muted-foreground">Lütfen bekleyin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/sessions")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold">
              {activeSession?.name || "Yeni Oturum"}
            </h1>
            {activeSession?.description && (
              <p className="text-sm text-muted-foreground">
                {activeSession.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {activeSession?.model || "MiniMax-M2.7"}
          </Badge>
          <Button variant="outline" size="sm" onClick={toggleLogPanel}>
            {logPanelOpen ? (
              <ChevronUp className="h-4 w-4 mr-1" />
            ) : (
              <ChevronDown className="h-4 w-4 mr-1" />
            )}
            Loglar
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearChat}>
            <Trash2 className="h-4 w-4 mr-1" />
            Temizle
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeleteSession}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div
          ref={chatContainerRef}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col"
          >
            <TabsList className="border-b rounded-none bg-transparent h-12 px-4">
              <TabsTrigger value="chat">Sohbet</TabsTrigger>
              <TabsTrigger value="files">Dosyalar</TabsTrigger>
              <TabsTrigger value="bookmarks">Yer İşaretleri</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 flex flex-col m-0">
              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-4">
                {Object.entries(groupedMessages).map(([date, msgs]) => (
                  <div key={date}>
                    <div className="text-center text-xs text-muted-foreground py-2">
                      {date}
                    </div>
                    {msgs.map((message) => (
                      <div
                        key={message._id}
                        className={cn(
                          "flex mb-4",
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
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
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs opacity-70">
                              {formatRelativeTime(new Date(message.createdAt))}
                            </span>
                            {message.role === "user" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleDeleteMessage(message._id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ))}
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Mesajınızı yazın..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputValue.trim()}
                    size="icon"
                  >
                    {isLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files" className="flex-1 p-4">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Dosya listesi yakında eklenecek</p>
              </div>
            </TabsContent>

            <TabsContent value="bookmarks" className="flex-1 p-4">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={iframeUrl}
                    onChange={(e) => setIframeUrl(e.target.value)}
                    placeholder="URL girin"
                  />
                  <Button onClick={() => setBookmarkDialogOpen(true)}>
                    <Bookmark className="h-4 w-4 mr-1" />
                    Kaydet
                  </Button>
                </div>
                {activeSession?.bookmarks?.map((bookmark) => (
                  <div
                    key={bookmark._id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div>
                      <p className="font-medium">{bookmark.title}</p>
                      <a
                        href={bookmark.url}
                        target="_blank"
                        className="text-sm text-muted-foreground hover:underline"
                      >
                        {bookmark.url}
                      </a>
                    </div>
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Log Panel */}
        {logPanelOpen && (
          <>
            <Separator orientation="vertical" />
            <div className="w-80 flex flex-col border-l">
              <div className="p-2 border-b">
                <h3 className="font-semibold">Loglar</h3>
              </div>
              <ScrollArea className="flex-1 p-2">
                {logs.map((log) => (
                  <div
                    key={log._id}
                    className={cn(
                      "text-xs p-1 mb-1 rounded",
                      log.level === "error" && "bg-destructive/10 text-destructive",
                      log.level === "warning" && "bg-yellow-500/10 text-yellow-600",
                      log.level === "info" && "bg-primary/10"
                    )}
                  >
                    <span className="opacity-70">
                      {formatRelativeTime(new Date(log.timestamp))}
                    </span>{" "}
                    {log.message}
                  </div>
                ))}
              </ScrollArea>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
