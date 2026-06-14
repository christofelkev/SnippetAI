import { fetch } from '@tauri-apps/plugin-http';
import { Snippet } from './tauri';

export interface AIGroupingResult {
  groups: {
    group_name: string;
    reason: string;
    snippet_ids: string[];
  }[];
}

const getPrompt = (snippets: Snippet[]) => {
  const data = snippets.map(s => ({ id: s.id, title: s.title, content: s.content }));
  return `You are an AI assistant that groups code snippets by functionality.
Given the following list of snippets, group them into logical categories.
Respond ONLY with a valid JSON object matching this schema:
{
  "groups": [
    {
      "group_name": "string",
      "reason": "string",
      "snippet_ids": ["string"]
    }
  ]
}

Snippets:
${JSON.stringify(data, null, 2)}
`;
};

export async function groupSnippets(
  provider: string,
  apiKey: string,
  modelOverride: string | null,
  snippets: Snippet[]
): Promise<AIGroupingResult> {
  const prompt = getPrompt(snippets);

  if (provider === 'openai') {
    return fetchOpenAI(apiKey, modelOverride || 'gpt-4o-mini', prompt);
  } else if (provider === 'anthropic') {
    return fetchAnthropic(apiKey, modelOverride || 'claude-3-5-sonnet-20240620', prompt);
  } else {
    // Default: DeepSeek
    return fetchDeepSeek(apiKey, modelOverride || 'deepseek-chat', prompt);
  }
}

async function fetchOpenAI(apiKey: string, model: string, prompt: string): Promise<AIGroupingResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function fetchDeepSeek(apiKey: string, model: string, prompt: string): Promise<AIGroupingResult> {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function fetchAnthropic(apiKey: string, model: string, prompt: string): Promise<AIGroupingResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  const text = data.content[0].text;
  // Try to parse json from the text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return JSON.parse(text);
}
