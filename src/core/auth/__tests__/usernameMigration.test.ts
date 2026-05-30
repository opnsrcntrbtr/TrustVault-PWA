/**
 * Tests for the DB v7 username backfill migration logic.
 *
 * All correctness risk of the v7 migration (uniqueness against the new
 * `&usernameLower` index, determinism, collision handling) lives in the pure
 * deriveUniqueUsernames() / deriveUsernameStem(), so they are exercised here
 * directly — the same approach the v6 biometric migration uses
 * (biometricMigration.test.ts).
 */

import { describe, it, expect } from 'vitest';
import {
  deriveUniqueUsernames,
  deriveUsernameStem,
  type MigratableUser,
} from '../usernameMigration';
import { USERNAME_REGEX } from '../usernameValidation';

function user(id: string, email: string | undefined, createdAt: number): MigratableUser {
  return { id, email, createdAt };
}

describe('deriveUsernameStem', () => {
  it('uses the email local-part', () => {
    expect(deriveUsernameStem('alice@example.com')).toBe('alice');
  });

  it('lowercases', () => {
    expect(deriveUsernameStem('Alice@example.com')).toBe('alice');
  });

  it('strips disallowed characters', () => {
    expect(deriveUsernameStem('al+ice.test@x.com')).toBe('alice.test');
  });

  it('namespaces reserved local-parts under user_', () => {
    expect(deriveUsernameStem('admin@x.com')).toBe('user_admin');
  });

  it('namespaces too-short local-parts under user_', () => {
    expect(deriveUsernameStem('a@x.com')).toBe('user_a');
  });

  it('falls back to "user" when there is no usable local-part', () => {
    expect(deriveUsernameStem(undefined)).toBe('user');
    expect(deriveUsernameStem('@x.com')).toBe('user');
    expect(deriveUsernameStem('!!!@x.com')).toBe('user');
  });

  it('truncates over-long local-parts to 32 chars', () => {
    const stem = deriveUsernameStem(`${'a'.repeat(40)}@x.com`);
    expect(stem).toBe('a'.repeat(32));
    expect(stem.length).toBe(32);
  });

  it('always returns a value matching the username shape', () => {
    for (const e of ['alice@x.com', 'a@x.com', 'admin@x.com', '@x.com', undefined]) {
      expect(USERNAME_REGEX.test(deriveUsernameStem(e))).toBe(true);
    }
  });
});

describe('deriveUniqueUsernames', () => {
  it('derives a simple username from email', () => {
    const map = deriveUniqueUsernames([user('1', 'alice@example.com', 1)]);
    expect(map.get('1')).toEqual({ username: 'alice', usernameLower: 'alice' });
  });

  it('suffixes colliding usernames, oldest account keeps the bare name', () => {
    const map = deriveUniqueUsernames([
      user('1', 'alice@example.com', 100),
      user('2', 'alice@other.com', 200),
      user('3', 'alice@third.com', 300),
    ]);
    expect(map.get('1')?.usernameLower).toBe('alice');
    expect(map.get('2')?.usernameLower).toBe('alice2');
    expect(map.get('3')?.usernameLower).toBe('alice3');
  });

  it('is independent of input array order (oldest createdAt wins)', () => {
    const inOrder = deriveUniqueUsernames([
      user('1', 'alice@a.com', 100),
      user('2', 'alice@b.com', 200),
    ]);
    const reversed = deriveUniqueUsernames([
      user('2', 'alice@b.com', 200),
      user('1', 'alice@a.com', 100),
    ]);
    expect(inOrder.get('1')).toEqual(reversed.get('1'));
    expect(inOrder.get('2')).toEqual(reversed.get('2'));
    expect(inOrder.get('1')?.usernameLower).toBe('alice');
  });

  it('breaks createdAt ties by id deterministically', () => {
    const map = deriveUniqueUsernames([
      user('zzz', 'alice@a.com', 100),
      user('aaa', 'alice@b.com', 100),
    ]);
    expect(map.get('aaa')?.usernameLower).toBe('alice');
    expect(map.get('zzz')?.usernameLower).toBe('alice2');
  });

  it('handles accounts with no email', () => {
    const map = deriveUniqueUsernames([
      user('1', undefined, 1),
      user('2', undefined, 2),
    ]);
    expect(map.get('1')?.usernameLower).toBe('user');
    expect(map.get('2')?.usernameLower).toBe('user2');
  });

  it('preserves an already-assigned username (idempotent re-run)', () => {
    const existing: MigratableUser = {
      id: '1',
      email: 'bob@x.com',
      createdAt: 1,
      username: 'bob',
      usernameLower: 'bob',
    };
    const map = deriveUniqueUsernames([
      existing,
      user('2', 'bob@y.com', 2), // would derive 'bob' too → must avoid the kept one
    ]);
    expect(map.get('1')?.usernameLower).toBe('bob');
    expect(map.get('2')?.usernameLower).toBe('bob2');
  });

  it('never exceeds 32 chars even when suffixing a max-length base', () => {
    const longLocal = 'a'.repeat(40); // → stem of 32 a's, shared by all
    const users = Array.from({ length: 3 }, (_, i) =>
      user(String(i), `${longLocal}@x${String(i)}.com`, i),
    );
    const map = deriveUniqueUsernames(users);
    for (const { usernameLower } of map.values()) {
      expect(usernameLower.length).toBeLessThanOrEqual(32);
    }
  });

  it('guarantees globally unique keys for a large adversarial set', () => {
    // 50 accounts that all want the same username.
    const users = Array.from({ length: 50 }, (_, i) =>
      user(`id-${String(i)}`, `dup@host${String(i)}.com`, i),
    );
    const map = deriveUniqueUsernames(users);
    const keys = [...map.values()].map((a) => a.usernameLower);
    expect(keys.length).toBe(50);
    expect(new Set(keys).size).toBe(50); // all unique → unique index is safe
  });

  it('produces only valid-shaped usernames', () => {
    const users = [
      user('1', 'admin@x.com', 1),
      user('2', 'a@x.com', 2),
      user('3', undefined, 3),
      user('4', 'WEIRD+Name.123@x.com', 4),
    ];
    const map = deriveUniqueUsernames(users);
    for (const { usernameLower } of map.values()) {
      expect(USERNAME_REGEX.test(usernameLower)).toBe(true);
    }
  });
});
