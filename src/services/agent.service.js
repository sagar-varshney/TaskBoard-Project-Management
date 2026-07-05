const { Annotation, END, START, StateGraph } = require("@langchain/langgraph");
const { internalApiBaseUrl } = require("../config/env");
const AppError = require("../utils/app-error");
const { generateJson } = require("./gemini.service");

const writeTools = new Set(["create_ticket", "update_ticket", "add_comment"]);

const AgentState = Annotation.Root({
  message: Annotation,
  history: Annotation,
  user: Annotation,
  authorization: Annotation,
  plan: Annotation,
  result: Annotation,
  reply: Annotation,
  changed: Annotation
});

function apiBaseUrl() {
  return `${internalApiBaseUrl()}/api`;
}

async function callTaskBoardApi(path, authorization, options = {}) {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  const data = await response.json();

  if (!response.ok) {
    throw new AppError(data.message || "TaskBoard API request failed", response.status);
  }

  return data;
}

function ticketIdFrom(value) {
  const match = String(value || "").match(/(\d+)$/);

  if (!match) {
    throw new AppError("A ticket ID or ticket key such as DEMO-5 is required", 400);
  }

  return match[1];
}

async function resolveProjectId(argumentsValue, authorization) {
  if (argumentsValue.projectId) {
    return argumentsValue.projectId;
  }

  if (!argumentsValue.projectKey && !argumentsValue.projectName) {
    return null;
  }

  const { projects } = await callTaskBoardApi("/projects", authorization);
  const projectKey = String(argumentsValue.projectKey || "").toLowerCase();
  const projectName = String(argumentsValue.projectName || "").toLowerCase();
  const project = projects.find(
    (item) =>
      (projectKey && item.project_key.toLowerCase() === projectKey) ||
      (projectName && item.name.toLowerCase() === projectName)
  );

  if (!project) {
    throw new AppError("I could not find that project", 404);
  }

  return project.id;
}

function plannerPrompt(state) {
  const history = (state.history || [])
    .slice(-8)
    .map((item) => `${item.role}: ${item.content}`)
    .join("\n");

  return `
You are the planning node of a TaskBoard LangGraph agent.
Choose exactly one approved tool for the user's latest request, or choose "answer" when no tool is needed.
Never invent IDs or missing required values. If a write request is ambiguous, choose "answer" and ask a short clarification question.
The backend API will enforce the user's permissions. The current user role is "${state.user.role}".

Approved tools and arguments:
- list_projects: {}
- list_tickets: { projectId?, projectKey?, projectName?, status? }
- list_my_tickets: {} returns tickets reported by, assigned to, or owned by the current user
- get_ticket: { ticketId } where ticketId may be 5 or DEMO-5
- create_ticket: { projectId?, projectKey?, projectName?, title, description?, issueType?, priority?, impact?, fixPlan? }
- update_ticket: { ticketId, status?, resolution?, fixPlan?, title?, description?, issueType?, priority?, assigneeId?, ownerId?, sprintId?, scrumTeamId?, impact? }
- add_comment: { ticketId, commentText, isInternal? }
- list_attachments: { ticketId }
- analyze_attachment: { ticketId, attachmentId?, prompt? } analyzes the specified attachment, or the latest attachment when attachmentId is omitted
- answer: { message }

Valid values:
- status: todo, in_progress, done
- resolution: unresolved, fixed, wont_fix, duplicate
- issueType: bug, task, story
- priority: low, medium, high, critical

Role rules to explain when relevant:
- admin can update all ticket fields and planning/delegation data.
- developer can update status, resolution, and fixPlan.
- member can update status, resolution, and fixPlan only when assigned or owner.
- all authenticated users can read tickets, create basic tickets, and add comments.

Conversation history:
${history || "No previous messages"}

Latest user request:
${state.message}

Return only JSON:
{"tool":"approved_tool_name","arguments":{}}
`;
}

