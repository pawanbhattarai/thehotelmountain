import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./replitAuth";
import { seedDefaultUsers } from "./seedUsers";
import { seedMeasuringUnits } from "./seedMeasuringUnits";
import { migrateExistingPasswords } from "./migratePasswords";

import { wsManager } from "./websocket";
import { AuditLogger } from "./auditLogger";

// rest of your code...

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Serve PWA assets and uploaded files statically with proper headers
app.use(
  "/uploads",
  express.static("uploads", {
    setHeaders: (res, path) => {
      // Add security headers for file downloads
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, max-age=3600"); // 1 hour cache

      // Set appropriate Content-Disposition for different file types
      if (path.endsWith(".pdf")) {
        res.setHeader("Content-Type", "application/pdf");
      } else if (path.match(/\.(jpg|jpeg|png|webp)$/i)) {
        res.setHeader("Content-Type", "image/*");
      }
    },
  }),
);

// Serve PWA static files (manifest, icons, sw.js) with proper MIME types
app.use(
  express.static("public", {
    setHeaders: (res, path) => {
      if (path.endsWith(".json")) {
        res.setHeader("Content-Type", "application/json");
      } else if (path.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
      } else if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
        res.setHeader("Content-Type", "image/jpeg");
      } else if (path.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript");
      }
      res.setHeader("Cache-Control", "public, max-age=86400"); // 24 hour cache for PWA assets
    },
  }),
);

// Serve root level PWA files (favicon-icon.png)
app.use(
  express.static(".", {
    setHeaders: (res, path) => {
      if (path.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
      }
      res.setHeader("Cache-Control", "public, max-age=86400");
    },
  }),
);

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Add iOS PWA test routes
  app.get("/ios-pwa-test.html", (req, res) => {
    res.sendFile("ios-pwa-test.html", { root: "./public" });
  });

  app.get("/ios-test.html", (req, res) => {
    res.sendFile("ios-test.html", { root: "./public" });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5001
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5001;

  // Import low stock checker
  const { lowStockChecker } = await import("./low-stock-checker");

  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      // Log system startup
      AuditLogger.logSystemEvent({
        action: "SYSTEM_STARTUP",
        entity: "system",
        details: {
          port: port,
          environment: process.env.NODE_ENV || "development",
          timestamp: new Date().toISOString(),
        },
        success: true,
      });
    },
  );

  // Initialize WebSocket server only in production to avoid Vite conflicts
  if (app.get("env") !== "development") {
    wsManager.init(server);
  } else {
    console.log(
      "WebSocket server disabled in development mode to avoid Vite conflicts",
    );
  }

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("Received SIGTERM, shutting down gracefully...");
    wsManager.close();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("Received SIGINT, shutting down gracefully...");
    wsManager.close();
    process.exit(0);
  });

  // Seed default users if none exist
  await seedDefaultUsers();

  // Migrate existing plain text passwords to bcrypt hashes
  await migrateExistingPasswords();

  // Initialize measuring units
  await seedMeasuringUnits();
})();
