# SVGMaker MCP - Generate Tool

Generates SVG images from text prompts using the SVGMaker API.

**Tool name:** `svgmaker_generate`

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | — | Detailed text description of the SVG to generate. Include style, colors, composition, and key visual elements for best results |
| `output_path` | string | Yes | — | Absolute file path where the SVG will be saved (must end with .svg) |
| `quality` | `"low"` \| `"medium"` \| `"high"` | No | `"medium"` | Quality level. low (fast, basic), medium (balanced), high (best quality, forces square aspect ratio) |
| `aspectRatio` | `"square"` \| `"portrait"` \| `"landscape"` | No | `"auto"` | Aspect ratio for the generated SVG. If not specified, AI determines the best ratio |
| `background` | `"auto"` \| `"transparent"` \| `"opaque"` | No | `"auto"` | Background style. auto (AI determines), transparent (no background), opaque (solid background) |
| `style` | `"flat"` \| `"line_art"` \| `"engraving"` \| `"linocut"` \| `"silhouette"` \| `"isometric"` \| `"cartoon"` \| `"ghibli"` | No | — | Art style for the SVG |
| `color_mode` | `"full_color"` \| `"monochrome"` \| `"few_colors"` | No | — | Color scheme. full_color (wide palette), monochrome (single color/shades), few_colors (limited palette) |
| `image_complexity` | `"icon"` \| `"illustration"` \| `"scene"` | No | — | Complexity level. icon (simple), illustration (moderate), scene (complex, full composition) |
| `composition` | `"centered_object"` \| `"repeating_pattern"` \| `"full_scene"` \| `"objects_in_grid"` | No | — | Layout composition for the generated SVG |
| `text_style` | `"only_title"` \| `"embedded_text"` | No | — | Text handling. only_title (heading text), embedded_text (text integrated into design) |

### Style Parameters

The `style`, `color_mode`, `image_complexity`, `composition`, and `text_style` parameters are style parameters that give fine-grained control over the generated output. They are combined into `styleParams` before being sent to the SVGMaker API. Only specify these when the user explicitly requests a specific style.

## Progress Notifications

The tool sends progress updates every 5 seconds:

1. **Initializing** (0%) — `"Initializing SVG generation..."`
2. **Preparing** (25%) — `"Preparing API request..."`
3. **Processing** (25-99%) — `"AI is creating your SVG..."` (updates periodically)
4. **Saving** (99%) — `"Saving SVG file..."`
5. **Complete** (100%) — `"SVG generation complete!"`

## Examples

### Basic Generation
```json
{
  "prompt": "A simple blue circle with a red border",
  "output_path": "/Users/username/Documents/circle.svg"
}
```

### High Quality with Square Aspect Ratio
```json
{
  "prompt": "A detailed mountain landscape with sun",
  "output_path": "/Users/username/Documents/landscape.svg",
  "quality": "high",
  "aspectRatio": "square"
}
```

### With Custom Background
```json
{
  "prompt": "A minimalist logo design",
  "output_path": "/Users/username/Documents/logo.svg",
  "quality": "high",
  "background": "transparent"
}
```

### With Style Parameters
```json
{
  "prompt": "A cat sitting on a windowsill",
  "output_path": "/Users/username/Documents/cat.svg",
  "quality": "medium",
  "style": "cartoon",
  "color_mode": "full_color",
  "image_complexity": "illustration",
  "composition": "centered_object"
}
```

### Monochrome Icon
```json
{
  "prompt": "A settings gear icon",
  "output_path": "/Users/username/Documents/gear.svg",
  "style": "flat",
  "color_mode": "monochrome",
  "image_complexity": "icon",
  "composition": "centered_object",
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
- Invalid or non-absolute file paths
- Missing write permissions
- API rate limits
- Network issues
- SVGMaker API did not return SVG content

Each error returns a descriptive message to help diagnose the issue.
