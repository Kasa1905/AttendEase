module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const events = [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Weekly Meeting', description: 'Club weekly sync-up', eventDate: '2025-09-20', startTime: '18:00:00', endTime: '19:00:00', location: 'Room 101', eventType: 'meeting', isActive: true, createdBy: '22222222-2222-4222-8222-222222222222', maxParticipants: 50, createdAt: now, updatedAt: now },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Intro Workshop', description: 'Hands-on workshop for new members', eventDate: '2025-09-25', startTime: '14:00:00', endTime: '17:00:00', location: 'Lab 2', eventType: 'workshop', isActive: true, createdBy: '22222222-2222-4222-8222-222222222222', maxParticipants: 30, createdAt: now, updatedAt: now }
    ];
    await queryInterface.bulkInsert('events', events);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('events', null, {});
  }
};
