import { Preprocessor } from "../index";

export interface MastraProcessorOptions {
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

export class MastraProcessor {
  id: string;
  name: string;
  constructor(options?: MastraProcessorOptions);
  processInput(args: { messages: any[]; requestContext?: any }): Promise<any[]>;
  processOutputStep(args: { messages: any[]; requestContext?: any }): Promise<any[]>;
  processOutputResult(args: { result: any; requestContext?: any }): Promise<any>;
}
