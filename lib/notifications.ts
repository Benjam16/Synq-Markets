/**
 * Notification creation utility
 * Use this to create notifications from anywhere in the application
 */

import { query } from "@/lib/db";

export type NotificationType = 'risk' | 'trade' | 'system' | 'market' | 'challenge';

export interface NotificationData {
  tradeId?: number;
  marketId?: string;
  challengeId?: number;
  drawdownPct?: number;
  [key: string]: any;
}

/**
 * Create a notification for a user
 */
export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
  data?: NotificationData
): Promise<void> {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, message, data ? JSON.stringify(data) : null]
    );
  } catch (error) {
    console.error('[Notifications] Failed to create notification:', error);
    // Don't throw - notifications are non-critical
  }
}

/**
 * Create a risk alert notification
 */
export async function createRiskAlert(
  userId: number,
  message: string,
  drawdownPct: number,
  challengeId?: number
): Promise<void> {
  await createNotification(
    userId,
    'risk',
    'Risk Alert',
    message,
    {
      drawdownPct,
      challengeId,
    }
  );
}

/**
 * Create a trade confirmation notification
 */
export async function createTradeNotification(
  userId: number,
  side: 'yes' | 'no',
  marketName: string,
  quantity: number,
  price: number,
  tradeId: number
): Promise<void> {
  await createNotification(
    userId,
    'trade',
    'Trade Executed',
    `${side.toUpperCase()} ${quantity} @ $${price.toFixed(4)} on ${marketName}`,
    {
      tradeId,
      side,
      quantity,
      price,
      marketName,
    }
  );
}

/**
 * Create a challenge status notification
 */
export async function createChallengeNotification(
  userId: number,
  status: 'passed' | 'failed',
  message: string,
  challengeId: number
): Promise<void> {
  await createNotification(
    userId,
    'challenge',
    status === 'passed' ? 'Challenge Passed!' : 'Challenge Failed',
    message,
    {
      challengeId,
      status,
    }
  );
}

/**
 * Create a market resolution notification
 */
export async function createMarketResolutionNotification(
  userId: number,
  marketName: string,
  outcome: 'yes' | 'no',
  marketId: string
): Promise<void> {
  await createNotification(
    userId,
    'market',
    'Market Resolved',
    `${marketName} resolved as ${outcome.toUpperCase()}`,
    {
      marketId,
      outcome,
      marketName,
    }
  );
}
