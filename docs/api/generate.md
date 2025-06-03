# SVGMaker MCP - Generate Tool

Generates SVG images from text prompts using the SVGMaker API.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Text description of the SVG to generate |
| `output_path` | string | Yes | Local file path where the SVG will be saved (must end with .svg) |
| `quality` | "low" \| "medium" \| "high" | No | Quality level affecting aspect ratio. low/medium use 'auto', high uses 'square' by default |
| `aspectRatio` | "square" \| "portrait" \| "landscape" | No | Override the default aspect ratio |
| `background` | "auto" \| "transparent" \| "opaque" | No | Background type for the generated SVG |

## Progress Notifications

The tool sends progress updates every 5 seconds:

1. Start (0%):
   ```
   "Starting SVG generation..." (0%)
   ```

2. Processing (25%, 50%, 75%):
   ```
   "Generating SVG... 25%"
   "Generating SVG... 50%"
   "Generating SVG... 75%"
   ```

3. Completion (100%):
   ```
   "SVG generation complete!" (100%)
   ```

## Examples

### Basic Generation
```json
{
  "prompt": "A simple blue circle with a red border",
  "output_path": "./circle.svg"
}
```

### High Quality with Square Aspect Ratio
```json
{
  "prompt": "A detailed mountain landscape with sun",
  "output_path": "./landscape.svg",
  "quality": "high",
  "aspectRatio": "square"
}
```

### With Custom Background
```json
{
  "prompt": "A minimalist logo design",
  "output_path": "./logo.svg",
  "quality": "high",
  "background": "transparent"
}
```

## Response

On success:
```json
{
  "content": [
    {
      "type": "text",
      "text": "SVG generated successfully: /path/to/output.svg"
    }
  ]
}
```

On error:
```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "Error generating SVG: [error message]"
    }
  ]
}
```

## Error Handling

Common errors:
- Invalid file paths
- Missing permissions
- API rate limits
- Network issues
- Invalid SVG content

Each error returns a descriptive message to help diagnose the issue.
