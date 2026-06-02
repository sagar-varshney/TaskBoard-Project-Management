# Free-Tier LLM API Options

Reviewed on June 1, 2026.

Do not commit a real LLM API key. Each developer should create a personal key and store it in `.env`.

## Starting Point: Google Gemini API

Use the Gemini Developer API for the first TaskBoard AI feature.

Why:

- Google documents a free tier for developers and small projects.
- The free tier includes free input and output tokens for supported models.
- API keys can be created in Google AI Studio.
- This is enough for an internship demo such as ticket summarization, ticket rewriting, or suggested priority.

Official links:

- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Create a Gemini API key](https://aistudio.google.com/app/apikey)

Suggested future environment variable:

```env
GEMINI_API_KEY=your_personal_api_key
```

## Alternative: Groq API

Groq is a good option when fast text generation matters.

Why:

- Groq documents free-plan rate limits for several models.
- The free plan is suitable for development and demos.
- Exact limits depend on the chosen model and can change over time.

Official links:

- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [Groq console](https://console.groq.com/)

Suggested future environment variable:

```env
GROQ_API_KEY=your_personal_api_key
```

## Alternative: OpenRouter Free Models

OpenRouter can be useful when experimenting with multiple providers through one API.

Notes:

- Free model variants use IDs ending in `:free`.
- OpenRouter documents separate request limits for free model variants.
- Model availability can change, so check the model list before implementation.

Official links:

- [OpenRouter API limits](https://openrouter.ai/docs/api/reference/limits)
- [OpenRouter models](https://openrouter.ai/models)

Suggested future environment variable:

```env
OPENROUTER_API_KEY=your_personal_api_key
```

## Alternative: Hugging Face Inference Providers

Hugging Face is useful for experimenting with different models and providers.

Notes:

- Free users receive a small monthly inference credit.
- It is better suited to experimentation than a frequently used demo.

Official links:

- [Hugging Face Inference Providers pricing](https://huggingface.co/docs/inference-providers/pricing)
- [Hugging Face access tokens](https://huggingface.co/settings/tokens)

Suggested future environment variable:

```env
HF_TOKEN=your_personal_api_key
```

## Suggested First AI Feature

Start with a small admin-only endpoint:

```text
POST /api/tickets/:id/ai-summary
```

It can send a ticket title and description to the selected LLM, then return a short summary and suggested priority. Keep the provider key only in the backend `.env`.
