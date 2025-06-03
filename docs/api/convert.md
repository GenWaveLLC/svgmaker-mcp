# SVGMaker MCP - Convert Tool

Converts image files to SVG format using the SVGMaker API.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input_path` | string | Yes | Absolute file path to the image file to convert |
| `output_path` | string | Yes | Local file path where the SVG will be saved (must end with .svg) |

## Progress Notifications

The tool sends progress updates every 5 seconds:

1. Start (0%):
   ```
   "Starting image conversion..." (0%)
   ```

2. Processing (25%, 50%, 75%):
   ```
   "Converting image... 25%"
   "Converting image... 50%"
   "Converting image... 75%"
   ```

3. Completion (100%):
   ```
   "Image conversion complete!" (100%)
   ```

## Examples

### Basic Conversion
```json
{
  "input_path": "/absolute/path/to/image.png",
  "output_path": "./converted.svg"
}
```

### Converting from JPEG
```json
{
  "input_path": "/absolute/path/to/photo.jpg",
  "output_path": "./vector_art.svg"
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
- Invalid input/output file paths
- Unsupported input file formats
- Missing file permissions
- API rate limits
- Network issues
- Invalid or corrupted input images

Each error returns a descriptive message to help diagnose the issue.

## Input File Support

Supported input formats:
- PNG images (.png)
- JPEG images (.jpg, .jpeg)
- Other common bitmap image formats supported by the SVGMaker API

## Notes

- The convert tool automatically determines the best settings for SVG conversion based on the input image
- Output files are always in SVG format
- For more control over the conversion process, consider using the edit tool with a "convert to SVG" style prompt
