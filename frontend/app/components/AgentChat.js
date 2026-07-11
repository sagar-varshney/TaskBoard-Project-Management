"use client";

import { useState } from "react";
import { apiUrl } from "../config/api";

const starterMessages = [
  "Show all tickets",
  "List active tickets",
  "Create a task in DEMO titled Review checkout logs"
];

export default function AgentChat({ token, role, onChanged }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `I can read tickets, create basic tickets, update permitted work fields, and add comments. Your ${role} permissions still apply.`
    }
  ]);

  async function sendMessage(messageValue = input) {
    const message = messageValue.trim();
    if (!message || isSending) return;

    const nextMessages = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch(apiUrl("/agent/chat"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message,
          history: messages.slice(-8)
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Agent request failed");
      }

      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
      if (data.changed && onChanged) {
        await onChanged();
      }
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error.message }]);
    } finally {
      setIsSending(false);
    }
  }

  function submitMessage(event) {
    event.preventDefault();
    sendMessage();
  }

  return (
    <section className={`agent-chat ${isOpen ? "open" : ""}`} aria-label="TaskBoard agent">
      <button className="agent-toggle" type="button" onClick={() => setIsOpen((current) => !current)}>
        {isOpen ? "Close assistant" : "Ask assistant"}
      </button>

      {isOpen ? (
        <div className="agent-panel">
          <header>
            <div>
              <strong>TaskBoard Agent</strong>
              <span>LangGraph + Gemini</span>
            </div>
          </header>

          <div className="agent-messages">
            {messages.map((message, index) => (
              <p className={`agent-message ${message.role}`} key={`${message.role}-${index}`}>
                {message.content}
              </p>
            ))}
            {isSending ? <p className="agent-message assistant">Planning and running the request...</p> : null}
          </div>

          {messages.length === 1 ? (
            <div className="agent-suggestions">
              {starterMessages.map((message) => (
                <button type="button" key={message} onClick={() => sendMessage(message)}>
                  {message}
                </button>
              ))}
            </div>
          ) : null}

          <form className="agent-input" onSubmit={submitMessage}>
            <input
              aria-label="Message TaskBoard agent"
              placeholder="Ask about or update tickets"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit" disabled={isSending || !input.trim()}>Send</button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
