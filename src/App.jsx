import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const USERS = ["Alan", "Bob", "Carol", "Dean", "Elin"];
const EMOJIS = [
  { value: "😀", label: "grinning face" },
  { value: "😂", label: "face with tears of joy" },
  { value: "😊", label: "smiling face" },
  { value: "😍", label: "heart eyes" },
  { value: "👍", label: "thumbs up" },
  { value: "🎉", label: "party popper" },
  { value: "❤️", label: "red heart" },
  { value: "🚀", label: "rocket" },
];

const USER_COLORS = {
  Alan: "blue",
  Bob: "orange",
  Carol: "pink",
  Dean: "green",
  Elin: "purple",
};

function Avatar({ name, small = false }) {
  return (
    <span
      className={`avatar avatar--${USER_COLORS[name]}${small ? " avatar--small" : ""}`}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  );
}

function LikeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="like-icon"
    >
      <path
        d="M7.25 8.25 9.5 3.5c.3-.64 1.1-.92 1.75-.6.48.24.75.76.66 1.29L11.5 7h3.25a1.75 1.75 0 0 1 1.7 2.17l-1.08 4.5a1.75 1.75 0 0 1-1.7 1.33H7.25m0-6.75v6.75m0-6.75H5.5c-.83 0-1.5.67-1.5 1.5v3.75c0 .83.67 1.5 1.5 1.5h1.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function renderMessageText(text) {
  return text
    .split(/(@(?:Alan|Bob|Carol|Dean|Elin)\b)/g)
    .map((part, index) =>
      part.startsWith("@") ? (
        <span className="message__mention" key={index}>
          {part}
        </span>
      ) : (
        part
      ),
    );
}

function Message({ message, onLike }) {
  const formattedTime = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(message.createdAt));

  return (
    <article className="message">
      <Avatar name={message.author} />
      <div className="message__main">
        <div className="message__content">
          <div className="message__meta">
            <span className="message__author">{message.author}</span>
            <time dateTime={message.createdAt}>{formattedTime}</time>
          </div>
          <p className="message__text">{renderMessageText(message.text)}</p>
        </div>
        <button
          className="like-button"
          type="button"
          onClick={() => onLike(message.id)}
          aria-label={`Like message from ${message.author}. ${message.likes} likes`}
        >
          <LikeIcon />
          <span>{message.likes}</span>
        </button>
      </div>
    </article>
  );
}

