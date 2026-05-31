import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import {
  findSupportChatModel,
  type SupportChatModel,
  type SupportChatModelId,
  type SupportProvider,
} from "@archcode/shared";
import type { LanguageModel } from "ai";

type AnthropicModelId = Extract<SupportChatModel, { mode: "anthropic" }>["id"];
type OpenaiModelId = Extract<SupportChatModel, { mode: "openai" }>["id"];
type GoogleModelId = Extract<SupportChatModel, { mode: "google" }>["id"];

export type ResolvedModel = {
  model: LanguageModel;
  provider: SupportProvider;
  modelId: SupportChatModelId;
};

function assertUnsupportedProvider(provider: never): never {
  throw new Error(`Unsupported provider: ${provider}`);
}

function resolveAnthropicModel(modelId: AnthropicModelId): ResolvedModel {
  return {
    model: anthropic(modelId),
    provider: "anthropic",
    modelId,
  };
}

function resolveOpenaiModel(modelId: OpenaiModelId): ResolvedModel {
  return {
    model: openai(modelId),
    provider: "openai",
    modelId,
  };
}

function resolveGoogleModel(modelId: GoogleModelId): ResolvedModel {
  return {
    model: google(modelId),
    provider: "google",
    modelId,
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
