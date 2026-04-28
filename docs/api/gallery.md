# SVGMaker MCP - Gallery Tools

Tools for browsing the public SVGMaker gallery — list items, view details, and download.

---

## svgmaker_gallery_list

Browse the public SVGMaker gallery with optional filtering and pagination. Returns gallery item IDs that can be used with other gallery tools.

**Tool name:** `svgmaker_gallery_list`

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number (1-indexed) |
| `limit` | number | No | — | Items per page (1-100) |
| `type` | string | No | — | Filter by generation type (e.g., "generate", "edit", "convert") |
| `hashtags` | string[] | No | — | Filter by hashtags |
| `categories` | string[] | No | — | Filter by categories |
| `query` | string | No | — | Search query for prompt/description |
| `pro` | string | No | — | Filter for pro images. Pass "true" to filter |
| `gold` | string | No | — | Filter for gold images. Pass "true" to filter |

### Examples

#### Browse All
```json
{}
```

#### Paginated with Filters
```json
{
  "page": 1,
  "limit": 10,
  "type": "generate",
  "pro": "true"
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
      "text": "Gallery (Page 1 of 12, Total: 115):\n- gal_abc123\n- gal_def456\n...\n\nHas Next Page: true"
    }
  ]
}
```

---

## svgmaker_gallery_get

Gets detailed information about a specific gallery item by ID.

**Tool name:** `svgmaker_gallery_get`

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | — | Gallery item ID |

### Examples

```json
{
  "id": "gal_abc123"
}
```

### Response

On success:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Gallery Item Details:\n- ID: gal_abc123\n- Prompt: A mountain landscape\n- Type: generate\n- Quality: high\n- Public: true\n- Hashtags: nature, landscape\n- Categories: scenery"
    }
  ]
}
```

---

## svgmaker_gallery_download

Downloads a gallery item in the specified format and saves it to a local file. Costs 1 credit for SVG formats (svg, svg-optimized, svgz), 0 credits for WebP/PNG.

**Tool name:** `svgmaker_gallery_download`

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | — | Gallery item ID |
| `output_path` | string | Yes | — | Absolute file path where the downloaded file will be saved |
| `format` | `"svg"` \| `"webp"` \| `"png"` \| `"svg-optimized"` \| `"svgz"` | No | `"webp"` | Download format |
| `optimize` | boolean | No | — | Optimize before compressing (only for svgz format) |

### Examples

#### Download as SVG
```json
{
  "id": "gal_abc123",
  "output_path": "/Users/username/Documents/gallery-item.svg",
  "format": "svg"
}
```

#### Download as PNG
```json
{
  "id": "gal_abc123",
  "output_path": "/Users/username/Documents/gallery-item.png",
  "format": "png"
}
```

### Response

On success:
```json
{
  "content": [
    {
      "type": "text",
      "text": "File downloaded successfully: /Users/username/Documents/gallery-item.svg (format: svg)\nNote: SVG formats cost 1 credit per download. WebP/PNG are free."
    }
  ]
}
```

---

## svgmaker_gallery_preview

Previews a gallery item by returning the image directly in the chat context as a PNG image. Use this to visually inspect a gallery item without saving it to disk.

**Tool name:** `svgmaker_gallery_preview`

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | — | Gallery item ID |

### Examples

```json
{
  "id": "gal_abc123"
}
```

### Response

On success, returns an image content block:
```json
{
  "content": [
    {
      "type": "image",
      "data": "<base64-encoded PNG>",
      "mimeType": "image/png"
    }
  ]
}
```

---

## Error Handling

Common errors:
- Gallery item ID not found
- Invalid or empty gallery item ID
- Invalid output path (download tool)
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
