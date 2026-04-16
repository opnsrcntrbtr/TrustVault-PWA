/**
 * Type declarations for argon2-browser
 * https://github.com/antelle/argon2-browser
 */

declare module 'argon2-browser' {
  export interface Argon2Options {
    pass: string | Uint8Array;
    salt: string | Uint8Array;
    time?: number; // Number of iterations
    mem?: number; // Memory in KiB
    hashLen?: number; // Desired hash length
    parallelism?: number; // Degree of parallelism
    type?: Argon2Type; // Argon2 type
  }

  export enum Argon2Type {
    Argon2d = 0,
    Argon2i = 1,
    Argon2id = 2,
  }

  export interface Argon2Result {
    hash: Uint8Array;
    hashHex: string;
    encoded: string;
  }

  export function hash(options: Argon2Options): Promise<Argon2Result>;
  export function verify(options: { pass: string | Uint8Array; encoded: string }): Promise<boolean>;
}
