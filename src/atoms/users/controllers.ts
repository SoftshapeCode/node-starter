import type { Handler } from 'express';
import bcrypt from 'bcrypt';
import * as schemas from './schemas';
import * as services from './services';
import { signAccessToken } from './helpers';
import { SimpleError } from '../../utils/errors';
import { translate } from '../../utils/i18n';

export const login: Handler = async (req, res) => {
  const data = schemas.login.parse(req.body);

  const user: any = await services.getUserByUsername(req, data.username, false);

  // Check for password
  if (!user || !bcrypt.compareSync(data.password, user.password)) {
    throw new SimpleError(400, translate(req, 'loginFailed'));
  }

  const accessToken = signAccessToken(user.id);
  const reshapedUser = services.reshape(user);

  // Response
  return res
    .status(200)
    .cookie('access-token', accessToken, { path: '/', httpOnly: true })
    .cookie('user', JSON.stringify(reshapedUser), { path: '/' })
    .json({ accessToken, user: reshapedUser });
};

export const signup: Handler = async (req, res) => {
  const data = await schemas.signup.parseAsync(req.body);

  const user = await services.createUser(req, data);

  return res.status(200).json(user);
};

export const profile: Handler = async (req, res) => {
  if (!req.user) {
    throw new SimpleError(500, translate(req, 'serverError'));
  }

  const user = await services.getUserById(req, req.user.id);

  return res.status(200).json(user);
};

export const logout: Handler = async (req, res) => {
  res.clearCookie('access-token');
  res.clearCookie('user');

  const message = translate(req, 'logoutSuccess');

  if (!req.user) {
    return res.json({ message });
  }

  await services.setRevokeTokensBefore(req, req.user.username);

  return res.json({ message });
};

export const changePassword: Handler = async (req, res) => {
  const data = schemas.changePassword.parse(req.body);

  // Make sure that the user is logged in
  if (!req.user) {
    throw new SimpleError(500, translate(req, 'unknownError'));
  }

  // Make sure that the password correct
  if (!bcrypt.compareSync(data.oldPassword, req.user.password)) {
    throw new SimpleError(400, translate(req, 'oldPasswordWrong'));
  }

  await services.setPassword(
    req,
    req.user.username,
    bcrypt.hashSync(data.newPassword, 10)
  );

  return res.status(200).json({ message: translate(req, 'passwordUpdated') });
};
