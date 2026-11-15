// Serves the assistant connector at /mcp (Model Context Protocol, streamable
// HTTP, stateless). Each tool call goes back through this server's own /v1
// endpoints on the loopback address, carrying the visitor's address, so the
// same per-visitor limits apply and the answers are the API's answers.
import { Router, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createConnector, type ApiCall } from './tools.js';

const notAllowed = (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed. Send JSON-RPC requests with POST.' },
    id: null,
  });
};

export function createMcpRouter(): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const base = `http://127.0.0.1:${req.socket.localPort}`;
    const call: ApiCall = async (path) => {
      const reply = await fetch(`${base}${path}`, {
        headers: { Accept: 'application/json', 'X-Forwarded-For': req.ip ?? '' },
      });
      return { status: reply.status, body: await reply.json() };
    };

    const server = createConnector(call);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
      }
    }
  });

  // Stateless: there is no stream to open and no session to end.
  router.get('/', notAllowed);
  router.delete('/', notAllowed);
  return router;
}
