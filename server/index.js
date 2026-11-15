import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";

const USERS = ["Alan", "Bob", "Carol", "Dean", "Elin"];
const MAX_MESSAGE_LENGTH = 1000;
const messages = [];
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(serverDirectory, "..");
const distributionDirectory = path.join(projectDirectory, "dist");

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});
app.use(express.static(distributionDirectory));
app.get("*", (_request, response) => {
  response.sendFile(path.join(distributionDirectory, "index.html"));
});

io.on("connection", (socket) => {
  socket.emit("chat:history", messages);

  socket.on("chat:send", (payload, acknowledge) => {
    const text =
      payload && typeof payload.text === "string" ? payload.text.trim() : "";

    if (!text) {
      acknowledge?.({ ok: false, error: "Message cannot be empty." });
      return;
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      acknowledge?.({
        ok: false,
        error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
      });
      return;
    }

    const message = {
      id: randomUUID(),
      author: USERS[Math.floor(Math.random() * USERS.length)],
      text,
      createdAt: new Date().toISOString(),
      likes: 0,
    };

    messages.push(message);
    io.emit("chat:message", message);
    acknowledge?.({ ok: true, id: message.id });
  });

  socket.on("chat:like", (messageId, acknowledge) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message) {
      acknowledge?.({ ok: false, error: "Message was not found." });
      return;
    }

    message.likes += 1;
    io.emit("chat:message-updated", {
      id: message.id,
      likes: message.likes,
    });
    acknowledge?.({ ok: true, likes: message.likes });
  });
});

const port = Number(process.env.PORT) || 3001;
httpServer.listen(port, () => {
  console.log(`Chat server listening on http://localhost:${port}`);
});
