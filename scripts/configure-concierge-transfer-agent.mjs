const apply = process.argv.includes("--apply");
const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
const agentId = (
  process.env.ELEVENLABS_CONCIERGE_CALLER_AGENT_ID
  || process.env.ELEVENLABS_CONCIERGE_OUTBOUND_AGENT_ID
  || process.env.ELEVENLABS_OUTBOUND_AGENT_ID
  || ""
).trim();

if (!apiKey || !agentId) {
  throw new Error("Set ELEVENLABS_API_KEY and ELEVENLABS_CONCIERGE_CALLER_AGENT_ID first.");
}

const baseUrl = `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`;
const headers = { "Content-Type": "application/json", "xi-api-key": apiKey };
const response = await fetch(baseUrl, { headers });
if (!response.ok) throw new Error(`Could not read the ElevenLabs agent (${response.status}).`);

const agent = await response.json();
const prompt = agent?.conversation_config?.agent?.prompt;
if (!prompt || typeof prompt !== "object") throw new Error("The agent has no editable prompt configuration.");

const transferRule = {
  transfer_destination: {
    type: "phone_dynamic_variable",
    phone_number: "provider_transfer_phone",
  },
  transfer_type: "conference",
  condition: "Only after the user explicitly confirms during this call that they are ready to be connected to the provider.",
};
const builtInTools = { ...(prompt.built_in_tools ?? {}) };
const currentTransfer = builtInTools.transfer_to_number && typeof builtInTools.transfer_to_number === "object"
  ? builtInTools.transfer_to_number
  : {};
const currentTransferParams = currentTransfer.params && typeof currentTransfer.params === "object"
  ? currentTransfer.params
  : {};
const transfers = Array.isArray(currentTransferParams.transfers)
  ? currentTransferParams.transfers.filter((entry) => entry?.transfer_destination?.phone_number !== "provider_transfer_phone")
  : [];

builtInTools.transfer_to_number = {
  ...currentTransfer,
  type: "system",
  name: "transfer_to_number",
  description: "Connect the VYVA user to the selected provider only after the user explicitly confirms they are ready during this call.",
  params: {
    ...currentTransferParams,
    system_tool_type: "transfer_to_number",
    enable_client_message: true,
    transfers: [...transfers, transferRule],
  },
};

const marker = "# VYVA provider connection call";
const transferInstructions = `${marker}\nWhen provider_transfer_requires_confirmation is true:\n- You are calling the VYVA user first. Identify yourself as VYVA and speak in user_language.\n- Briefly state the provider_name and provider_contact_objective.\n- Ask whether the user is ready to be connected now.\n- Call transfer_to_number only after a clear affirmative answer in this call. Use provider_transfer_phone as the destination.\n- Write the provider-facing agent_message in provider_contact_language.\n- If the user declines, is unsure, or does not answer, do not transfer. End the call politely.\n- Do not accept a booking, price, payment, deposit, or commercial terms on the user's behalf.`;
const currentPrompt = typeof prompt.prompt === "string" ? prompt.prompt.trim() : "";
const nextPrompt = currentPrompt.includes(marker)
  ? currentPrompt
  : `${currentPrompt}${currentPrompt ? "\n\n" : ""}${transferInstructions}`;

const update = {
  conversation_config: {
    agent: {
      prompt: {
        ...prompt,
        prompt: nextPrompt,
        built_in_tools: builtInTools,
      },
    },
  },
  version_description: "Enable consent-gated dynamic provider conference transfers",
};

if (!apply) {
  console.log(JSON.stringify({
    apply: false,
    agent_id: agentId,
    transfer_destination_type: "phone_dynamic_variable",
    transfer_variable: "provider_transfer_phone",
    transfer_type: "conference",
    instruction_added: !currentPrompt.includes(marker),
    message: "Dry run only. Re-run with --apply to update the ElevenLabs agent.",
  }, null, 2));
  process.exit(0);
}

const updateResponse = await fetch(baseUrl, {
  method: "PATCH",
  headers,
  body: JSON.stringify(update),
});
if (!updateResponse.ok) {
  const detail = await updateResponse.text();
  throw new Error(`Could not update the ElevenLabs agent (${updateResponse.status}): ${detail}`);
}

console.log(JSON.stringify({
  apply: true,
  agent_id: agentId,
  transfer_variable: "provider_transfer_phone",
  transfer_type: "conference",
  configured: true,
}, null, 2));
