import { GraphQLError } from 'graphql';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

interface JwtPayload {
  _id: unknown;
  username: string;
  email: string;
}

interface Context {
  token?: string;
}

export const authenticateToken = (context: Context) => {
  const token = context.token;

  if (!token) {
    throw new GraphQLError('Authentication token is required', {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 }
      }
    });
  }

  try {
    const secretKey = process.env.JWT_SECRET_KEY;
    if (!secretKey) {
      throw new GraphQLError('JWT secret key is not configured', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
          http: { status: 500 }
        }
      });
    }

    const user = jwt.verify(token, secretKey) as JwtPayload;
    return user;
  } catch (err) {
    throw new GraphQLError('Invalid or expired token', {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 }
      }
    });
  }
};

export const signToken = (username: string, email: string, _id: unknown) => {
  const payload = { username, email, _id };
  const secretKey = process.env.JWT_SECRET_KEY;

  if (!secretKey) {
    throw new GraphQLError('JWT secret key is not configured', {
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
        http: { status: 500 }
      }
    });
  }

  return jwt.sign(payload, secretKey, { expiresIn: '1h' });
};