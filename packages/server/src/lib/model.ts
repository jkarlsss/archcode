import { anthropic } from "@ai-sdk/anthropic";
import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { groq, type GroqLanguageModelOptions } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import {
  findSupportChatModel,
  type SupportChatModel,
  type SupportChatModelId,
  type SupportProvider,
} from "@archcode/shared";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

type AnthropicModelId = Extract<SupportChatModel, { mode: "anthropic" }>["id"];
type OpenaiModelId = Extract<SupportChatModel, { mode: "openai" }>["id"];
type GoogleModelId = Extract<SupportChatModel, { mode: "google" }>["id"];
type OpenRouterModelId = Extract<
  SupportChatModel,
  { mode: "openrouter" }
>["id"];
type GroqModelId = Extract<SupportChatModel, { mode: "groq" }>["id"];

export type ResolvedModel = {
  model: LanguageModel;
  provider: SupportProvider;
  modelId: SupportChatModelId;
  providerOptions?: ProviderOptions;
};

const ANTHROPIC_PROVIDER_OPTIONS: Partial<
  Record<AnthropicModelId, ProviderOptions>
> = {
  "claude-opus-4-6": {
    anthropic: {
      thinking: {
        type: "enabled",
        budgetTokens: 10000,
      },
    },
  },
  "claude-sonnet-4-6": {
    anthropic: {
      thinking: {
        type: "enabled",
        budgetTokens: 10000,
      },
    },
  },
};

const OPENAI_PROVIDER_OPTIONS: Partial<Record<OpenaiModelId, ProviderOptions>> =
  {
    "gpt-5.4": {
      openai: {
        thinking: {
          reasoningSummary: "detailed",
        },
      },
    },
  };

const GOOGLE_PROVIDER_OPTIONS: Partial<Record<GoogleModelId, ProviderOptions>> =
  {
    "gemini-3.5-flash": {
      google: {
        thinkingConfig: {
          thinkingLevel: "high",
          includeThoughts: true,
        },
      } satisfies GoogleLanguageModelOptions,
    },
  };

const OPENROUTER_PROVIDER_OPTIONS: Partial<
  Record<OpenRouterModelId, ProviderOptions>
> = {
  "nvidia/nemotron-3-ultra-550b-a55b:free": {
    openrouter: {
      // reasoning: {
      //   enabled: false,
      // },
    },
  },
};
const GROQ_PROVIDER_OPTIONS: Partial<
  Record<GroqModelId, ProviderOptions>
> = {
  "qwen/qwen3-32b": {
    groq: {
      reasoningFormat: 'parsed',
      reasoningEffort: 'default',
    } satisfies GroqLanguageModelOptions,
  },
};

function assertUnsupportedProvider(provider: never): never {
  throw new Error(`Unsupported provider: ${provider}`);
}

function resolveAnthropicModel(modelId: AnthropicModelId): ResolvedModel {
  return {
    model: anthropic(modelId),
    provider: "anthropic",
    modelId,
    providerOptions: ANTHROPIC_PROVIDER_OPTIONS[modelId],
  };
}

function resolveOpenaiModel(modelId: OpenaiModelId): ResolvedModel {
  return {
    model: openai(modelId),
    provider: "openai",
    modelId,
    providerOptions: OPENAI_PROVIDER_OPTIONS[modelId],
  };
}

function resolveGoogleModel(modelId: GoogleModelId): ResolvedModel {
  return {
    model: google(modelId),
    provider: "google",
    modelId,
    providerOptions: GOOGLE_PROVIDER_OPTIONS[modelId],
  };
}

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

function resolveOpenrouterModel(modelId: OpenRouterModelId): ResolvedModel {
  return {
    model: openrouter.chat(modelId),
    provider: "openrouter",
    modelId,
    providerOptions: OPENROUTER_PROVIDER_OPTIONS[modelId],
  };
}

function resolveGroqModel(modelId: GroqModelId): ResolvedModel {
  return {
    model: groq(modelId),
    provider: "groq",
    modelId,
    providerOptions: GROQ_PROVIDER_OPTIONS[modelId],
  };
}

function resolveSupportedModel(model: SupportChatModel): ResolvedModel {
  const provider = model.provider;

  switch (provider) {
    case "anthropic":
      return resolveAnthropicModel(model.id as AnthropicModelId);
    case "openai":
      return resolveOpenaiModel(model.id as OpenaiModelId);
    case "google":
      return resolveGoogleModel(model.id as GoogleModelId);
    case "openrouter":
      return resolveOpenrouterModel(model.id as OpenRouterModelId);
    case "groq":
      return resolveGroqModel(model.id as GroqModelId);
    default:
      return assertUnsupportedProvider(provider);
  }
}

export function isSupportedChatModel(
  modelId: string,
): modelId is SupportChatModelId {
  return findSupportChatModel(modelId) != null;
}

export function resolveChatModel(modelId: string): ResolvedModel {
  const model = findSupportChatModel(modelId);

  if (!model) {
    throw new Error(`Unsupported model: ${modelId}`);
  }

  return resolveSupportedModel(model);
}
