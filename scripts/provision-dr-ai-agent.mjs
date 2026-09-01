import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "config", "elevenlabs", "dr-ai-agent.json");
const apply = process.argv.includes("--apply");
const verifyLive = process.argv.includes("--verify-live");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function substitute(value, replacements) {
  if (Array.isArray(value)) return value.map((item) => substitute(item, replacements));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitute(item, replacements)]));
  }
  if (typeof value !== "string") return value;
  return Object.entries(replacements).reduce((next, [token, replacement]) => next.replaceAll(token, replacement), value);
}

function validateManifest(value) {
  requireString(value.name, "manifest.name");
  requireString(value.slug, "manifest.slug");
  if (!Array.isArray(value.tools) || value.tools.length !== 3) throw new Error("manifest.tools must contain exactly three tools");
  const names = value.tools.map((tool) => tool?.tool_config?.name).sort();
  if (names.join(",") !== "retrieve_medical_profile,sync_dr_ai_screen,vyva_triage_step") {
    throw new Error("Dr. AI requires retrieve_medical_profile, sync_dr_ai_screen, and vyva_triage_step");
  }
  const sync = value.tools.find((tool) => tool.tool_config.name === "sync_dr_ai_screen")?.tool_config;
  if (!sync?.expects_response) throw new Error("sync_dr_ai_screen must wait for the client response");
  const prompt = requireString(value.conversation_config?.agent?.prompt?.prompt, "Dr. AI system prompt");
  const requiredConversationRules = [
    "Be warm, calm, patient, and unhurried",
    "say it only once",
    "Do not repeat a question that has already been answered",
    "call vyva_triage_step again for that completed session",
    "call retrieve_medical_profile exactly once",
    "Address the user by name naturally",
    "Policy-filtered memory may support continuity",
    "Do not mention unrelated consultation history proactively",
    "Never claim access to raw audio or transcripts",
    "Treat a successful profile response as the authoritative VYVA context available for this session",
    "Do not say that you cannot access information the profile tool returned",
    "Current answers and current vitals always take precedence over stored context",
  ];
  for (const rule of requiredConversationRules) {
    if (!prompt.includes(rule)) throw new Error(`Dr. AI system prompt is missing required conversation rule: ${rule}`);
  }
  if (value.privacy?.record_voice !== false || value.privacy?.retention_days !== 0 || value.privacy?.delete_audio !== true) {
    throw new Error("Dr. AI manifest must use maximum privacy defaults");
  }
}

validateManifest(manifest);
if (!apply && !verifyLive) {
  console.log(`Dr. AI manifest is valid: ${path.relative(root, manifestPath)}`);
  console.log("Dry run only. Use --verify-live to detect configuration drift, or --apply to provision.");
  process.exit(0);
}

const apiKey = requireString(process.env.ELEVENLABS_API_KEY, "ELEVENLABS_API_KEY");

async function api(endpoint, init = {}) {
  const response = await fetch(`https://api.elevenlabs.io${endpoint}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${init.method || "GET"} ${endpoint} failed (${response.status}): ${text.slice(0, 800)}`);
  return body;
}

async function resolveAgentId() {
  const configuredAgentId = process.env.ELEVENLABS_DR_AI_AGENT_ID?.trim();
  if (configuredAgentId) return configuredAgentId;

  const agentsResponse = await api("/v1/convai/agents?page_size=100");
  const matches = (agentsResponse?.agents || []).filter((agent) => agent.name === manifest.name && !agent.archived);
  if (matches.length > 1) {
    throw new Error(`Multiple active ElevenLabs agents named ${manifest.name}; set ELEVENLABS_DR_AI_AGENT_ID explicitly`);
  }
  return matches[0]?.agent_id;
}