function App() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [chatConnected, setChatConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const messageListRef = useRef(null);
  const messageInputRef = useRef(null);
  const socketRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      setChatConnected(true);
      setSendError("");
    });
    socket.on("disconnect", () => {
      setChatConnected(false);
    });
    socket.on("connect_error", (error) => {
      console.error("Could not connect to the chat server:", error);
      setChatConnected(false);
      setSendError("Chat server unavailable. Start the app with npm run dev.");
    });
    socket.on("chat:history", (history) => {
      setMessages(Array.isArray(history) ? history : []);
    });
    socket.on("chat:message", (message) => {
      setMessages((currentMessages) =>
        currentMessages.some((current) => current.id === message.id)
          ? currentMessages
          : [...currentMessages, message],
      );
      requestAnimationFrame(() => {
        messageListRef.current?.scrollTo({
          top: messageListRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    });
    socket.on("chat:message-updated", (update) => {
      if (!update || typeof update.id !== "string") {
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === update.id
            ? { ...message, likes: update.likes }
            : message,
        ),
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();

    if (!text || isSending) {
      return;
    }

    const socket = socketRef.current;
    if (!socket?.connected) {
      setSendError("Chat server unavailable. Please reconnect before sending.");
      return;
    }

    setIsSending(true);
    setSendError("");
    socket.timeout(5000).emit("chat:send", { text }, (error, response) => {
      setIsSending(false);
      if (error) {
        setSendError("Message could not be sent. Please try again.");
        return;
      }
      if (!response || !response.ok) {
        setSendError(response?.error || "Message could not be sent.");
        return;
      }

      setDraft("");
      setAnnouncement("Message sent.");
    });
  }

  function likeMessage(messageId) {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setSendError("Chat server unavailable. Please reconnect before liking.");
      return;
    }

    socket.timeout(5000).emit("chat:like", messageId, (error, response) => {
      if (error || !response || !response.ok) {
        setSendError(response?.error || "Like could not be saved.");
      } else {
        setSendError("");
      }
    });
  }

  function insertTextAtCursor(text, replaceMention = false) {
    const input = messageInputRef.current;
    const selectionStart = Math.min(selectionRef.current.start, draft.length);
    const selectionEnd = Math.min(selectionRef.current.end, draft.length);
    let before = draft.slice(0, selectionStart);
    const after = draft.slice(selectionEnd);

    if (replaceMention) {
      const mentionMatch = before.match(/(^|\s)@[A-Za-z]*$/);
      if (mentionMatch) {
        const mentionStart =
          before.length - mentionMatch[0].length + mentionMatch[1].length;
        before = before.slice(0, mentionStart);
      }
    }

    const nextDraft = `${before}${text}${after}`;
    const caretPosition = before.length + text.length;
    setDraft(nextDraft);
    setEmojiPickerOpen(false);
    setMentionPickerOpen(false);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(caretPosition, caretPosition);
      selectionRef.current = { start: caretPosition, end: caretPosition };
    });
  }

  function addMention(name) {
    insertTextAtCursor(`@${name} `, true);
  }

  function handleComposerChange(event) {
    const { value, selectionStart, selectionEnd } = event.target;
    selectionRef.current = { start: selectionStart, end: selectionEnd };
    setDraft(value);
    const textBeforeCursor = value.slice(0, selectionStart);
    setMentionPickerOpen(/(^|\s)@[A-Za-z]*$/.test(textBeforeCursor));
  }

  function rememberSelection(event) {
    selectionRef.current = {
      start: event.currentTarget.selectionStart,
      end: event.currentTarget.selectionEnd,
    };
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Escape") {
      setEmojiPickerOpen(false);
      setMentionPickerOpen(false);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (mentionPickerOpen) {
        return;
      }
      event.currentTarget.form?.requestSubmit();
    }
  }

  const mentionQuery = draft.match(/(^|\s)@([A-Za-z]*)$/);
  const mentionOptions = USERS.filter((user) =>
    mentionQuery
      ? user.toLowerCase().startsWith(mentionQuery[2].toLowerCase())
      : true,
  );

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Exactspace home">
          <span className="brand__mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>exactspace</span>
        </a>
        <div className="topbar__right">
          <span className="workspace-label">WORKSPACE</span>
          <Avatar name="Dean" small />
        </div>
      </header>

      <section className="chat-card" aria-label="Team chat">
        <header className="chat-header">
          <div className="chat-header__icon" aria-hidden="true">
            #
          </div>
          <div className="chat-header__copy">
            <h1>team-chat</h1>
            <p>A place for the whole team to connect</p>
          </div>
          <div className="online-indicator">
            <span
              className={`online-indicator__dot${chatConnected ? "" : " online-indicator__dot--offline"}`}
            />
            <span>{chatConnected ? "Live · 5 members" : "Connecting…"}</span>
          </div>
        </header>

        <div className="messages" ref={messageListRef} aria-live="polite">
          {messages.length > 0 ? (
            <>
              <div className="day-divider">
                <span />
                <time>Today</time>
                <span />
              </div>
              {messages.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  onLike={likeMessage}
                />
              ))}
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-state__icon" aria-hidden="true">
                #
              </span>
              <strong>Start the conversation</strong>
              <p>Send the first message to your team.</p>
            </div>
          )}
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <label className="sr-only" htmlFor="message-input">
            Write a message
          </label>
          <textarea
            id="message-input"
            ref={messageInputRef}
            className="composer__input"
            value={draft}
            onChange={handleComposerChange}
            onKeyDown={handleComposerKeyDown}
            onKeyUp={rememberSelection}
            onClick={rememberSelection}
            onSelect={rememberSelection}
            placeholder="Message #team-chat"
            rows={2}
            maxLength={1000}
          />
          <div className="composer__footer">
            <div className="composer__left">
              <div className="composer__actions">
                <div className="picker-anchor">
                  <button
                    className="composer-tool"
                    type="button"
                    aria-label="Add emoji"
                    aria-expanded={emojiPickerOpen}
                    onClick={() => {
                      setEmojiPickerOpen((open) => !open);
                      setMentionPickerOpen(false);
                    }}
                  >
                    <span aria-hidden="true">😊</span>
                  </button>
                  {emojiPickerOpen && (
                    <div className="picker emoji-picker" aria-label="Choose an emoji">
                      {EMOJIS.map(({ value, label }) => (
                        <button
                          key={value}
                          className="emoji-option"
                          type="button"
                          aria-label={`Insert ${label}`}
                          onClick={() => insertTextAtCursor(value)}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="picker-anchor">
                  <button
                    className="composer-tool composer-tool--mention"
                    type="button"
                    aria-label="Mention a user"
                    aria-expanded={mentionPickerOpen}
                    onClick={() => {
                      setMentionPickerOpen((open) => !open);
                      setEmojiPickerOpen(false);
                    }}
                  >
                    @
                  </button>
                  {mentionPickerOpen && (
                    <div
                      className="picker mention-picker"
                      aria-label="Choose a user to mention"
                    >
                      <span className="picker__title">Mention someone</span>
                      {mentionOptions.map((user) => (
                        <button
                          key={user}
                          className="mention-option"
                          type="button"
                          onClick={() => addMention(user)}
                        >
                          <Avatar name={user} small />
                          <span>{user}</span>
                        </button>
                      ))}
                      {mentionOptions.length === 0 && (
                        <span className="mention-empty">No matching users</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <span className="composer__hint">
                <kbd>Enter</kbd> to send <span aria-hidden="true">·</span>{" "}
                <kbd>Shift + Enter</kbd> for a new line
              </span>
            </div>
            <button
              className="send-button"
              type="submit"
              disabled={!draft.trim() || !chatConnected || isSending}
            >
              <span>{isSending ? "Sending…" : "Send message"}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="send-button__icon"
              >
                <path
                  d="M3.5 10h13m0 0-5-5m5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {sendError && (
            <p className="composer__error" role="alert">
              {sendError}
            </p>
          )}
        </form>
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
      </section>
      <footer className="page-footer">
        <span>Good conversations make great things happen.</span>
        <span>TEAM CHAT</span>
      </footer>
    </main>
  );
}

export default App;
