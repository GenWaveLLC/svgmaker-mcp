# SVGMaker MCP - Edit Tool

Edits existing SVG/image files based on text prompts using the SVGMaker API.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input_path` | string | Yes | Absolute file path to the image/SVG to edit |
| `prompt` | string | Yes | Text description of the edits to make |
| `output_path` | string | Yes | Local file path where the edited SVG will be saved (must end with .svg) |
| `quality` | "low" \| "medium" \| "high" | No | Quality level affecting aspect ratio. low/medium use 'auto', high uses 'square' by default |
| `aspectRatio` | "auto" \| "square" \| "portrait" \| "landscape" | No | Override the default aspect ratio |
| `background` | "auto" \| "transparent" \| "opaque" | No | Background type for the edited SVG |

## Progress Notifications

The tool sends progress updates every 5 seconds:

1. Start (0%):
   ```
   "Starting SVG edit..." (0%)
   ```

2. Processing (25%, 50%, 75%):
   ```
   "Editing SVG... 25%"
   "Editing SVG... 50%"
   "Editing SVG... 75%"
   ```

3. Completion (100%):
   ```
   "SVG edit complete!" (100%)
   ```

## Examples

### Basic Edit
```json
{
  "input_path": "/absolute/path/to/original.svg",
  "prompt": "Make it more vibrant and add a border",
  "output_path": "./edited.svg"
}
```

### High Quality Edit with Transparency
```json
{
  "input_path": "/absolute/path/to/logo.png",
  "prompt": "Convert to minimalist style and make background transparent",
  "output_path": "./minimal_logo.svg",
  "quality": "high",
  "aspectRatio": "square",
  "background": "transparent"
}
```

### Style Transformation
```json
{
  "input_path": "/absolute/path/to/image.jpg",
  "prompt": "Transform into cartoon style with bold colors",
  "output_path": "./cartoon.svg",
  "quality": "high",
  "background": "opaque"
}
```

## Response

On success:
```json
{
  "content": [
    {
      "type": "text",
      "text": "SVG edited successfully: /path/to/output.svg"
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
      "text": "Error editing SVG: [error message]"
    }
  ]
}
```

## Error Handling

Common errors:
- Invalid input/output file paths
- Unsupported input file formats
- Missing file permissions
- API rate limits
- Network issues
- Invalid SVG content

Each error returns a descriptive message to help diagnose the issue.

## Input File Support

Supported input formats:
- SVG files (.svg)
- PNG images (.png)
- JPEG images (.jpg, .jpeg)
- Other common image formats supported by the SVGMaker API
