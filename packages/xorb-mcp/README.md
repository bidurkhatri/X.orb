# @xorb/mcp

MCP server for [X.orb](https://xorb.xyz) — wraps the 8-gate security pipeline as MCP tools.

## Setup

Add to your MCP config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "xorb": {
      "command": "npx",
      "args": ["@xorb/mcp"],
      "env": {
        "XORB_API_URL": "https://api.xorb.xyz",
        "XORB_API_KEY": "xorb_sk_...",
        "XORB_AGENT_ID": "agent_..."
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `gated_tool_call` | Execute action through 8-gate pipeline |
| `register_agent` | Register a new agent with USDC bond |
| `check_reputation` | Query reputation score and tier |
| `emergency_stop` | Immediately pause an agent |
| `get_audit` | Get audit log with violations and reputation |
