# SVGMaker MCP - Account Tools

Tools for retrieving account information and API usage statistics.

---

## svgmaker_account_info

Get account information including email, display name, account type, and available credits.

**Tool name:** `svgmaker_account_info`

### Parameters

No parameters required.

### Examples

#### Get Account Info
```json
{}
```

### Response

On success:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Account info:\n- Email: user@example.com\n- Display Name: Jane Doe\n- Account Type: pro\n- Credits: 250"
    }
  ]
}
```

---

## svgmaker_account_usage

Get API usage statistics with optional date filtering.

**Tool name:** `svgmaker_account_usage`

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `days` | number | No | — | Number of days to look back (positive integer). Cannot be used with start/end |
| `start` | string | No | — | Start date (YYYY-MM-DD). Must be used with end. Cannot be used with days |
| `end` | string | No | — | End date (YYYY-MM-DD). Must be used with start. Cannot be used with days |

### Examples

#### All-Time Usage
```json
{}
```

#### Last 30 Days
```json
{
  "days": 30
}
```

#### Date Range
```json
{
  "start": "2026-01-01",
  "end": "2026-01-31"
}
```

### Response

On success:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Usage summary:\n- Total requests: 142\n- Credits used: 87\n- Period: 2026-01-01 to 2026-01-31"
    }
  ]
}
```

---

## Error Handling

Common errors:
- Invalid date format (must be YYYY-MM-DD)
- `start` used without `end` or vice versa
- `days` used together with `start`/`end`
- `days` must be a positive integer
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
      "text": "Error fetching account usage: [error message]"
    }
  ]
}
```