function localPlan(message) {
  const normalized = message.trim().replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();

  if (/^(show|list) (me|my) tickets$/.test(lower)) {
    return { tool: "list_my_tickets", arguments: {} };
  }

  if (/^(show|list)( all)? tickets$/.test(lower)) {
    return { tool: "list_tickets", arguments: {} };
  }

  if (/^(show|list)( all)? projects$/.test(lower)) {
    return { tool: "list_projects", arguments: {} };
  }

  if (/^(show|list) active tickets$/.test(lower)) {
    return { tool: "list_tickets", arguments: { status: "in_progress" } };
  }

  const ticketMatch = normalized.match(/(?:show(?: me)?|get|open)\s+(?:ticket\s+)?([A-Za-z]+-\d+|\d+)$/i);
  if (ticketMatch) {
    return { tool: "get_ticket", arguments: { ticketId: ticketMatch[1] } };
  }

  const statusMatch = normalized.match(
    /(?:set|change|update)\s+(?:ticket\s+)?([A-Za-z]+-\d+|\d+)\s+(?:status\s+)?(?:to\s+)?(todo|to do|in progress|done)$/i
  );
  if (statusMatch) {
    return {
      tool: "update_ticket",
      arguments: {
        ticketId: statusMatch[1],
        status: statusMatch[2].toLowerCase().replaceAll(" ", "_")
      }
    };
  }

  const commentMatch = normalized.match(
    /add (?:a )?comment to (?:ticket )?([A-Za-z]+-\d+|\d+)(?: saying|:)\s*(.+)$/i
  );
  if (commentMatch) {
    return {
      tool: "add_comment",
      arguments: {
        ticketId: commentMatch[1],
        commentText: commentMatch[2]
      }
    };
  }

  const listAttachmentsMatch = normalized.match(
    /(?:show|list|get)\s+(?:the\s+)?attachments\s+(?:for|on)\s+(?:ticket\s+)?([A-Za-z]+-\d+|\d+)$/i
  );
  if (listAttachmentsMatch) {
    return { tool: "list_attachments", arguments: { ticketId: listAttachmentsMatch[1] } };
  }

  const analyzeAttachmentMatch = normalized.match(
    /(?:analyze|read|summarize)\s+(?:(?:attachment|file)\s+(\d+)\s+(?:for|on)\s+)?(?:the\s+)?(?:latest\s+)?(?:attachment|file)?\s*(?:for|on)\s+(?:ticket\s+)?([A-Za-z]+-\d+|\d+)(?:\s+(.+))?$/i
  );
  if (analyzeAttachmentMatch) {
    return {
      tool: "analyze_attachment",
      arguments: {
        attachmentId: analyzeAttachmentMatch[1],
        ticketId: analyzeAttachmentMatch[2],
        prompt: analyzeAttachmentMatch[3]
      }
    };
  }

  const createMatch = normalized.match(
    /create (?:a |an )?(?:(low|medium|high|critical) priority )?(bug|task|story) in ([A-Za-z0-9_-]+) titled (.+)$/i
  );
  if (createMatch) {
    return {
      tool: "create_ticket",
      arguments: {
        priority: createMatch[1]?.toLowerCase(),
        issueType: createMatch[2].toLowerCase(),
        projectKey: createMatch[3],
        title: createMatch[4]
      }
    };
  }

  if (/^create (?:a )?ticket$/i.test(normalized)) {
    return { tool: "create_ticket", arguments: {} };
  }

  return null;
}

async function planNode(state) {
  const plan = localPlan(state.message) || await generateJson(plannerPrompt(state));

  if (!plan.tool || typeof plan.arguments !== "object") {
    throw new AppError("The agent could not create a valid action plan", 502);
  }

  return { plan };
}

async function executeToolNode(state) {
  const args = state.plan.arguments || {};
  const authorization = state.authorization;
  let changed = writeTools.has(state.plan.tool);
  let result;

  switch (state.plan.tool) {
    case "list_projects":
      result = await callTaskBoardApi("/projects", authorization);
      break;
    case "list_tickets": {
      const projectId = await resolveProjectId(args, authorization);
      const query = new URLSearchParams();
      if (projectId) query.set("projectId", projectId);
      if (args.status) query.set("status", args.status);
      result = await callTaskBoardApi(`/tickets${query.size ? `?${query}` : ""}`, authorization);
      break;
    }
    case "list_my_tickets":
      {
        const [personalData, workspaceData] = await Promise.all([
          callTaskBoardApi("/tickets/my", authorization),
          callTaskBoardApi("/tickets", authorization)
        ]);
        result = {
          tickets: personalData.tickets,
          relatedCount: personalData.tickets.length,
          workspaceTotal: workspaceData.tickets.length
        };
      }
      break;
    case "get_ticket":
      result = await callTaskBoardApi(`/tickets/${ticketIdFrom(args.ticketId)}`, authorization);
      break;
    case "create_ticket": {
      const projectId = await resolveProjectId(args, authorization);
      if (!projectId || !args.title) {
        result = {
          message: "Please provide both a project name or key and a ticket title before I create the ticket."
        };
        changed = false;
        break;
      }
      result = await callTaskBoardApi("/tickets", authorization, {
        method: "POST",
        body: JSON.stringify({ ...args, projectId, projectKey: undefined, projectName: undefined })
      });
      break;
    }
    case "update_ticket": {
      const ticketId = ticketIdFrom(args.ticketId);
      const { ticketId: ignoredTicketId, ...updates } = args;
      result = await callTaskBoardApi(`/tickets/${ticketId}`, authorization, {
        method: "PATCH",
        body: JSON.stringify(updates)
      });
      break;
    }
    case "add_comment": {
      const ticketId = ticketIdFrom(args.ticketId);
      if (!args.commentText) {
        throw new AppError("Adding a comment requires commentText", 400);
      }
      result = await callTaskBoardApi(`/tickets/${ticketId}/comments`, authorization, {
        method: "POST",
        body: JSON.stringify({
          commentText: args.commentText,
          isInternal: Boolean(args.isInternal)
        })
      });
      break;
    }
    case "list_attachments": {
      const ticketId = ticketIdFrom(args.ticketId);
      result = await callTaskBoardApi(`/tickets/${ticketId}/attachments`, authorization);
      break;
    }
    case "analyze_attachment": {
      const ticketId = ticketIdFrom(args.ticketId);
      let attachmentId = args.attachmentId;

      if (!attachmentId) {
        const attachmentData = await callTaskBoardApi(`/tickets/${ticketId}/attachments`, authorization);
        if (attachmentData.attachments.length === 0) {
          result = { message: "This ticket does not have any attachments to analyze." };
          changed = false;
          break;
        }
        attachmentId = attachmentData.attachments[0].id;
      }

      result = await callTaskBoardApi(`/tickets/${ticketId}/attachments/${attachmentId}/analyze`, authorization, {
        method: "POST",
        body: JSON.stringify({ prompt: args.prompt })
      });
      break;
    }
    case "answer":
      result = { message: args.message || "Please provide more details." };
      break;
    default:
      throw new AppError("The agent selected an unsupported tool", 400);
  }

  return {
    result,
    changed
  };
}

