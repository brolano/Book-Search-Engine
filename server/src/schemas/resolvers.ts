import { GraphQLError } from 'graphql';
import User  from '../models/User.js';
import { signToken } from '../services/auth.js';

interface BookInput {
  authors: string[];
  description: string;
  title: string;
  bookId: string;
  image?: string;
  link?: string;
}

interface UserContext {
  user?: {
    _id: string;
    username: string;
    email: string;
  };
}

const resolvers = {
  // Add a resolver for the bookCount field on the User type
  User: {
    bookCount: (parent: any) => parent.savedBooks.length || 0,
  },

  Query: {
    // Get the logged in user
    me: async (_parent: any, _args: any, context: UserContext) => {
      if (!context.user) {
        throw new GraphQLError('Not logged in', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        const userData = await User.findById(context.user._id);
        if (!userData) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' }
          });
        }
        return userData;
      } catch (err) {
        throw new GraphQLError('Error finding user', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    }
  },

  Mutation: {
    // Create a new user
    addUser: async (
      _parent: any,
      { username, email, password }: { username: string; email: string; password: string }
    ) => {
      try {
        const user = await User.create({ username, email, password });

        const token = signToken(user.username, user.email, user._id);
        return { token, user };
      } catch (err) {
        throw new GraphQLError('Error creating user', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }
    },

    // Login a user
    login: async (
      _parent: any,
      { email, password }: { email: string; password: string }
    ) => {
      try {
        const user = await User.findOne({ email });

        if (!user) {
          throw new GraphQLError('No user found with this email address', {
            extensions: { code: 'UNAUTHENTICATED' }
          });
        }

        const correctPw = await user.isCorrectPassword(password);

        if (!correctPw) {
          throw new GraphQLError('Incorrect password', {
            extensions: { code: 'UNAUTHENTICATED' }
          });
        }

        const token = signToken(user.username, user.email, user._id);
        return { token, user };
      } catch (err) {
        throw new GraphQLError('Error logging in', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    },

    // Save a book to a user's savedBooks array
    saveBook: async (
      _parent: any,
      { bookData }: { bookData: BookInput },
      context: UserContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('You need to be logged in!', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        const updatedUser = await User.findByIdAndUpdate(
          context.user._id,
          { $addToSet: { savedBooks: bookData } },
          { new: true, runValidators: true }
        );

        if (!updatedUser) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' }
          });
        }

        return updatedUser;
      } catch (err) {
        throw new GraphQLError('Error saving book', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    },

    // Remove a book from savedBooks
    removeBook: async (
      _parent: any,
      { bookId }: { bookId: string },
      context: UserContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('You need to be logged in!', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        const updatedUser = await User.findByIdAndUpdate(
          context.user._id,
          { $pull: { savedBooks: { bookId } } },
          { new: true }
        );

        if (!updatedUser) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' }
          });
        }

        return updatedUser;
      } catch (err) {
        throw new GraphQLError('Error removing book', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    }
  }
};

export default resolvers;