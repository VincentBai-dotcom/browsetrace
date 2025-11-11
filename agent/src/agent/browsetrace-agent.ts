import Anthropic from '@anthropic-ai/sdk';
import { browsingTools } from '../tools/browsing-tools.js';

export class BrowseTraceAgent {
  private client: Anthropic;
  private model: string;
  private conversationHistory: Anthropic.MessageParam[] = [];

  constructor(apiKey: string, model: string = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  /**
   * Initialize the agent with a system prompt
   */
  private getSystemPrompt(): string {
    return `You are BrowseTrace AI, an intelligent assistant that helps users understand and analyze their browsing behavior.

You have access to tools that can query browsing events including:
- Navigation events (page visits and tab switches)
- Click events (elements clicked)
- Input events (form fields and text entered)
- Focus events (elements focused)
- Visible text content (page content captured)

Your capabilities include:
- Analyzing browsing patterns and habits
- Finding specific websites or activities
- Summarizing recent browsing sessions
- Identifying frequently visited sites
- Analyzing tab switching behavior
- Understanding user workflows and interests

You should:
- Be helpful, concise, and insightful
- Respect user privacy and handle browsing data with care
- Provide actionable insights when analyzing patterns
- Ask clarifying questions when needed
- Format data clearly (use lists, tables when appropriate)

All timestamps are in ISO format. Event types include: navigate, click, input, focus, visible_text.
Tab switches are navigate events with session_id="tab-switch".`;
  }

  /**
   * Process a user message and generate a response
   */
  async chat(userMessage: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    let response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: this.getSystemPrompt(),
      messages: this.conversationHistory,
      tools: browsingTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
      })),
    });

    // Handle tool use (function calling)
    while (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find((block) => block.type === 'tool_use') as
        | Anthropic.ToolUseBlock
        | undefined;

      if (!toolUseBlock) break;

      // Find and execute the tool
      const tool = browsingTools.find((t) => t.name === toolUseBlock.name);

      if (!tool) {
        throw new Error(`Unknown tool: ${toolUseBlock.name}`);
      }

      console.log(`\n[Tool Call] ${toolUseBlock.name}`);
      console.log(`[Input] ${JSON.stringify(toolUseBlock.input, null, 2)}`);

      // Execute the tool function
      const toolResult = await tool.function(toolUseBlock.input as any);

      console.log(`[Result] ${JSON.stringify(toolResult, null, 2).substring(0, 200)}...`);

      // Add assistant's tool use to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content,
      });

      // Add tool result to history
      this.conversationHistory.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: JSON.stringify(toolResult),
          },
        ],
      });

      // Get next response from Claude
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: this.getSystemPrompt(),
        messages: this.conversationHistory,
        tools: browsingTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.input_schema,
        })),
      });
    }

    // Extract text response
    const textBlock = response.content.find((block) => block.type === 'text') as
      | Anthropic.TextBlock
      | undefined;

    const assistantMessage = textBlock?.text || 'No response generated.';

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: assistantMessage,
    });

    return assistantMessage;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): Anthropic.MessageParam[] {
    return this.conversationHistory;
  }
}
