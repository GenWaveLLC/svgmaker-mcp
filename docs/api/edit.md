# SVGMaker MCP - Edit Tool

Edits existing SVG/image files based on text prompts using the SVGMaker API.

**Tool name:** `svgmaker_edit`

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `input_path` | string | Yes | — | Absolute file path to the image/SVG to edit |
| `prompt` | string | Yes | — | Detailed instructions for how to modify the image |
| `output_path` | string | Yes | — | Absolute file path where the edited SVG will be saved (must end with .svg) |
| `quality` | `"low"` \| `"medium"` \| `"high"` | No | `"medium"` | Quality level. low (fast, basic edits), medium (balanced), high (best quality, forces square aspect ratio) |
| `aspectRatio` | `"auto"` \| `"square"` \| `"portrait"` \| `"landscape"` | No | `"auto"` | Aspect ratio for the edited SVG. If not specified, AI determines the best ratio |
| `background` | `"auto"` \| `"transparent"` \| `"opaque"` | No | `"auto"` | Background style. auto (AI determines), transparent (preserves transparency), opaque (solid background) |
| `style` | `"flat"` \| `"line_art"` \| `"engraving"` \| `"linocut"` \| `"silhouette"` \| `"isometric"` \| `"cartoon"` \| `"ghibli"` | No | — | Art style for the edited SVG |
| `color_mode` | `"full_color"` \| `"monochrome"` \| `"few_colors"` | No | — | Color scheme. full_color (wide palette), monochrome (single color/shades), few_colors (limited palette) |
| `image_complexity` | `"icon"` \| `"illustration"` \| `"scene"` | No | — | Complexity level. icon (simple), illustration (moderate), scene (complex, full composition) |
| `composition` | `"centered_object"` \| `"repeating_pattern"` \| `"full_scene"` \| `"objects_in_grid"` | No | — | Layout composition for the edited SVG |
| `text_style` | `"only_title"` \| `"embedded_text"` | No | — | Text handling. only_title (heading text), embedded_text (text integrated into design) |

### Style Parameters

The `style`, `color_mode`, `image_complexity`, `composition`, and `text_style` parameters are style parameters that give fine-grained control over the edited output. They are combined into `styleParams` before being sent to the SVGMaker API. Only specify these when the user explicitly requests a specific style.

## Progress Notifications

The tool sends progress updates every 5 seconds:

1. **Initializing** (0%) — `"Initializing SVG editing..."`
2. **Preparing** (25%) — `"Preparing image for editing..."`
3. **Processing** (25-99%) — `"AI is editing your SVG..."` (updates periodically)
4. **Saving** (99%) — `"Saving edited SVG file..."`
5. **Complete** (100%) — `"SVG editing complete!"`

## Examples

### Basic Edit
```json
{
  "input_path": "/Users/username/Documents/original.svg",
  "prompt": "Make it more vibrant and add a border",
  "output_path": "/Users/username/Documents/edited.svg"
}
```

### High Quality Edit with Transparency
```json
{
  "input_path": "/Users/username/Documents/logo.png",
  "prompt": "Convert to minimalist style and make background transparent",
  "output_path": "/Users/username/Documents/minimal_logo.svg",
  "quality": "high",
  "aspectRatio": "square",
  "background": "transparent"
}
```

### Style Transformation with Style Parameters
```json
{
  "input_path": "/Users/username/Documents/image.jpg",
  "prompt": "Transform into cartoon style with bold colors",
  "output_path": "/Users/username/Documents/cartoon.svg",
  "quality": "high",
  "style": "cartoon",
  "color_mode": "full_color",
  "background": "opaque"
}
```

### Convert to Line Art
```json
{
  "input_path": "/Users/username/Documents/photo.png",
  "prompt": "Convert to a clean line art illustration",
  "output_path": "/Users/username/Documents/line_art.svg",
  "style": "line_art",
  "color_mode": "monochrome",
  "image_complexity": "illustration"
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
- Invalid or non-absolute input/output file paths
- Unsupported input file formats
- Missing file permissions
- API rate limits
- Network issues
- SVGMaker API did not return SVG content

Each error returns a descriptive message to help diagnose the issue.

## Input File Support

Supported input formats:
- SVG files (.svg)
- PNG images (.png)
- JPEG images (.jpg, .jpeg)
- Other common image formats supported by the SVGMaker API
