import 'dotenv/config';
import * as readline from 'readline/promises';
import { BrowseTraceAgent } from './agent/browsetrace-agent.js';
import { BrowseTraceAPI } from './api/client.js';

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set');
    console.error('Please set it in your .env file');
    process.exit(1);
  }

  // Check if BrowseTrace server is running
  const api = new BrowseTraceAPI();
  const healthy = await api.checkHealth();

  if (!healthy) {
    console.error('Error: BrowseTrace server is not running at http://127.0.0.1:8123');
    console.error('Please start the server first: cd server && go run ./cmd/browsetrace-agent');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          BrowseTrace AI - Browsing Analytics Agent       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log('Connected to BrowseTrace server ✓');
  console.log('Claude AI initialized ✓\n');
  console.log('Examples of what you can ask:');
  console.log('  • "What websites did I visit in the last 2 hours?"');
  console.log('  • "Analyze my browsing patterns today"');
  console.log('  • "Show me my tab switching behavior"');
  console.log('  • "What forms did I fill out recently?"');
  console.log('  • "Find all events related to GitHub"\n');
  console.log('Type "exit" or "quit" to exit\n');

  const agent = new BrowseTraceAgent(apiKey);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const userInput = await rl.question('\n\x1b[36mYou:\x1b[0m ');

    if (!userInput.trim()) {
      continue;
    }

    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      console.log('\nGoodbye! 👋');
      rl.close();
      break;
    }

    if (userInput.toLowerCase() === 'clear') {
      agent.clearHistory();
      console.log('\nConversation history cleared.');
      continue;
    }

    try {
      console.log('\n\x1b[35mBrowseTrace AI:\x1b[0m');
      const response = await agent.chat(userInput);
      console.log(response);
    } catch (error) {
      console.error('\n\x1b[31mError:\x1b[0m', error instanceof Error ? error.message : error);
    }
  }
}

// Run the CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for programmatic use
export { BrowseTraceAgent } from './agent/browsetrace-agent.js';
export { BrowseTraceAPI } from './api/client.js';
export { browsingTools } from './tools/browsing-tools.js';
export * from './types/events.js';
