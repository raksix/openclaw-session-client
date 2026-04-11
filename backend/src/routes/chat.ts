import { Elysia } from "elysia";
import { exec } from "child_process";

interface ChatResponse {
  success: boolean;
  text?: string;
  sessionId?: string;
  error?: string;
}

export const chatRoutes = new Elysia()
  .post("/api/chat", async ({ body }: any): Promise<ChatResponse> => {
    const message = body?.message;
    const sessionId = body?.sessionId;
    const agentId = body?.agentId || "main";

    if (!message || typeof message !== "string") {
      return { success: false, error: "Message is required" };
    }

    console.log(`[Chat] Message: ${message.substring(0, 100)}...`);
    console.log(`[Chat] Session ID: ${sessionId || "new"}`);
    console.log(`[Chat] Agent: ${agentId}`);

    return new Promise((resolve) => {
      const sessionArg = sessionId ? `--session-id ${sessionId}` : "";
      const safeMessage = message.replace(/"/g, '\\"');
      const cmd = `openclaw agent --agent ${agentId} --message "${safeMessage}" --json ${sessionArg}`.trim();

      console.log(`[Chat] Running: ${cmd}`);

      exec(cmd, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        console.log(`[Chat] openclaw finished, error: ${error?.message || "none"}`);

        if (error) {
          console.error(`[Chat] exec error:`, error.message);
          resolve({ success: false, error: `Agent failed: ${error.message}` });
          return;
        }

        try {
          // Parse JSON output - find JSON object in stdout
          const jsonMatch = stdout.match(/\{[\s\S]*"status"[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            
            // Extract text from payloads
            const text = result.result?.payloads?.[0]?.text || 
                         result.result?.text ||
                         "No response";
            
            const usedSessionId = result.result?.meta?.agentMeta?.sessionId || 
                                  result.result?.sessionId || 
                                  sessionId;

            resolve({
              success: true,
              text,
              sessionId: usedSessionId
            });
          } else {
            console.error(`[Chat] No JSON found in stdout: ${stdout.substring(0, 200)}`);
            resolve({ success: false, error: "Invalid response format" });
          }
        } catch (e) {
          console.error(`[Chat] Parse error:`, e);
          resolve({ success: false, error: `Parse error: ${e}` });
        }
      });
    });
  });
