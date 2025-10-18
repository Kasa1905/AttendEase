const { expect } = require('@playwright/test');

/**
 * Real-time Helpers for E2E Tests
 * Provides utilities for testing WebSocket connections, live updates, and real-time features
 */

class RealtimeHelpers {
  constructor(page) {
    this.page = page;
  }

  /**
   * Wait for WebSocket connection to be established
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<void>}
   */
  async waitForWebSocketConnection(timeout = 10000) {
    await this.page.waitForFunction(
      () => window.socket && window.socket.connected === true,
      { timeout }
    );
  }

  /**
   * Wait for WebSocket disconnection
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<void>}
   */
  async waitForWebSocketDisconnection(timeout = 5000) {
    await this.page.waitForFunction(
      () => !window.socket || window.socket.connected === false,
      { timeout }
    );
  }

  /**
   * Verify WebSocket connection status
   * @returns {Promise<boolean>} Connection status
   */
  async isWebSocketConnected() {
    return await this.page.evaluate(() => {
      return window.socket && window.socket.connected === true;
    });
  }

  /**
   * Emit a WebSocket event and wait for response
   * @param {string} eventName - Event name to emit
   * @param {Object} data - Data to send with event
   * @param {string} responseEvent - Event name to wait for response
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>} Response data
   */
  async emitAndWaitForResponse(eventName, data, responseEvent, timeout = 5000) {
    return await this.page.evaluate(
      ({ eventName, data, responseEvent, timeout }) => {
        return new Promise((resolve, reject) => {
          if (!window.socket || !window.socket.connected) {
            reject(new Error('WebSocket not connected'));
            return;
          }

          const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout waiting for ${responseEvent}`));
          }, timeout);

          window.socket.once(responseEvent, (responseData) => {
            clearTimeout(timeoutId);
            resolve(responseData);
          });

          window.socket.emit(eventName, data);
        });
      },
      { eventName, data, responseEvent, timeout }
    );
  }

  /**
   * Listen for specific WebSocket events
   * @param {string} eventName - Event name to listen for
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>} Event data
   */
  async waitForWebSocketEvent(eventName, timeout = 5000) {
    return await this.page.evaluate(
      ({ eventName, timeout }) => {
        return new Promise((resolve, reject) => {
          if (!window.socket || !window.socket.connected) {
            reject(new Error('WebSocket not connected'));
            return;
          }

          const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout waiting for ${eventName}`));
          }, timeout);

          window.socket.once(eventName, (data) => {
            clearTimeout(timeoutId);
            resolve(data);
          });
        });
      },
      { eventName, timeout }
    );
  }

  /**
   * Simulate real-time attendance update
   * @param {Object} attendanceData - Attendance data to broadcast
   * @returns {Promise<void>}
   */
  async simulateAttendanceUpdate(attendanceData) {
    await this.emitAndWaitForResponse(
      'attendance:update',
      attendanceData,
      'attendance:updated'
    );
  }

  /**
   * Simulate real-time duty session update
   * @param {Object} sessionData - Duty session data to broadcast
   * @returns {Promise<void>}
   */
  async simulateDutySessionUpdate(sessionData) {
    await this.emitAndWaitForResponse(
      'duty-session:update',
      sessionData,
      'duty-session:updated'
    );
  }

  /**
   * Test concurrent user interactions
   * @param {Function} action1 - First user action
   * @param {Function} action2 - Second user action
   * @returns {Promise<void>}
   */
  async testConcurrentActions(action1, action2) {
    const results = await Promise.allSettled([
      action1(),
      action2()
    ]);

    // Check if any action failed
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      throw new Error(`Concurrent actions failed: ${failures.map(f => f.reason).join(', ')}`);
    }
  }

  /**
   * Verify real-time notification delivery
   * @param {Object} notificationData - Notification data to send
   * @param {string} targetSelector - CSS selector for notification display
   * @returns {Promise<void>}
   */
  async verifyNotificationDelivery(notificationData, targetSelector) {
    // Send notification
    await this.page.evaluate((data) => {
      if (window.socket && window.socket.connected) {
        window.socket.emit('notification:send', data);
      }
    }, notificationData);

    // Wait for notification to appear in UI
    await expect(this.page.locator(targetSelector)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Test connection recovery after interruption
   * @returns {Promise<void>}
   */
  async testConnectionRecovery() {
    // Verify initial connection
    const wasConnected = await this.isWebSocketConnected();
    expect(wasConnected).toBe(true);

    // Simulate network interruption
    await this.page.context().setOffline(true);
    await this.waitForWebSocketDisconnection();

    // Restore connection
    await this.page.context().setOffline(false);
    await this.waitForWebSocketConnection();

    // Verify reconnection
    const isReconnected = await this.isWebSocketConnected();
    expect(isReconnected).toBe(true);
  }

  /**
   * Monitor WebSocket events for debugging
   * @param {number} duration - Duration to monitor in milliseconds
   * @returns {Promise<Array>} List of captured events
   */
  async monitorWebSocketEvents(duration = 5000) {
    const events = await this.page.evaluate(({ duration }) => {
      return new Promise((resolve) => {
        const capturedEvents = [];

        if (!window.socket || !window.socket.connected) {
          resolve(capturedEvents);
          return;
        }

        // Capture common events
        const eventTypes = [
          'connect',
          'disconnect',
          'attendance:updated',
          'duty-session:updated',
          'notification:received',
          'user:online',
          'user:offline'
        ];

        const listeners = {};

        eventTypes.forEach(eventType => {
          listeners[eventType] = (data) => {
            capturedEvents.push({
              event: eventType,
              data: data,
              timestamp: new Date().toISOString()
            });
          };
          window.socket.on(eventType, listeners[eventType]);
        });

        setTimeout(() => {
          // Clean up listeners
          eventTypes.forEach(eventType => {
            window.socket.off(eventType, listeners[eventType]);
          });
          resolve(capturedEvents);
        }, duration);
      });
    }, { duration });

    return events;
  }

  /**
   * Test message ordering and delivery
   * @param {Array} messages - Messages to send in order
   * @param {string} responseEvent - Event to listen for responses
   * @returns {Promise<void>}
   */
  async testMessageOrdering(messages, responseEvent) {
    const responses = [];

    // Set up listener for responses
    await this.page.evaluate(({ responseEvent }) => {
      window.testResponses = [];
      if (window.socket && window.socket.connected) {
        window.socket.on(responseEvent, (data) => {
          window.testResponses.push(data);
        });
      }
    }, { responseEvent });

    // Send messages in order
    for (const message of messages) {
      await this.page.evaluate(({ message }) => {
        if (window.socket && window.socket.connected) {
          window.socket.emit('test:message', message);
        }
      }, { message });
      
      // Small delay to ensure ordering
      await this.page.waitForTimeout(100);
    }

    // Wait for all responses
    await this.page.waitForFunction(
      (expectedCount) => window.testResponses && window.testResponses.length >= expectedCount,
      messages.length,
      { timeout: 10000 }
    );

    // Verify message order
    const receivedResponses = await this.page.evaluate(() => window.testResponses);
    expect(receivedResponses).toHaveLength(messages.length);

    // Clean up
    await this.page.evaluate(({ responseEvent }) => {
      if (window.socket) {
        window.socket.off(responseEvent);
      }
      delete window.testResponses;
    }, { responseEvent });
  }

  /**
   * Simulate network latency
   * @param {number} latency - Latency in milliseconds
   * @returns {Promise<void>}
   */
  async simulateNetworkLatency(latency) {
    await this.page.route('**/*', async (route, request) => {
      await new Promise(resolve => setTimeout(resolve, latency));
      await route.continue();
    });
  }

  /**
   * Clear network route simulations
   * @returns {Promise<void>}
   */
  async clearNetworkSimulation() {
    await this.page.unroute('**/*');
  }
}

/**
 * Factory function to create RealtimeHelpers instance
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {RealtimeHelpers} RealtimeHelpers instance
 */
function createRealtimeHelpers(page) {
  return new RealtimeHelpers(page);
}

module.exports = { RealtimeHelpers, createRealtimeHelpers };