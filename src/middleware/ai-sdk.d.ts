import { LanguageModelV3Middleware } from "ai";
import { Preprocessor } from "../index";

export interface RedactMiddlewareOptions {
  preprocessor?: Preprocessor;
  tier?: "rules" | "ner" | "llm" | "auto";
  rules?: {
    email?: boolean;
    phone?: boolean;
    ssn?: boolean;
    creditCard?: boolean;
    ip?: boolean;
    apiKey?: boolean;
  };
  llm?: {
    enabled?: boolean;
    names?: boolean;
    addresses?: boolean;
    organizations?: boolean;
  };
  customPatterns?: Array<{ pattern: RegExp | string; type: string }>;
  allowList?: string[];
  denyList?: string[];
  formatPreserving?: boolean;
}

export function redactMiddleware(options?: RedactMiddlewareOptions): LanguageModelV3Middleware;
