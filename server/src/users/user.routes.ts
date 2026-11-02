import { Router } from 'express';
import { UserController } from './user.controller';
import { authenticate } from '../auth/auth.middleware';

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get('/me/payout-profile', UserController.getMyPayoutProfile);
userRouter.patch('/me/payout-profile', UserController.updateMyPayoutProfile);

