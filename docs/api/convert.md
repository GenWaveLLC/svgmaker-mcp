# SVGMaker MCP - AI Vectorize Tool

Converts raster images to SVG format using AI-powered vectorization via the SVGMaker API. The AI analyzes the image and recreates it as clean, scalable vector graphics.

**Tool name:** `svgmaker_convert`

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `input` | string | Yes* | — | Image source: a local absolute file path (stdio transport only) or an `https://` URL. See [Input sources](#input-sources) |
| `input_path` | string | No* | — | Accepted alias for `input`, restricted to a local absolute file path |
| `output_path` | string | No | — | Absolute file path where the SVG will be saved (must end with .svg). When omitted, a hosted URL is returned. Not supported over the HTTPS transport |

\* Exactly one of `input` or `input_path` must be provided. `input` is preferred; `input_path` remains accepted for backwards compatibility.

### Input sources

| Value | stdio | HTTPS |
|-------|-------|-------|
| `/abs/path.png` or `file:///abs/path.png` | Read from disk and uploaded | Rejected — call `svgmaker_upload` first |
| `https://…` | Fetched by the SVGMaker API | Fetched by the SVGMaker API |
| `gen_abc123` | Rejected | Rejected |

Unlike `svgmaker_edit` and `svgmaker_remove_background`, convert does not accept generation ids. The API resolves a generation to a downscaled raster preview, so vectorizing one produces a strictly worse version of an SVG you already own. The tool fails locally with:

> Generation ids are not supported for convert, because it would re-vectorize a downscaled preview. Pass a local file path (stdio only) or an https:// URL.

The MCP server never downloads image bytes for a URL — the URL is handed to the SVGMaker API, which fetches it.

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
- A generation id passed as `input` (not supported for convert)
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

## Cloud Storage

All conversions are automatically saved to cloud storage (`storage: true`). This means every converted SVG gets a generation ID that can be used with preview, download, edit (via `generation_id`), share, and delete tools.

## Notes

- The AI vectorize tool automatically determines the best settings for SVG conversion based on the input image
- Output files are always in SVG format
- For more control over the conversion process, consider using the edit tool with style parameters
