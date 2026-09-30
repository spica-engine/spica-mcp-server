# @spica/mcp

MCP (Model Context Protocol) server that enables AI agents to interact with Spica servers — manage databases, serverless functions, storage, authentication, auditing and debugging.

## Prerequisites

- **Node.js** >= 22
- A running **Spica** server instance
- A **Spica API key** with appropriate permissions

## Installation

```bash
npm install -g @spica/mcp
```

Or run directly with npx:

```bash
npx @spica/mcp
```

## Configuration

The server requires two environment variables:

| Variable       | Description                                                               |
| -------------- | ------------------------------------------------------------------------- |
| `SPICA_URL`    | URL of your Spica server (e.g. `https://my-spica.hq.spicaengine.com/api`) |
| `SPICA_APIKEY` | API key for authenticating with the Spica server                          |

### Claude Code

Register the server with the `claude` CLI:

```bash
claude mcp add spica \
  --env SPICA_URL=https://my-spica.hq.spicaengine.com/api \
  --env SPICA_APIKEY=your-api-key \
  -- npx -y @spica/mcp
```

By default the server is only available in the current project. Add `--scope user` to make it available in all your projects, or `--scope project` to write it to a `.mcp.json` file that can be committed and shared with your team.

Run `claude mcp list` to verify the connection, or `/mcp` inside a Claude Code session.

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "spica": {
      "command": "npx",
      "args": ["-y", "@spica/mcp"],
      "env": {
        "SPICA_URL": "https://my-spica.hq.spicaengine.com/api",
        "SPICA_APIKEY": "your-api-key"
      }
    }
  }
}
```

### VS Code

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "spica": {
      "command": "npx",
      "args": ["-y", "@spica/mcp"],
      "env": {
        "SPICA_URL": "https://my-spica.hq.spicaengine.com/api",
        "SPICA_APIKEY": "your-api-key"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "spica": {
      "command": "npx",
      "args": ["-y", "@spica/mcp"],
      "env": {
        "SPICA_URL": "https://my-spica.hq.spicaengine.com/api",
        "SPICA_APIKEY": "your-api-key"
      }
    }
  }
}
```

## Available Tools

### Authentication

| Tool              | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| `list_apikeys`    | List all API keys                                             |
| `insert_apikey`   | Create an API key                                             |
| `update_apikey`   | Update an existing API key                                    |
| `list_identities` | List identities with optional filtering and pagination        |
| `insert_identity` | Create an identity                                            |
| `update_identity` | Update an existing identity                                   |
| `list_policies`   | List access policies with optional filtering and pagination   |
| `insert_policy`   | Create an access policy                                       |
| `update_policy`   | Replace an existing access policy                             |
| `list_users`      | List users with optional filtering, sorting and pagination    |

### Database

| Tool                 | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `list_buckets`       | List all bucket schemas                                                     |
| `insert_bucket`      | Create a bucket schema                                                      |
| `update_bucket`      | Replace an existing bucket schema                                           |
| `list_bucket_data`   | Query documents with filtering, pagination, sorting and relation resolution |
| `save_bucket_data`   | Create or update a document in a bucket                                     |
| `export_bucket_data` | Export bucket documents to a local JSON or CSV file                         |
| `import_bucket_data` | Import documents from a local JSON or CSV file into a bucket                |

### Development

| Tool                         | Description                                  |
| ---------------------------- | -------------------------------------------- |
| `list_functions`             | List all serverless functions                |
| `get_function_index`         | Get the source code of a function            |
| `get_function_dependencies`  | Get installed dependencies for a function    |
| `insert_function`            | Create a serverless function                 |
| `update_function`            | Replace an existing serverless function      |
| `save_function_index`        | Replace and compile a function's source code |
| `save_function_dependencies` | Install npm packages for a function          |
| `list_env_vars`              | List all environment variables               |
| `insert_env_var`             | Create an environment variable               |
| `update_env_var`             | Update an existing environment variable      |
| `list_secrets`               | List all secrets                             |
| `insert_secret`              | Create a secret                              |
| `update_secret`              | Update an existing secret                    |

### Debug

| Tool                       | Description                                |
| -------------------------- | ------------------------------------------ |
| `list_bucket_data_profile` | Profile bucket data for debugging          |
| `list_user_profile`        | Profile user data for debugging            |
| `list_function_logs`       | Get function execution logs with filtering |

### Auditing

| Tool              | Description                              |
| ----------------- | ---------------------------------------- |
| `list_activities` | Query activity/audit logs with filtering |

### Storage

| Tool                    | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `list_storage_objects`  | List storage objects with filtering and pagination |
| `insert_storage_object` | Create a storage object                            |
| `update_storage_object` | Replace an existing storage object                 |
| `rename_storage_object` | Rename a storage object                            |

## License

ISC
