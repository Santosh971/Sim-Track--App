/**
 * Offline Queue - Manages unsynced call logs
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/index';
import { DeviceCallLog, toAPICallLog, APICallLog } from '../models/index';

const QUEUE_KEY = STORAGE_KEYS.OFFLINE_QUEUE;

/**
 * Offline queue for storing call logs when network is unavailable
 */
export const OfflineQueue = {
  /**
   * Add call logs to the offline queue
   */
  async enqueue(logs: DeviceCallLog[]): Promise<void> {
    try {
      const existingQueue = await this.getQueue();
      const updatedQueue = [...existingQueue, ...logs];
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
    } catch (error) {
      console.error('Failed to enqueue call logs:', error);
      throw error;
    }
  },

  /**
   * Get all queued call logs
   */
  async getQueue(): Promise<DeviceCallLog[]> {
    try {
      const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
      return queueStr ? JSON.parse(queueStr) : [];
    } catch (error) {
      console.error('Failed to get queue:', error);
      return [];
    }
  },

  /**
   * Get queue converted to API format
   */
  async getAPIQueue(): Promise<APICallLog[]> {
    const queue = await this.getQueue();
    return queue.map(toAPICallLog);
  },

  /**
   * Remove specific logs from queue after successful sync
   */
  async dequeue(syncedIds: string[]): Promise<void> {
    try {
      const existingQueue = await this.getQueue();
      const remainingQueue = existingQueue.filter(
        (log) => !syncedIds.includes(log.callId)
      );
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
    } catch (error) {
      console.error('Failed to dequeue:', error);
      throw error;
    }
  },

  /**
   * Clear entire queue
   */
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
  },

  /**
   * Get count of pending logs
   */
  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  },

  /**
   * Check if queue has pending logs
   */
  async hasPending(): Promise<boolean> {
    const count = await this.getPendingCount();
    return count > 0;
  },
};

export default OfflineQueue;