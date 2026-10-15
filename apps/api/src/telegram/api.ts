/** The few Bot API methods this system uses (https://core.telegram.org/bots/api). Plain text only: no parse mode. */
export interface TelegramApi {
  /** Sends a message, as a reply to `replyTo` if given, and returns the new message's id. */
  sendMessage(chatId: number, text: string, replyTo?: number): Promise<number>;
  editMessageText(chatId: number, messageId: number, text: string): Promise<void>;
  /** Points Telegram at our webhook, with the secret it must send back (R-CAP-2) and message updates only. */
  setWebhook(url: string, secretToken: string): Promise<void>;
}

/**
 * A Bot API call that failed. Its message names the method and Telegram's own description, never the URL: the bot's
 * token is part of every Bot API address.
 */
export class TelegramError extends Error {
  constructor(
    readonly method: string,
    readonly code: number | undefined,
    description: string,
  ) {
    super(`Telegram ${method} failed${code === undefined ? '' : ` (${code})`}: ${description}`);
    this.name = 'TelegramError';
  }
}

interface BotApiAnswer {
  ok: boolean;
  result?: unknown;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number };
}

/**
 * Telegram answers 429 with how long to wait (`retry_after`, in seconds) when we send too fast: both replicas setting
 * the webhook as they start, or a burst of replies. A call waits that long and tries again, a few times and only for
 * short waits; a longer one fails as any other error does.
 */
const RETRIES = 3;
const MAX_RETRY_AFTER_SECONDS = 10;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const createTelegramApi = (
  botToken: string,
  fetchImpl: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = sleep,
): TelegramApi => {
  const call = async (method: string, body: object, attempt = 1): Promise<unknown> => {
    let answer: BotApiAnswer;
    try {
      const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      answer = (await response.json()) as BotApiAnswer;
    } catch (error) {
      // fetch's own errors can carry the address, and with it the token: only their name goes on.
      throw new TelegramError(
        method,
        undefined,
        error instanceof Error ? error.name : 'request failed',
      );
    }
    const retryAfter = answer.parameters?.retry_after;
    if (
      !answer.ok &&
      answer.error_code === 429 &&
      attempt <= RETRIES &&
      retryAfter !== undefined &&
      retryAfter <= MAX_RETRY_AFTER_SECONDS
    ) {
      await wait(retryAfter * 1000);
      return call(method, body, attempt + 1);
    }
    if (!answer.ok) {
      throw new TelegramError(method, answer.error_code, answer.description ?? 'no description');
    }
    return answer.result;
  };

  return {
    sendMessage: async (chatId, text, replyTo) => {
      const result = (await call('sendMessage', {
        chat_id: chatId,
        text,
        link_preview_options: { is_disabled: true },
        ...(replyTo === undefined
          ? {}
          : { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } }),
      })) as { message_id: number };
      return result.message_id;
    },
    editMessageText: async (chatId, messageId, text) => {
      try {
        await call('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text,
          link_preview_options: { is_disabled: true },
        });
      } catch (error) {
        // Editing a message to the text it already has is not a failure.
        if (!(
          error instanceof TelegramError && error.message.includes('message is not modified')
        )) {
          throw error;
        }
      }
    },
    setWebhook: async (url, secretToken) => {
      await call('setWebhook', { url, secret_token: secretToken, allowed_updates: ['message'] });
    },
  };
};
