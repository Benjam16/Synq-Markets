/**
 * Terminal SSE (Server-Sent Events) Stream
 * 
 * Provides a persistent connection that pushes terminal updates
 * to the client every 3 seconds. This gives the "fireplace" feel
 * while being Vercel-compatible.
 * 
 * GET /api/terminal/stream
 * 
 * Returns: text/event-stream
 */

import { NextRequest } from 'next/server';
import { getTerminalSnapshot } from '@/lib/terminal-engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // SSE needs Node.js runtime

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let iterations = 0;
      const MAX_ITERATIONS = 30; // ~90 seconds (30 * 3s), then client reconnects

      const pushUpdate = async () => {
        try {
          const snapshot = await getTerminalSnapshot();

          // Send as SSE event
          const data = `data: ${JSON.stringify(snapshot)}\n\n`;
          controller.enqueue(encoder.encode(data));

          iterations++;

          if (iterations >= MAX_ITERATIONS) {
            // Close after ~90s to avoid Vercel timeout
            controller.close();
            return;
          }

          // Schedule next update in 3 seconds
          setTimeout(pushUpdate, 3000);
        } catch (err) {
          console.error('[Terminal SSE] Error:', err);
          const errorData = `data: ${JSON.stringify({ error: 'Stream error' })}\n\n`;
          controller.enqueue(encoder.encode(errorData));

          // Retry after 5 seconds on error
          setTimeout(pushUpdate, 5000);
        }
      };

      // Start pushing updates
      pushUpdate();
    },

    cancel() {
      // Client disconnected
      console.log('[Terminal SSE] Client disconnected');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
