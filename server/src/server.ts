import express from 'express';
import path from 'node:path';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import http from 'http';
import cors from 'cors';
import db from './config/connection.js';

// Import schema definitions and resolvers
import typeDefs from './schemas/typeDefs.js';
import resolvers from './schemas/resolvers.js';

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Apply Apollo Server middleware
app.use(
  '/graphql',
  cors<cors.CorsRequest>(), // Enable CORS
  expressMiddleware(server, {
    context: async ({ req }) => {
      // Extract token from Authorization header and pass to context
      const token = req.headers.authorization?.split(' ')[1];
      return { token };
    },
  })
);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  // Serve index.html for all routes in production
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Initialize the database and start Apollo Server
db.once('open', async () => {
  await server.start();
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
    console.log(`🎯 GraphQL endpoint: http://localhost:${PORT}/graphql`);
  });
});

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});
