# SVGMaker MCP - AI Vectorize Tool

Converts raster images to SVG format using AI-powered vectorization via the SVGMaker API. The AI analyzes the image and recreates it as clean, scalable vector graphics.

**Tool name:** `svgmaker_ai_vectorize`

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `input_path` | string | Yes | — | Absolute file path to the raster image file to convert |
| `output_path` | string | Yes | — | Absolute file path where the SVG will be saved (must end with .svg) |

## Progress Notifications

The tool sends progress updates every 5 seconds:

1. **Initializing** (0%) — `"Initializing image conversion..."`
2. **Preparing** (25%) — `"Preparing image for conversion..."`
3. **Processing** (25-99%) — `"Converting image to SVG..."` (updates periodically)
4. **Saving** (99%) — `"Saving SVG file..."`
5. **Complete** (100%) — `"Image conversion complete!"`

## Examples

### Basic Conversion
```json
{
  "input_path": "/Users/username/Documents/image.png",
  "output_path": "/Users/username/Documents/converted.svg"
}
```

### Converting from JPEG
```json
{
  "input_path": "/Users/username/Pictures/photo.jpg",
  "output_path": "/Users/username/Documents/vector_art.svg"
}
```

## Response

On success:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Image converted to SVG successfully: /path/to/output.svg"
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
      "text": "Error converting image to SVG: [error message]"
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
- Invalid or corrupted input images
- SVGMaker API did not return SVG content

Each error returns a descriptive message to help diagnose the issue.

## Input File Support

Supported input formats:
- PNG images (.png)
- JPEG images (.jpg, .jpeg)
- GIF images (.gif)
- BMP images (.bmp)
- TIFF images (.tiff)
- WebP images (.webp)
- Other common bitmap image formats supported by the SVGMaker API

## Notes

- The AI vectorize tool automatically determines the best settings for SVG conversion based on the input image
- Output files are always in SVG format
- For more control over the conversion process, consider using the edit tool with style parameters
