# SVGMaker MCP - Generations Tools

Tools for managing your SVG generations — list, view details, delete, share, and download.

---

## svgmaker_generations_list

Lists your SVG generations with optional filtering and pagination. Returns generation IDs that can be used with other generation tools.

**Tool name:** `svgmaker_generations_list`

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number (1-indexed) |
| `limit` | number | No | — | Items per page (1-100) |
| `type` | string | No | — | Filter by generation type (e.g., "generate", "edit", "convert") |
| `hashtags` | string[] | No | — | Filter by hashtags |
| `categories` | string[] | No | — | Filter by categories |
| `query` | string | No | — | Search query for prompt/description |

### Examples

#### List All Generations
```json
{}
```

#### Paginated with Filter
```json
{
  "page": 2,
  "limit": 10,
  "type": "generate"
}
```

#### Search by Query
```json
{
  "query": "mountain landscape"
}
```

### Response

On success:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Generations (Page 1 of 5, Total: 47):\n- gen_abc123\n- gen_def456\n...\n\nHas Next Page: true"
    }
  ]
}
```

---

## svgmaker_generations_get

Gets detailed information about a specific generation by ID.

**Tool name:** `svgmaker_generations_get`

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | — | Generation ID |

### Examples

```json
{
  "id": "gen_abc123"
}
```

### Response

On success:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Generation Details:\n- ID: gen_abc123\n- Prompt: A mountain landscape\n- Type: generate\n- Quality: high\n- Public: false\n- Hashtags: nature, landscape\n- Categories: scenery"
    }
  ]
}
```

---

## svgmaker_generations_delete

Deletes a generation and its associated files. This action is permanent and cannot be undone. Requires a paid account.

**Tool name:** `svgmaker_generations_delete`

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | — | Generation ID |

### Examples

```json
{
  "id": "gen_abc123"
}
```

### Response

On success:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Generation gen_abc123 deleted successfully."
    }
  ]
}
```

---

## svgmaker_generations_share

Shares a generation by making it publicly accessible. Returns the public share URL.

**Tool name:** `svgmaker_generations_share`

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | — | Generation ID |

### Examples

```json
{
  "id": "gen_abc123"
}
```

### Response

On success:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Generation shared successfully.\n- Public: true\n- Share URL: https://svgmaker.io/share/gen_abc123"
    }
  ]
}
```

---

## svgmaker_generations_download

Downloads a generation in the specified format and saves it to a local file. Requires a paid account.

**Tool name:** `svgmaker_generations_download`

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | — | Generation ID |
| `output_path` | string | Yes | — | Absolute file path where the downloaded file will be saved |
| `format` | `"svg"` \| `"webp"` \| `"png"` \| `"svg-optimized"` \| `"svgz"` | No | `"webp"` | Download format |
| `optimize` | boolean | No | — | Optimize before compressing (only for svgz format) |

### Examples

#### Download as SVG
```json
{
  "id": "gen_abc123",
  "output_path": "/Users/username/Documents/my-generation.svg",
  "format": "svg"
}
```

#### Download as PNG
```json
{
  "id": "gen_abc123",
  "output_path": "/Users/username/Documents/my-generation.png",
  "format": "png"
}
```

#### Download as Optimized SVGZ
```json
{
  "id": "gen_abc123",
  "output_path": "/Users/username/Documents/my-generation.svgz",
  "format": "svgz",
  "optimize": true
}
```

### Response

On success:
```json
{
  "content": [
    {
      "type": "text",
      "text": "File downloaded successfully: /Users/username/Documents/my-generation.svg (format: svg)"
    }
  ]
}
```

---

## Error Handling

Common errors:
- Generation ID not found
- Invalid or empty generation ID
- Invalid output path (download tool)
- Permission denied for delete/download (free account)
- API rate limits
- Network issues
- Invalid or expired API key

Each error returns a descriptive message to help diagnose the issue.

On error:
```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "Error [action]: [error message]"
    }
  ]
}
```