async function verifyLiveAgent({ agentId, expectedToolIds }) {
  const [agent, speechEngine] = await Promise.all([
    api(`/v1/convai/agents/${encodeURIComponent(agentId)}`),
    api(`/v1/speech-engine/${encodeURIComponent(agentId)}`),
  ]);
  const livePrompt = agent?.conversation_config?.agent?.prompt?.prompt;
  const expectedPrompt = manifest.conversation_config.agent.prompt.prompt;
  if (livePrompt !== expectedPrompt) {
    throw new Error("Agent verification failed: live system prompt differs from config/elevenlabs/dr-ai-agent.json");
  }
  const liveFirstMessage = agent?.conversation_config?.agent?.first_message;
  if (liveFirstMessage !== manifest.conversation_config.agent.first_message) {
    throw new Error("Agent verification failed: live first message differs from the manifest");
  }
  const installedToolIds = agent?.conversation_config?.agent?.prompt?.tool_ids || [];
  if (!expectedToolIds.every((toolId) => installedToolIds.includes(toolId))) {
    throw new Error("Agent verification failed: required tools are not installed");
  }
  if (speechEngine?.privacy?.record_voice !== false || speechEngine?.privacy?.retention_days !== 0) {
    throw new Error("Agent verification failed: maximum privacy settings were not applied");
  }
  return agent;
}

if (verifyLive && !apply) {
  const agentId = requireString(await resolveAgentId(), "ELEVENLABS_DR_AI_AGENT_ID or matching live agent");
  const toolsResponse = await api("/v1/convai/tools?page_size=100");
  const workspaceTools = Array.isArray(toolsResponse) ? toolsResponse : toolsResponse?.tools || [];
  const expectedToolIds = manifest.tools.map((tool) => {
    const name = tool.tool_config.name;
    const matches = workspaceTools.filter((candidate) => candidate?.tool_config?.name === name);
    if (matches.length !== 1) throw new Error(`Expected exactly one live ElevenLabs tool named ${name}; found ${matches.length}`);
    return matches[0].id;
  });
  await verifyLiveAgent({ agentId, expectedToolIds });
  console.log(`VYVA Dr. AI live configuration matches the manifest: ${agentId}`);
  process.exit(0);
}

const voiceId = requireString(process.env.ELEVENLABS_DR_AI_VOICE_ID, "ELEVENLABS_DR_AI_VOICE_ID");
const publicUrl = requireString(process.env.VYVA_PUBLIC_URL || process.env.VITE_PUBLIC_APP_URL, "VYVA_PUBLIC_URL")
  .replace(/\/$/, "");
if (!publicUrl.startsWith("https://")) throw new Error("VYVA_PUBLIC_URL must be public HTTPS");

const resolved = substitute(manifest, {
  "$VYVA_PUBLIC_URL": publicUrl,
  "$ELEVENLABS_DR_AI_VOICE_ID": voiceId,
});

const toolsResponse = await api("/v1/convai/tools?page_size=100");
const workspaceTools = Array.isArray(toolsResponse) ? toolsResponse : toolsResponse?.tools || [];
const toolIds = [];
for (const tool of resolved.tools) {
  const name = tool.tool_config.name;
  const matches = workspaceTools.filter((candidate) => candidate?.tool_config?.name === name);
  if (matches.length > 1) throw new Error(`Multiple ElevenLabs tools named ${name}; resolve duplicates before provisioning`);
  let saved;
  if (matches[0]) {
    saved = await api(`/v1/convai/tools/${encodeURIComponent(matches[0].id)}`, { method: "PATCH", body: JSON.stringify(tool) });
  } else {
    saved = await api("/v1/convai/tools", { method: "POST", body: JSON.stringify(tool) });
  }
  toolIds.push(saved.id || matches[0]?.id);
}

let agentId = await resolveAgentId();

const agentPayload = {
  name: resolved.name,
  tags: resolved.tags,
  conversation_config: {
    ...resolved.conversation_config,
    agent: {
      ...resolved.conversation_config.agent,
      prompt: {
        ...resolved.conversation_config.agent.prompt,
        tool_ids: toolIds,
      },
    },
  },
};

if (agentId) {
  await api(`/v1/convai/agents/${encodeURIComponent(agentId)}`, { method: "PATCH", body: JSON.stringify(agentPayload) });
} else {
  const created = await api("/v1/convai/agents/create", { method: "POST", body: JSON.stringify(agentPayload) });
  agentId = requireString(created?.agent_id, "created agent_id");
}

await api(`/v1/speech-engine/${encodeURIComponent(agentId)}`, {
  method: "PATCH",
  body: JSON.stringify({ privacy: resolved.privacy }),
});

await verifyLiveAgent({ agentId, expectedToolIds: toolIds });

console.log(`VYVA Dr. AI provisioned and verified: ${agentId}`);
console.log(`Set ELEVENLABS_DR_AI_AGENT_ID=${agentId} in the secure deployment environment.`);
