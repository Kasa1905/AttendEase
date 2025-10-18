module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const strikes = [
      // Alice's strikes - missed logs
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId: '11111111-1111-4111-8111-111111111111', // Alice
        reason: 'Missed hourly log submission',
        description: 'Failed to submit hourly log for duty session on 2024-01-15. Required logs were not provided.',
        strikeCountAtTime: 1,
        status: 'active',
        createdAt: threeDaysAgo,
        updatedAt: threeDaysAgo
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        userId: '11111111-1111-4111-8111-111111111111', // Alice
        reason: 'Missed hourly log submission',
        description: 'Failed to submit hourly log for duty session on 2024-01-16. Required logs were not provided.',
        strikeCountAtTime: 2,
        status: 'active',
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        userId: '11111111-1111-4111-8111-111111111111', // Alice
        reason: 'Insufficient duty hours',
        description: 'Duty session ended after only 90 minutes. Minimum required duty time is 120 minutes.',
        strikeCountAtTime: 3,
        status: 'active',
        createdAt: yesterday,
        updatedAt: yesterday
      },

      // Bob's strikes - excessive breaks
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        userId: '11111111-1111-4111-8111-111111111112', // Bob
        reason: 'Excessive break duration',
        description: 'Break lasted 45 minutes, exceeding the maximum allowed break time of 30 minutes.',
        strikeCountAtTime: 1,
        status: 'resolved',
        resolution: 'Warned about break policies',
        resolvedAt: twoDaysAgo,
        createdAt: threeDaysAgo,
        updatedAt: twoDaysAgo
      },

      // Resolved strike example
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        userId: '11111111-1111-4111-8111-111111111111', // Alice
        reason: 'Late arrival to duty',
        description: 'Arrived 15 minutes late for scheduled duty session.',
        strikeCountAtTime: 1,
        status: 'resolved',
        resolution: 'Accepted apology and reminder about punctuality',
        resolvedAt: yesterday,
        createdAt: twoDaysAgo,
        updatedAt: yesterday
      }
    ];

    await queryInterface.bulkInsert('strikes', strikes);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('strikes', null, {});
  }
};