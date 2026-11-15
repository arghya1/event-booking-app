// Explicit State Machines for Events and Bookings

const EVENT_TRANSITIONS = {
  DRAFT: ['PUBLISHED'],
  PUBLISHED: ['CANCELLED', 'COMPLETED'],
  CANCELLED: [],
  COMPLETED: []
};

const BOOKING_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'],
  CANCELLED: []
};

function canTransitionEvent(currentStatus, nextStatus) {
  const allowed = EVENT_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

function canTransitionBooking(currentStatus, nextStatus) {
  const allowed = BOOKING_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

module.exports = {
  EVENT_TRANSITIONS,
  BOOKING_TRANSITIONS,
  canTransitionEvent,
  canTransitionBooking
};
