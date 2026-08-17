import { fetch } from '@tauri-apps/plugin-http';
import { Snippet } from './tauri';
import { LANGUAGES } from './languages';

export interface AIGroupingResult {
  groups: {
    group_name: string;
    reason: string;
    snippet_ids: string[];
  }[];
}

export interface GeneratedMetadata {
  title: string;
  group: string;
  language: string;
}

const ALLOWED_LANGUAGES = new Set(LANGUAGES.filter(Boolean));

const getGroupingPrompt = (snippets: Snippet[]) => {
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

const getMetadataPrompt = (content: string) => `You are an assistant that writes metadata for a code snippet manager.
Given the snippet content below, respond ONLY with a valid JSON object matching this schema:
{
  "title": "string, a concise descriptive title (max 8 words)",
  "group": "string, a short UPPERCASE category name (e.g. DOCKER, GIT, PYTHON), or an empty string if unclear",
  "language": "string, exactly one of: ${Array.from(ALLOWED_LANGUAGES).join(', ')} — or an empty string if none fit"
}

Snippet content:
${content}
`;

export async function groupSnippets(
  provider: string,
  apiKey: string,
  modelOverride: string | null,
  snippets: Snippet[]
): Promise<AIGroupingResult> {
  const text = await fetchCompletionText(provider, apiKey, modelOverride, getGroupingPrompt(snippets));
  return parseJsonResponse<AIGroupingResult>(text);
}

export async function generateMetadata(
  provider: string,
  apiKey: string,
  modelOverride: string | null,
  content: string
): Promise<GeneratedMetadata> {
  const text = await fetchCompletionText(provider, apiKey, modelOverride, getMetadataPrompt(content));
  return normalizeMetadata(parseJsonResponse<Record<string, unknown>>(text));
}

/**
 * Pulls a title/group/language triple out of a loosely-typed AI response.
 * Missing or non-string fields default to ''. `language` additionally must
 * match one of the app's supported identifiers (case-insensitively) or it
 * is dropped to '' — a value outside that set would just show as "Auto" in
 * the language dropdown anyway, so rejecting it here surfaces the same
 * outcome without carrying a nonsense value through app state.
 */
export function normalizeMetadata(raw: Record<string, unknown>): GeneratedMetadata {
  const language = typeof raw.language === 'string' ? raw.language.trim().toLowerCase() : '';
  return {
    title: typeof raw.title === 'string' ? raw.title.trim() : '',
    group: typeof raw.group === 'string' ? raw.group.trim().toUpperCase() : '',
    language: ALLOWED_LANGUAGES.has(language) ? language : '',
  };
}

/** Extracts and parses the first JSON object in a completion's text, tolerating surrounding prose. */
export function parseJsonResponse<T>(text: string): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}

async function fetchCompletionText(
  provider: string,
  apiKey: string,
  modelOverride: string | null,
  prompt: string
): Promise<string> {
  if (provider === 'openai') {
    return fetchOpenAIText(apiKey, modelOverride || 'gpt-4o-mini', prompt);
  } else if (provider === 'anthropic') {
    return fetchAnthropicText(apiKey, modelOverride || 'claude-3-5-sonnet-20240620', prompt);
  } else {
    // Default: DeepSeek
    return fetchDeepSeekText(apiKey, modelOverride || 'deepseek-chat', prompt);
  }
}

async function fetchOpenAIText(apiKey: string, model: string, prompt: string): Promise<string> {
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
  return data.choices[0].message.content;
}

async function fetchDeepSeekText(apiKey: string, model: string, prompt: string): Promise<string> {
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
  return data.choices[0].message.content;
}

async function fetchAnthropicText(apiKey: string, model: string, prompt: string): Promise<string> {
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
  return data.content[0].text;
}
