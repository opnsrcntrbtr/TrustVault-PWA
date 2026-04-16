/**
 * Debug Utilities for IndexedDB
 * These functions are exposed to window for browser console debugging
 */

import { db } from './database';

/**
 * Clear all data from the database
 */
export async function clearAllData(): Promise<void> {
  try {
    await db.users.clear();
    await db.credentials.clear();
    console.log('✅ All database tables cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear database:', error);
    throw error;
  }
}

/**
 * List all users in the database
 */
export async function listUsers(): Promise<void> {
  try {
    const users = await db.users.toArray();
    console.log('Users in database:', users.length);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (ID: ${user.id})`);
    });
  } catch (error) {
    console.error('Failed to list users:', error);
  }
}

/**
 * Delete a specific user by email
 */
export async function deleteUserByEmail(email: string): Promise<void> {
  try {
    const user = await db.users.where('email').equals(email).first();
    if (user) {
      await db.users.delete(user.id);
      console.log(`✅ User ${email} deleted successfully`);
    } else {
      console.log(`❌ User ${email} not found`);
    }
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).debugDB = {
    clearAllData,
    listUsers,
    deleteUserByEmail,
  };
  console.log('Debug utilities available: window.debugDB');
}
