# OpenRouter Integration

This document explains how to use cloud-based AI models with Hasyx via the [OpenRouter](https://openrouter.ai/) service.

OpenRouter provides access to a wide variety of models from different providers (like Google, Anthropic, Mistral AI, etc.) through a single API.

## 1. Setup

To use OpenRouter, you need an API key.

1.  **Create an OpenRouter Account**: Sign up at [openrouter.ai](https://openrouter.ai/).
2.  **Get an API Key**: Navigate to your account settings and generate a new API key.
3.  **Set Environment Variable**: Create a `.env` file in the root of your Hasyx project and add your API key:

    ```env
    # .env
    OPENROUTER_API_KEY="sk-or-v1-..."
    ```

    The `ask` command will automatically load this key from your environment.

## 2. Usage with Hasyx `ask` CLI

With the `OPENROUTER_API_KEY` set, you can now use any supported model. By default, if no provider is specified, Hasyx will use OpenRouter.

### Non-Interactive Mode

Use the `-e` flag for single commands.

```bash
# Ask a question using the default OpenRouter model (google/gemini-flash-1.5)
npm run ask -- -e "Explain the difference between a class and an interface in TypeScript."

# Specify a different model, for example, Claude 3.5 Sonnet
npm run ask -- -e "Write a short story about a robot who discovers music." --model anthropic/claude-3.5-sonnet
```

*Note: You can omit `--provider openrouter` as it is the default.*

### Interactive Mode

Start a persistent chat session with a cloud model.

```bash
# Start an interactive session with the default model
npm run ask

# Start a session with a specific model
npm run ask -- --model mistralai/mixtral-8x7b-instruct
```

This will launch a chat where the AI will remember the context of your conversation.