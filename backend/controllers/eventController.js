const { Event, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Search events for autocomplete/filtering
 * GET /v1/events?query=<search_term>&limit=10
 */
const searchEvents = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.json({ data: [] });
    }

    const events = await Event.findAll({
      where: {
        name: {
          [Op.iLike]: `%${query}%`
        },
        isActive: true
      },
      include: [{
        model: User,
        as: 'creator',
        attributes: ['firstName', 'lastName']
      }],
      attributes: ['id', 'name', 'eventDate', 'eventType', 'location'],
      limit: parseInt(limit),
      order: [['eventDate', 'DESC']]
    });

    const formattedEvents = events.map(event => ({
      id: event.id,
      name: event.name,
      eventDate: event.eventDate,
      eventType: event.eventType,
      location: event.location,
      creator: event.creator ? `${event.creator.firstName} ${event.creator.lastName}` : 'Unknown'
    }));

    res.json({ data: formattedEvents });
  } catch (error) {
    console.error('Error searching events:', error);
    res.status(500).json({ error: 'Failed to search events' });
  }
};

module.exports = {
  searchEvents
};