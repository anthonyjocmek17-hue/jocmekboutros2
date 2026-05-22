export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type Provider = "openai" | "anthropic";

function getProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new Error("Missing AI provider API key. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.");
}

export async function generateAssistantReply(messages: ChatMessage[]): Promise<string> {
  const provider = getProvider();

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY!;
    const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as any;
    return (data?.choices?.[0]?.message?.content ?? "").trim();
  }

  // anthropic
  {
    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest";

    // Anthropic expects: system string + messages array (user/assistant).
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const convo = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        temperature: 0.2,
        system,
        messages: convo
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as any;
    const parts = Array.isArray(data?.content) ? data.content : [];
    const text = parts.map((p: any) => (p?.type === "text" ? p.text : "")).join("");
    return (text ?? "").trim();
  }
}

