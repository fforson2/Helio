export type MessageRole = "user" | "assistant" | "agent" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  propertyContext?: string;
  metadata?: Record<string, unknown>;
}

export interface Session {
  id: string;
  userId: string;
  agentId?: string;
  propertyIds: string[];
  focusedPropertyId?: string;
  messages: ChatMessage[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}
