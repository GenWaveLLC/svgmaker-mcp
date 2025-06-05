import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { logToFile } from './logUtils.js';

export interface ProgressConfig {
  server: Server;
  progressToken?: string | number;
  totalSteps: number;
  messages: {
    initial: string;
    preparing: string;
    processing: string;
    saving: string;
    complete: string;
  };
}

export class ProgressManager {
  private server: Server;
  private progressToken?: string | number;
  private totalSteps: number;
  private currentStep: number = 0;
  private messages: ProgressConfig['messages'];
  private progressInterval: NodeJS.Timeout | null = null;
  private currentProgress: number = 0;

  constructor(config: ProgressConfig) {
    this.server = config.server;
    this.progressToken = config.progressToken;
    this.totalSteps = config.totalSteps;
    this.messages = config.messages;

    // Log progress token availability
    logToFile(`Progress token received: ${this.progressToken !== undefined ? 'YES' : 'NO'}`);
    if (this.progressToken !== undefined) {
      logToFile(`Progress token value: ${JSON.stringify(this.progressToken)}`);
    }
  }

  async sendInitialProgress(): Promise<void> {
    this.currentStep = 0;
    if (this.progressToken !== undefined) {
      logToFile(`Sending initial progress notification`);
      await this.server.notification({
        method: 'notifications/progress',
        params: {
          progress: this.currentStep,
          total: this.totalSteps,
          progressToken: this.progressToken,
          message: this.messages.initial,
        },
      });
    }
  }

  async sendPreparingProgress(): Promise<void> {
    this.currentStep = 1;
    if (this.progressToken !== undefined) {
      logToFile(`Sending progress update: step ${this.currentStep}/${this.totalSteps}`);
      await this.server.notification({
        method: 'notifications/progress',
        params: {
          progress: this.currentStep,
          total: this.totalSteps,
          progressToken: this.progressToken,
          message: this.messages.preparing,
        },
      });
    }
  }

  async startProcessingProgress(): Promise<void> {
    this.currentProgress = 2;
    if (this.progressToken !== undefined) {
      logToFile(
        `Sending progress update: step ${this.currentProgress}/${this.totalSteps} - Starting API call`
      );
      await this.server.notification({
        method: 'notifications/progress',
        params: {
          progress: this.currentProgress,
          total: this.totalSteps,
          progressToken: this.progressToken,
          message: this.messages.processing,
        },
      });

      // Set up periodic progress notifications during API call
      this.progressInterval = setInterval(async () => {
        // Gradually reduce increment size as we get closer to 3
        if (this.currentProgress < 2.9) {
          this.currentProgress += 0.1;
        } else if (this.currentProgress < 2.99) {
          this.currentProgress += 0.01;
        } else if (this.currentProgress < 2.999) {
          this.currentProgress += 0.001;
        }

        // Round to avoid floating point precision issues
        this.currentProgress = Math.round(this.currentProgress * 1000) / 1000;

        logToFile(
          `Sending periodic progress update: ${this.currentProgress}/${this.totalSteps} - Processing...`
        );
        await this.server
          .notification({
            method: 'notifications/progress',
            params: {
              progress: this.currentProgress,
              total: this.totalSteps,
              progressToken: this.progressToken,
              message: this.messages.processing,
            },
          })
          .catch((error) => {
            logToFile(`Error sending progress notification: ${error.message}`);
          });
      }, 5000); // Send notification every 5 seconds
    }
  }

  stopProcessingProgress(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  async sendSavingProgress(): Promise<void> {
    this.stopProcessingProgress(); // Ensure interval is cleared
    this.currentStep = 3;
    if (this.progressToken !== undefined) {
      logToFile(
        `Sending progress update: step ${this.currentStep}/${this.totalSteps} - API call complete`
      );
      await this.server.notification({
        method: 'notifications/progress',
        params: {
          progress: this.currentStep,
          total: this.totalSteps,
          progressToken: this.progressToken,
          message: this.messages.saving,
        },
      });
    }
  }

  async sendFinalProgress(): Promise<void> {
    this.currentStep = this.totalSteps;
    if (this.progressToken !== undefined) {
      logToFile(`Sending final progress notification: step ${this.currentStep}/${this.totalSteps}`);
      await this.server.notification({
        method: 'notifications/progress',
        params: {
          progress: this.currentStep,
          total: this.totalSteps,
          progressToken: this.progressToken,
          message: this.messages.complete,
        },
      });
    }
  }

  // Cleanup method to ensure interval is cleared
  cleanup(): void {
    this.stopProcessingProgress();
  }
}

// Convenience function for simple progress tracking without periodic updates
export async function sendSimpleProgress(
  server: Server,
  progressToken: string | number | undefined,
  step: number,
  total: number,
  message?: string
): Promise<void> {
  if (progressToken !== undefined) {
    logToFile(`Sending progress update: step ${step}/${total}${message ? ` - ${message}` : ''}`);
    await server.notification({
      method: 'notifications/progress',
      params: {
        progress: step,
        total,
        progressToken,
        message,
      },
    });
  }
}
