# Ollama Integration

This document explains how to use local AI models with Hasyx via [Ollama](https://ollama.ai/).

Using Ollama allows you to run powerful open-source language models directly on your machine, ensuring privacy and removing reliance on cloud APIs.

## 1. Installation and Setup

### Install Ollama

First, install the Ollama service on your system.

```bash
# On Linux or macOS
curl -fsSL https://ollama.ai/install.sh | sh
```

For Windows, download the installer from the [Ollama website](https://ollama.ai/).

After installation, the Ollama service will run in the background on `http://localhost:11434`.

### Download Models

Next, pull the models you want to use. The model name and tag (e.g., `gemma2:2b`) are what you will use in the `--model` flag.

```bash
# Recommended lightweight model for development
ollama pull gemma2:2b

# A slightly more capable model
ollama pull llama3:8b

# A model specialized for coding tasks
ollama pull codellama:7b
```

### Manage Models

You can manage your local models using the Ollama CLI.

```bash
# List all locally installed models
ollama list

# Test a model in an interactive chat
ollama run gemma2:2b

# Get detailed information about a model
ollama show gemma2:2b

# Remove a model to free up disk space
ollama rm gemma2:2b
```

## 2. Usage with Hasyx `ask` CLI

Once Ollama is running and you have downloaded models, you can use them with the `ask` command by specifying `ollama` as the provider.

### Non-Interactive Mode

Use the `-e` flag for single commands.

```bash
# Execute a command using the gemma2:2b model
npm run ask -- -e "How much memory is available on this system?" --provider ollama --model gemma2:2b

# Use a different model for a coding question
npm run ask -- -e "Write a JavaScript function to find the nth Fibonacci number" --provider ollama --model codellama:7b
```

### Interactive Mode

Start a persistent chat session with a local model.

```bash
# Start an interactive session with llama3
npm run ask -- --provider ollama --model llama3:8b
```

This will launch a chat where you can have an ongoing conversation with the AI, and it will remember the context of your discussion. 