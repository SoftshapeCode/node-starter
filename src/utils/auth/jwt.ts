import { Strategy, StrategyOptions } from 'passport-jwt';
import { SECRET_KEY } from '../secrets';
import prisma from '../../prisma';

const options: StrategyOptions = {
  secretOrKey: SECRET_KEY,
  jwtFromRequest: (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    return token || req.cookies['access-token'];
  },
};

const strategy = (tolerant: boolean) => {
  return new Strategy(options, async (payload, verify) => {
    const user = await prisma.user.findFirst({
      where: {
        id: payload.id,
        revokeTokensBefore: { lte: new Date(payload.iat * 1000) },
      },
    });

    if (user) {
      verify(null, user);
    } else if (tolerant) {
      verify(null, null);
    } else {
      verify(null, null, "can't authenticate the user");
    }
  });
};

export const jwtStrategy = strategy(false);
export const jwtStrategyTolerant = strategy(true);
