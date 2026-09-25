import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/index';

const app = express();
const PORT = process.env.NODE_ENV === 'production' && process.env.PORT ? Number(process.env.PORT) : 3000;

// Core Middlewares with full CORS support for Vercel frontends
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

// Root & Health Checks for Render deployment
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'placemein-backend',
    architecture: 'MVC',
    framework: 'Express + TypeScript',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'PLACEMEIN CRA Outreach Backend API',
    status: 'online',
    version: '1.0.0',
    docs: 'Available routes mounted under /api/v1',
  });
});

// Mount MVC API Routes
app.use('/api/v1', apiRouter);

// Start Server with Vite or Static
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    if (process.env.GITHUB_ACTIONS) {
      app.get('/', (req, res) => {
        res.redirect('/project-123/');
      });
    }
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use('/project-123', express.static(distPath));
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.json({
          status: 'ok',
          service: 'placemein-backend',
          message: 'Backend API is running. Frontend is deployed on Vercel.',
        });
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Placemein CRA Backend] MVC Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
