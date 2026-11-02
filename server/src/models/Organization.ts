import mongoose, { Document, Schema, Model } from 'mongoose';

export type OrganizationRole = 'OWNER' | 'SPONSOR' | 'MEMBER';
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface IOrganizationMember {
  userId: mongoose.Types.ObjectId;
  role: OrganizationRole;
  joinedAt: Date;
}

export interface IOrganization extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  ownerId: mongoose.Types.ObjectId;
  members: IOrganizationMember[];
  organizationStatus: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationMemberSchema = new Schema<IOrganizationMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['OWNER', 'SPONSOR', 'MEMBER'],
      default: 'MEMBER'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [2, 'Slug must be at least 2 characters'],
      maxlength: [50, 'Slug cannot exceed 50 characters'],
      match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'],
      index: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    logoUrl: {
      type: String,
      trim: true
    },
    website: {
      type: String,
      trim: true
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organization owner is required'],
      index: true
    },
    members: {
      type: [OrganizationMemberSchema],
      default: [],
      validate: [
        {
          validator(members: IOrganizationMember[]) {
            // Must contain at least one OWNER
            return members.some((m) => m.role === 'OWNER');
          },
          message: 'An organization must always have at least one OWNER in its members list'
        }
      ]
    },
    organizationStatus: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        delete ret.__v;
        ret.id = ret._id;
        return ret;
      }
    },
    toObject: {
      transform(_doc, ret: any) {
        delete ret.__v;
        ret.id = ret._id;
        return ret;
      }
    }
  }
);

OrganizationSchema.index({ 'members.userId': 1 });

export const Organization: Model<IOrganization> =
  mongoose.models.Organization || mongoose.model<IOrganization>('Organization', OrganizationSchema);
