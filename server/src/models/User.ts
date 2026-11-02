import mongoose, { Document, Schema, Model } from 'mongoose';

export type UserRole = 'USER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
      index: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false // Excluded by default in queries
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: undefined
    },
    role: {
      type: String,
      enum: ['USER', 'ADMIN'],
      default: 'USER',
      index: true
    },
    accountStatus: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'DELETED'],
      default: 'ACTIVE',
      index: true
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    lastLoginAt: {
      type: Date,
      default: undefined
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        delete ret.passwordHash;
        delete ret.__v;
        ret.id = ret._id;
        return ret;
      }
    },
    toObject: {
      transform(_doc, ret: any) {
        delete ret.passwordHash;
        delete ret.__v;
        ret.id = ret._id;
        return ret;
      }
    }
  }
);

// Model export
export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
