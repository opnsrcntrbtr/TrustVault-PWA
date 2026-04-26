import {
  type AuthSession,
  type PublicUser,
  type SecuritySettings,
  type User,
  type WebAuthnCredential,
  toPublicUser,
} from '@/domain/entities/User';
import { userRepository } from '@/data/repositories/UserRepositoryImpl';

export interface AuthResult {
  user: PublicUser;
  session: AuthSession;
}

export async function signUpWithPassword(
  email: string,
  masterPassword: string
): Promise<AuthResult> {
  await userRepository.createUser(email, masterPassword);
  return signInWithPassword(email, masterPassword);
}

export async function signInWithPassword(
  email: string,
  masterPassword: string
): Promise<AuthResult> {
  const session = await userRepository.authenticateWithPassword(email, masterPassword);
  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw new Error('Authenticated user could not be loaded');
  }

  return {
    user: toPublicUser(user),
    session,
  };
}

export async function unlockWithPassword(
  email: string,
  masterPassword: string
): Promise<AuthResult> {
  return signInWithPassword(email, masterPassword);
}

export async function signInWithBiometric(
  userId: string,
  credentialId: string
): Promise<AuthResult> {
  const session = await userRepository.authenticateWithBiometric(userId, credentialId);
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new Error('Authenticated user could not be loaded');
  }

  return {
    user: toPublicUser(user),
    session,
  };
}

export async function signInFirstBiometricForUser(userId: string): Promise<AuthResult> {
  const credentialId = await userRepository.getFirstBiometricCredential(userId);

  if (!credentialId) {
    throw new Error('No biometric credential registered for this user');
  }

  return signInWithBiometric(userId, credentialId);
}

export async function hasAnyUsers(): Promise<boolean> {
  return userRepository.hasAnyUsers();
}

export async function getUserByEmail(email: string): Promise<PublicUser | null> {
  const user = await userRepository.findByEmail(email);
  return user ? toPublicUser(user) : null;
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  const user = await userRepository.findById(userId);
  return user ? toPublicUser(user) : null;
}

export async function getFullUserById(userId: string): Promise<User | null> {
  return userRepository.findById(userId);
}

export async function getUsersWithBiometric(): Promise<PublicUser[]> {
  const users = await userRepository.getUsersWithBiometric();
  return users.map(toPublicUser);
}

export async function getFirstBiometricCredential(userId: string): Promise<string | null> {
  return userRepository.getFirstBiometricCredential(userId);
}

export async function getBiometricCredentials(userId: string): Promise<WebAuthnCredential[]> {
  const user = await userRepository.findById(userId);
  return user?.webAuthnCredentials ?? [];
}

export async function registerBiometricCredential(
  userId: string,
  vaultKey: CryptoKey,
  deviceName?: string
): Promise<PublicUser> {
  await userRepository.registerBiometric(userId, vaultKey, deviceName);
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new Error('User not found after biometric registration');
  }

  return toPublicUser(user);
}

export async function removeBiometricCredential(
  userId: string,
  credentialId: string
): Promise<PublicUser> {
  await userRepository.removeBiometric(userId, credentialId);
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new Error('User not found after biometric removal');
  }

  return toPublicUser(user);
}

export async function updateSecuritySettings(
  userId: string,
  settings: Partial<SecuritySettings>
): Promise<PublicUser> {
  await userRepository.updateSecuritySettings(userId, settings);
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new Error('User not found after updating security settings');
  }

  return toPublicUser(user);
}

export async function changeMasterPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await userRepository.changeMasterPassword(userId, currentPassword, newPassword);
}
