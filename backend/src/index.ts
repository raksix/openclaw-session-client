import { createApp } from "./app";
import { connectToDatabase, closeDatabase } from "./db/mongodb";

const PORT = parseInt(process.env.PORT || "4000");
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    console.log("Database connected successfully");
    
    // Create and start the app
    const app = createApp();
    
    const server = app.listen(PORT);
    
    console.log(`🚀 OpenClaw Session Manager Backend running at http://${HOST}:${PORT}`);
    console.log(`📚 API Documentation available at http://${HOST}:${PORT}/swagger`);
    
    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      
      server.stop();
      await closeDatabase();
      
      console.log("Server closed");
      process.exit(0);
    };
    
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
