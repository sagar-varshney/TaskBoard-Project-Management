const { config } = require("../config/env");
const AppError = require("../utils/app-error");

const geminiModel = config.ai.geminiModel;
const groqModel = config.ai.groqModel;

function parseJsonResponse(text) {
  try {
    // LLM providers are instructed to return JSON; parsing fails if a provider returns plain text.
    return JSON.parse(text.replace(/^```json\s*|\s*```$/g, "").trim());
  } catch (error) {
    throw new AppError("LLM returned an unexpected response format", 502);
  }
}

function isFallbackCandidate(error) {
  return [429, 502, 503, 504].includes(error.statusCode);
}

async function generateWithGemini(prompt) {
  if (!config.ai.geminiApiKey) {
    throw new AppError("Gemini API key is not configured", 503);
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.ai.geminiApiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const providerMessage = data.error?.message || "Gemini request failed";
    if (response.status === 429 || providerMessage.toLowerCase().includes("quota")) {
      throw new AppError(
        "The AI planner is temporarily rate-limited. Basic commands such as 'Show all tickets', " +
        "'Show my tickets', 'Show DEMO-5', status updates, and comments still work. Please retry complex requests shortly.",
        429
      );
    }
    throw new AppError(providerMessage, 502);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new AppError("Gemini did not return a ticket summary", 502);
  }

  return parseJsonResponse(text);
}

async function generateAttachmentInsight({ ticket, attachment, base64Data, prompt }) {
  if (!config.ai.geminiApiKey) {
    throw new AppError("Gemini API key is required to analyze attachments", 503);
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.ai.geminiApiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `
You are analyzing a TaskBoard ticket attachment.
Read the attachment content and return only valid JSON with:
- summary: short description of what the attachment shows or contains
- extractedText: important readable text found in the file, or an empty string
- suggestedAction: one practical next action for the ticket owner
- riskLevel: one of low, medium, high, critical

Ticket: ${ticket.ticket_key} "${ticket.title}"
Ticket description: ${ticket.description || "No description recorded"}
Ticket impact: ${ticket.impact || "No impact recorded"}
Ticket fix plan: ${ticket.fix_plan || "No fix plan recorded"}
Attachment: ${attachment.file_name} (${attachment.mime_type})
User request: ${prompt || "Analyze this attachment for ticket triage."}
`
              },
              {
                inline_data: {
                  mime_type: attachment.mime_type,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new AppError(data.error?.message || "Attachment analysis failed", response.status);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new AppError("Gemini did not return attachment analysis", 502);
  }

  return parseJsonResponse(text);
}

async function generateWithGroq(prompt) {
  if (!config.ai.groqApiKey) {
    throw new AppError("Groq API key is not configured", 503);
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.ai.groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: groqModel,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_object"
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new AppError(data.error?.message || "Groq request failed", response.status);
  }

  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new AppError("Groq did not return a JSON response", 502);
  }

  return parseJsonResponse(text);
}

async function generateJson(prompt) {
  try {
    return await generateWithGemini(prompt);
  } catch (error) {
    if (config.ai.groqApiKey && isFallbackCandidate(error)) {
      return generateWithGroq(prompt);
    }

    if (!config.ai.geminiApiKey && config.ai.groqApiKey) {
      return generateWithGroq(prompt);
    }

    throw error;
  }
}

async function summarizeTicket(ticket) {
  // Only send ticket context needed for the insight. The key stays on the backend in .env.
  const prompt = `
You are assisting a ticket management dashboard.
Analyze this ticket and return only valid JSON with these fields:
- summary: a concise one-sentence summary
- suggestedPriority: one of low, medium, high, critical
- nextAction: one practical next step

Ticket title: ${ticket.title}
Ticket description: ${ticket.description || "No description provided"}
Current type: ${ticket.issue_type}
Current priority: ${ticket.priority}
Current status: ${ticket.status}
`;

  return generateJson(prompt);
}

module.exports = {
  generateJson,
  generateAttachmentInsight,
  summarizeTicket
};