async function respondNode(state) {
  const tickets = state.result.tickets || [];
  const ticketSummary = tickets
    .slice(0, 5)
    .map((ticket) => `${ticket.ticket_key} "${ticket.title}"`)
    .join(", ");

  switch (state.plan.tool) {
    case "list_my_tickets":
      return {
        reply:
          `You have ${state.result.relatedCount} tickets related to you out of ` +
          `${state.result.workspaceTotal} total workspace tickets.` +
          (ticketSummary ? ` Your related tickets include ${ticketSummary}.` : "")
      };
    case "list_tickets":
      return {
        reply:
          `There are ${tickets.length} matching workspace tickets.` +
          (ticketSummary ? ` They include ${ticketSummary}.` : "")
      };
    case "list_projects": {
      const projects = state.result.projects || [];
      const summary = projects
        .slice(0, 5)
        .map((project) => `${project.project_key} "${project.name}"`)
        .join(", ");
      return {
        reply: `There are ${projects.length} projects.${summary ? ` They include ${summary}.` : ""}`
      };
    }
    case "get_ticket": {
      const ticket = state.result.ticket;
      return {
        reply:
          `${ticket.ticket_key} "${ticket.title}" is ${ticket.status.replaceAll("_", " ")} ` +
          `with ${ticket.priority} priority and ${ticket.resolution} resolution. ` +
          `${ticket.description || "No description is recorded."}`
      };
    }
    case "create_ticket":
      return {
        reply: state.result.ticket
          ? `Created ${state.result.ticket.ticket_key} "${state.result.ticket.title}".`
          : state.result.message
      };
    case "update_ticket":
      return {
        reply: `Updated ${state.result.ticket.ticket_key} "${state.result.ticket.title}".`
      };
    case "add_comment":
      return {
        reply: `Added the comment to ticket ${state.result.comment.issue_id}.`
      };
    case "list_attachments": {
      const attachments = state.result.attachments || [];
      const summary = attachments
        .slice(0, 5)
        .map((attachment) => `${attachment.id}: ${attachment.file_name}`)
        .join(", ");
      return {
        reply: attachments.length
          ? `This ticket has ${attachments.length} attachment(s): ${summary}.`
          : "This ticket does not have any attachments yet."
      };
    }
    case "analyze_attachment": {
      if (state.result.message) {
        return { reply: state.result.message };
      }
      const insight = state.result.insight;
      return {
        reply:
          `Attachment analysis: ${insight.summary || "No summary returned."} ` +
          `Suggested action: ${insight.suggestedAction || "No action suggested."} ` +
          `Risk level: ${insight.riskLevel || "not specified"}.`
      };
    }
    case "answer":
      return { reply: state.result.message };
    default:
      return { reply: "The request was completed." };
  }
}

const agentGraph = new StateGraph(AgentState)
  .addNode("planner", planNode)
  .addNode("tool", executeToolNode)
  .addNode("responder", respondNode)
  .addEdge(START, "planner")
  .addEdge("planner", "tool")
  .addEdge("tool", "responder")
  .addEdge("responder", END)
  .compile();

async function runAgent({ message, history, user, authorization }) {
  return agentGraph.invoke({
    message,
    history,
    user,
    authorization,
    changed: false
  });
}

module.exports = {
  runAgent
};
