# @spica/mcp

MCP (Model Context Protocol) server that enables AI agents to interact with Spica servers — manage databases, serverless functions, storage, authentication, auditing, debugging and version control.

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

| Tool              | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `list_apikeys`    | List all API keys                                      |
| `save_apikey`     | Create or update an API key                            |
| `list_identities` | List identities with optional filtering and pagination |
| `save_identity`   | Create or update an identity                           |
| `list_policies`   | List all policies                                      |
| `save_policy`     | Create or update a policy                              |

### Database

| Tool               | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `list_buckets`     | List all bucket schemas                                                     |
| `save_bucket`      | Create or update a bucket schema                                            |
| `list_bucket_data` | Query documents with filtering, pagination, sorting and relation resolution |
| `save_bucket_data` | Create or update a document in a bucket                                     |

### Development

| Tool                         | Description                                  |
| ---------------------------- | -------------------------------------------- |
| `list_functions`             | List all serverless functions                |
| `get_function_index`         | Get the source code of a function            |
| `get_function_dependencies`  | Get installed dependencies for a function    |
| `save_function`              | Create or update a serverless function       |
| `save_function_index`        | Replace and compile a function's source code |
| `save_function_dependencies` | Install npm packages for a function          |

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
| `save_storage_object`   | Create or update a storage object                  |
| `rename_storage_object` | Rename a storage object                            |

### Version Control

| Tool                             | Description                             |
| -------------------------------- | --------------------------------------- |
| `list_versioncontrol_commands`   | List available version control commands |
| `execute_versioncontrol_command` | Execute a version control command       |

## License

ISC
