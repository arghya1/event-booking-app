const express = require('express');
const { getDb } = require('../db/database');
const { verifyToken } = require('../middleware/auth');
const { canTransitionBooking, BOOKING_TRANSITIONS } = require('../utils/stateMachine');

const router = express.Router();

// GET /api/bookings - User gets their own bookings; Admin gets all bookings
router.get('/', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const isAdmin = req.user.role === 'admin';

    const query = `
      SELECT
        b.id, b.user_id, b.event_id, b.seats, b.total_amount, b.status, b.created_at,
        e.title AS event_title, e.venue AS event_venue, e.event_date, e.status AS event_status,
        u.name AS user_name, u.email AS user_email
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      JOIN users u ON b.user_id = u.id
      ${isAdmin ? '' : 'WHERE b.user_id = ?'}
      ORDER BY b.created_at DESC
    `;

    const bookings = isAdmin
      ? await db.all(query)
      : await db.all(query, [req.user.id]);

    res.json({ bookings });
  } catch (err) {
    console.error('Fetch bookings error:', err);
    res.status(500).json({ error: 'Failed to load bookings.' });
  }
});

// POST /api/bookings - Authenticated user books tickets for a PUBLISHED event
router.post('/', verifyToken, async (req, res) => {
  try {
    const { event_id, seats } = req.body;
    const seatCount = parseInt(seats, 10);

    if (!event_id || isNaN(seatCount) || seatCount < 1 || seatCount > 5) {
      return res.status(400).json({ error: 'Please select between 1 and 5 seats.' });
    }

    const db = await getDb();
    const event = await db.get('SELECT * FROM events WHERE id = ?', [event_id]);

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    if (event.status !== 'PUBLISHED') {
      return res.status(400).json({ error: `Bookings are only allowed for PUBLISHED events (current: ${event.status}).` });
    }
    if (event.available_seats < seatCount) {
      return res.status(400).json({ error: `Only ${event.available_seats} seats remaining.` });
    }

    const totalAmount = seatCount * event.price;

    // Reserve seats immediately and create booking in PENDING state
    await db.run('UPDATE events SET available_seats = available_seats - ? WHERE id = ?', [seatCount, event.id]);
    const result = await db.run(
      `INSERT INTO bookings (user_id, event_id, seats, total_amount, status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [req.user.id, event.id, seatCount, totalAmount]
    );

    const created = await db.get('SELECT * FROM bookings WHERE id = ?', [result.lastID]);
    res.status(201).json({ booking: created });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Failed to create booking.' });
  }
});

// PATCH /api/bookings/:id/status - Transition booking state (CONFIRMED or CANCELLED)
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const { status: nextStatus } = req.body;
    const db = await getDb();
    const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = booking.user_id === req.user.id;

    // Authorization rules
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You are not authorized to modify this booking.' });
    }
    if (nextStatus === 'CONFIRMED' && !isAdmin) {
      return res.status(403).json({ error: 'Only an admin can confirm a booking.' });
    }

    // State machine check
    if (!canTransitionBooking(booking.status, nextStatus)) {
      const allowed = BOOKING_TRANSITIONS[booking.status] || [];
      return res.status(400).json({
        error: `Invalid transition from ${booking.status} to ${nextStatus}. Allowed: ${allowed.join(', ') || 'none'}.`
      });
    }

    const event = await db.get('SELECT * FROM events WHERE id = ?', [booking.event_id]);
    if (event && event.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot modify bookings for a COMPLETED event.' });
    }

    await db.run('UPDATE bookings SET status = ? WHERE id = ?', [nextStatus, booking.id]);

    // Restore seats if booking is cancelled
    if (nextStatus === 'CANCELLED') {
      await db.run(
        'UPDATE events SET available_seats = MIN(total_seats, available_seats + ?) WHERE id = ?',
        [booking.seats, booking.event_id]
      );
    }

    const updated = await db.get('SELECT * FROM bookings WHERE id = ?', [booking.id]);
    res.json({ booking: updated });
  } catch (err) {
    console.error('Update booking status error:', err);
    res.status(500).json({ error: 'Failed to update booking status.' });
  }
});

module.exports = router;
