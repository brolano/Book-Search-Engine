import express from 'express';
import path from 'node:path';
import { ApolloServer } from '@apollo/server';
import { GraphQLFormattedError } from 'graphql';
import { expressMiddleware } from '@apollo/server/express4';
import http from 'http';
import cors from 'cors';
import db from './config/connection.js';
import { authenticateToken } from './services/auth.js';

// Import schema definitions and resolvers
import typeDefs from './schemas/typeDefs.js';
import resolvers from './schemas/resolvers.js';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';

interface UserContext {
  user?: {
    _id: string;
    username: string;
    email: string;
  };
}

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Create Apollo Server
const server = new ApolloServer<UserContext>({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  formatError: (formattedError: GraphQLFormattedError): GraphQLFormattedError => {
    console.error('GraphQL Error:', formattedError);
    
    // Create a base error object that matches the required shape
    const error: GraphQLFormattedError = {
      message: formattedError.message,
      // Only include path if it exists
      ...(formattedError.path && { path: formattedError.path }),
      // Ensure extensions always exists
      extensions: formattedError.extensions || {
        code: 'INTERNAL_SERVER_ERROR'
      }
    };

    return error;
  },
});

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Initialize the database and start Apollo Server
db.once('open', async () => {
  // Ensure the server is started before using expressMiddleware
  await server.start();

  // Apply Apollo Server middleware
  app.use(
    '/graphql',
    cors({
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.CLIENT_URL 
        : 'http://localhost:3000',
      credentials: true
    }),
    express.json(), // Make sure this comes before GraphQL middleware
    expressMiddleware(server, {
      context: async ({ req }) => {
        try {
          const token = req.headers.authorization?.split(' ')[1];
          if (!token) {
            return { user: null };
          }
          const user = authenticateToken({ token });
          return { user };
        } catch (error) {
          return { user: null };
        }
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

  // Start the HTTP server after middleware is applied
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
    console.log(`🎯 GraphQL endpoint: http://localhost:${PORT}/graphql`);
  });
});

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});
