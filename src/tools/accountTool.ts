import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TextContent, RequestMeta } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as svgmakerService from '../services/svgmakerService.js';
import { logToFile } from '../utils/logUtils.js';

// ── Account Info Tool ──

const AccountInfoToolInputSchema = z.object({});

export const accountInfoToolDefinition = {
  name: 'svgmaker_account_info',
  description:
    'Retrieves SVGMaker account information including email, display name, account type, and available credits.',
  inputSchema: zodToJsonSchema(AccountInfoToolInputSchema),
};

export async function handleAccountInfoTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  logToFile('========== SVG ACCOUNT INFO TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const result = await svgmakerService.getAccountInfo();

    const text = [
      'Account Information:',
      `- Email: ${result.email}`,
      `- Display Name: ${result.displayName}`,
      `- Account Type: ${result.accountType}`,
      `- Credits: ${result.credits}`,
    ].join('\n');

    return {
      content: [{ type: 'text', text } as TextContent],
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error getting account info: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}

// ── Account Usage Tool ──

const AccountUsageToolInputSchema = z.object({
  days: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Number of days to look back. Cannot be used with start/end.'),
  start: z
    .string()
    .optional()
    .describe('Start date in YYYY-MM-DD format. Must be used with end. Cannot be used with days.'),
  end: z
    .string()
    .optional()
    .describe('End date in YYYY-MM-DD format. Must be used with start. Cannot be used with days.'),
});

export const accountUsageToolDefinition = {
  name: 'svgmaker_account_usage',
  description:
    'Retrieves SVGMaker API usage statistics for the account, including request counts, credits used, success/error rates, and breakdowns by category and day.',
  inputSchema: zodToJsonSchema(AccountUsageToolInputSchema),
};

export async function handleAccountUsageTool(
  server: Server,
  request: { params: { name: string; _meta?: RequestMeta; arguments?: any } }
) {
  logToFile('========== SVG ACCOUNT USAGE TOOL CALLED ==========');
  logToFile(`Arguments: ${JSON.stringify(request.params.arguments, null, 2)}`);

  try {
    const validatedArgs = AccountUsageToolInputSchema.parse(request.params.arguments);

    // Manual validation for constraints that zodToJsonSchema doesn't handle well
    if (
      validatedArgs.days !== undefined &&
      (validatedArgs.start !== undefined || validatedArgs.end !== undefined)
    ) {
      throw new Error(
        'Cannot use "days" together with "start" or "end". Use either "days" or a "start"/"end" date range.'
      );
    }
    if ((validatedArgs.start !== undefined) !== (validatedArgs.end !== undefined)) {
      throw new Error('"start" and "end" must be used together. Provide both or neither.');
    }

    // Build params with only defined fields
    const params: Record<string, any> = {};
    if (validatedArgs.days !== undefined) params.days = validatedArgs.days;
    if (validatedArgs.start !== undefined) params.start = validatedArgs.start;
    if (validatedArgs.end !== undefined) params.end = validatedArgs.end;

    const result = await svgmakerService.getAccountUsage(
      Object.keys(params).length > 0 ? params : undefined
    );

    const lines: string[] = [];

    // Period info
    if (result.period) {
      if (result.period.type === 'days' && result.period.days) {
        lines.push(`Period: Last ${result.period.days} days`);
      } else if (result.period.from && result.period.to) {
        lines.push(`Period: ${result.period.from} to ${result.period.to}`);
      } else {
        lines.push(`Period: All time`);
      }
      lines.push('');
    }

    // Summary
    if (result.summary) {
      const s = result.summary;
      const successRate = s.requests > 0 ? ((s.successCount / s.requests) * 100).toFixed(1) : '0.0';
      lines.push('Summary:');
      lines.push(`- Requests: ${s.requests}`);
      lines.push(`- Credits Used: ${s.creditsUsed}`);
      lines.push(`- Success Count: ${s.successCount}`);
      lines.push(`- Error Count: ${s.errorCount}`);
      lines.push(`- Success Rate: ${successRate}%`);
      lines.push('');
    }

    // By category
    if (result.byCategory && Object.keys(result.byCategory).length > 0) {
      lines.push('By Category:');
      for (const [category, data] of Object.entries(result.byCategory)) {
        const catData = data as any;
        lines.push(
          `  ${category}: ${catData.requests ?? 0} requests, ${catData.creditsUsed ?? 0} credits`
        );
      }
      lines.push('');
    }

    // Daily
    if (result.daily && result.daily.length > 0) {
      lines.push('Daily:');
      for (const day of result.daily as any[]) {
        lines.push(`  ${day.date}: ${day.requests} requests, ${day.credits} credits`);
      }
      lines.push('');
    }

    // All time
    if (result.allTime) {
      const a = result.allTime as any;
      lines.push('All Time:');
      lines.push(`- Total Requests: ${a.requests}`);
      lines.push(`- Total Credits Used: ${a.creditsUsed}`);
      lines.push('');
    }

    const text = lines.join('\n').trimEnd();

    return {
      content: [{ type: 'text', text } as TextContent],
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error getting account usage: ${error.message}`,
        } as TextContent,
      ],
    };
  }
}
