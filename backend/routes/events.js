const express = require('express');
const { getDb } = require('../db/database');
const { verifyToken, optionalAuth, requireAdmin } = require('../middleware/auth');
const { canTransitionEvent, EVENT_TRANSITIONS } = require('../utils/stateMachine');

const router = express.Router();

// GET /api/events - Public sees non-draft events; Admin sees all events
router.get('/', optionalAuth, async (req, res) => {
  try {
    const db = await getDb();
    const isAdmin = req.user && req.user.role === 'admin';

    const events = isAdmin
      ? await db.all('SELECT * FROM events ORDER BY event_date ASC')
      : await db.all("SELECT * FROM events WHERE status != 'DRAFT' ORDER BY event_date ASC");

    res.json({ events });
  } catch (err) {
    console.error('Fetch events error:', err);
    res.status(500).json({ error: 'Failed to load events.' });
  }
});

// POST /api/events - Admin creates a new event (starts in DRAFT state)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, category, venue, event_date, price, total_seats, image_url } = req.body;

    if (!title || !description || !venue || !event_date || !total_seats) {
      return res.status(400).json({ error: 'Title, description, venue, date, and total seats are required.' });
    }

    const seatsNum = parseInt(total_seats, 10);
    const priceNum = parseFloat(price || 0);
    if (isNaN(seatsNum) || seatsNum < 1) {
      return res.status(400).json({ error: 'Total seats must be at least 1.' });
    }
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: 'Price cannot be negative.' });
    }

    const db = await getDb();
    const result = await db.run(
      `INSERT INTO events (title, description, category, venue, event_date, price, total_seats, available_seats, image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
      [
        title.trim(),
        description.trim(),
        (category || 'General').trim(),
        venue.trim(),
        event_date,
        priceNum,
        seatsNum,
        seatsNum,
        image_url ? image_url.trim() : null
      ]
    );

    const created = await db.get('SELECT * FROM events WHERE id = ?', [result.lastID]);
    res.status(201).json({ event: created });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Failed to create event.' });
  }
});

// PUT /api/events/:id - Admin updates event details (only in DRAFT or PUBLISHED)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const existing = await db.get('SELECT * FROM events WHERE id = ?', [req.params.id]);

    if (!existing) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    if (existing.status === 'CANCELLED' || existing.status === 'COMPLETED') {
      return res.status(400).json({ error: `Cannot edit an event that is ${existing.status}.` });
    }

    const { title, description, category, venue, event_date, price, total_seats, image_url } = req.body;
    const newTotalSeats = total_seats !== undefined ? parseInt(total_seats, 10) : existing.total_seats;
    const bookedSeats = existing.total_seats - existing.available_seats;

    if (newTotalSeats < bookedSeats) {
      return res.status(400).json({ error: `Cannot reduce total seats below already booked seats (${bookedSeats}).` });
    }

    const newAvailableSeats = newTotalSeats - bookedSeats;

    await db.run(
      `UPDATE events
       SET title = ?, description = ?, category = ?, venue = ?, event_date = ?, price = ?, total_seats = ?, available_seats = ?, image_url = ?
       WHERE id = ?`,
      [
        title ? title.trim() : existing.title,
        description ? description.trim() : existing.description,
        category ? category.trim() : existing.category,
        venue ? venue.trim() : existing.venue,
        event_date || existing.event_date,
        price !== undefined ? parseFloat(price) : existing.price,
        newTotalSeats,
        newAvailableSeats,
        image_url !== undefined ? image_url.trim() : existing.image_url,
        existing.id
      ]
    );

    const updated = await db.get('SELECT * FROM events WHERE id = ?', [existing.id]);
    res.json({ event: updated });
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ error: 'Failed to update event.' });
  }
});

// PATCH /api/events/:id/status - Admin transitions event state
router.patch('/:id/status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status: nextStatus } = req.body;
    const db = await getDb();
    const event = await db.get('SELECT * FROM events WHERE id = ?', [req.params.id]);

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    if (!canTransitionEvent(event.status, nextStatus)) {
      const allowed = EVENT_TRANSITIONS[event.status] || [];
      return res.status(400).json({
        error: `Invalid transition from ${event.status} to ${nextStatus}. Allowed: ${allowed.join(', ') || 'none'}.`
      });
    }

    await db.run('UPDATE events SET status = ? WHERE id = ?', [nextStatus, event.id]);

    // Business Rule: Cancelling an event automatically cancels all its active bookings & restores seats
    if (nextStatus === 'CANCELLED') {
      await db.run(
        "UPDATE bookings SET status = 'CANCELLED' WHERE event_id = ? AND status IN ('PENDING', 'CONFIRMED')",
        [event.id]
      );
      await db.run('UPDATE events SET available_seats = total_seats WHERE id = ?', [event.id]);
    }

    const updated = await db.get('SELECT * FROM events WHERE id = ?', [event.id]);
    res.json({ event: updated });
  } catch (err) {
    console.error('Event status error:', err);
    res.status(500).json({ error: 'Failed to update event status.' });
  }
});

// DELETE /api/events/:id - Admin deletes a DRAFT or CANCELLED event
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const event = await db.get('SELECT * FROM events WHERE id = ?', [req.params.id]);

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    if (event.status === 'PUBLISHED') {
      return res.status(400).json({ error: 'Cancel a published event before deleting it.' });
    }

    await db.run('DELETE FROM events WHERE id = ?', [event.id]);
    res.json({ message: 'Event deleted successfully.' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Failed to delete event.' });
  }
});

module.exports = router;
