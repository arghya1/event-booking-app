const API_BASE = 'http://localhost:5000/api';

function eventHubApp() {
  return {
    // Navigation & UI state
    activeTab: 'events', // 'events' | 'bookings' | 'admin'
    loading: false,
    toast: { show: false, message: '', type: 'success' },

    // Auth state
    token: localStorage.getItem('eventhub_token') || '',
    user: JSON.parse(localStorage.getItem('eventhub_user') || 'null'),
    showAuthModal: false,
    authMode: 'login', // 'login' | 'register'
    authForm: { name: '', email: '', password: '' },

    // Events state
    events: [],
    searchQuery: '',
    selectedCategory: 'All',
    categories: ['All', 'Music', 'Tech', 'Workshop', 'Food', 'General'],

    // Booking modal state
    showBookModal: false,
    bookingEvent: null,
    bookingSeats: 1,

    // Bookings list
    bookings: [],

    // Admin Event modal state
    showEventModal: false,
    editingEventId: null,
    eventForm: {
      title: '',
      description: '',
      category: 'General',
      venue: '',
      event_date: '',
      price: 10,
      total_seats: 50,
      image_url: 'https://images.pexels.com/photos/30433578/pexels-photo-30433578.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    pexelsPresets: [
      { label: 'Concert', url: 'https://images.pexels.com/photos/30433578/pexels-photo-30433578.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { label: 'Tech Summit', url: 'https://images.pexels.com/photos/29708256/pexels-photo-29708256.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { label: 'Art Studio', url: 'https://images.pexels.com/photos/6925106/pexels-photo-6925106.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { label: 'Food Festival', url: 'https://images.pexels.com/photos/5321638/pexels-photo-5321638.jpeg?auto=compress&cs=tinysrgb&w=800' }
    ],

    async init() {
      await this.fetchEvents();
      if (this.token) {
        await this.fetchMe();
        await this.fetchBookings();
      }
    },

    get isAdmin() {
      return this.user && this.user.role === 'admin';
    },

    get filteredEvents() {
      return this.events.filter(ev => {
        const matchesCat = this.selectedCategory === 'All' || ev.category === this.selectedCategory;
        const q = this.searchQuery.toLowerCase().trim();
        const matchesQuery = !q ||
          ev.title.toLowerCase().includes(q) ||
          ev.venue.toLowerCase().includes(q) ||
          ev.description.toLowerCase().includes(q);
        return matchesCat && matchesQuery;
      });
    },

    notify(message, type = 'success') {
      this.toast = { show: true, message, type };
      setTimeout(() => {
        this.toast.show = false;
      }, 3200);
    },

    async apiFetch(path, options = {}) {
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }
      return data;
    },

    // --- Auth ---
    openAuth(mode = 'login') {
      this.authMode = mode;
      this.authForm = { name: '', email: '', password: '' };
      this.showAuthModal = true;
    },

    fillDemo(role) {
      this.authMode = 'login';
      if (role === 'admin') {
        this.authForm.email = 'admin@eventhub.com';
        this.authForm.password = 'admin123';
      } else {
        this.authForm.email = 'student@eventhub.com';
        this.authForm.password = 'user123';
      }
    },

    async submitAuth() {
      try {
        const endpoint = this.authMode === 'login' ? '/auth/login' : '/auth/register';
        const data = await this.apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(this.authForm)
        });
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('eventhub_token', data.token);
        localStorage.setItem('eventhub_user', JSON.stringify(data.user));
        this.showAuthModal = false;
        this.notify(`Welcome, ${data.user.name}!`);
        await this.fetchEvents();
        await this.fetchBookings();
      } catch (err) {
        this.notify(err.message, 'error');
      }
    },

    async fetchMe() {
      try {
        const data = await this.apiFetch('/auth/me');
        this.user = data.user;
        localStorage.setItem('eventhub_user', JSON.stringify(data.user));
      } catch {
        this.logout(false);
      }
    },

    logout(showMsg = true) {
      this.token = '';
      this.user = null;
      this.bookings = [];
      localStorage.removeItem('eventhub_token');
      localStorage.removeItem('eventhub_user');
      this.activeTab = 'events';
      this.fetchEvents();
      if (showMsg) this.notify('Logged out successfully.');
    },

    // --- Events ---
    async fetchEvents() {
      this.loading = true;
      try {
        const data = await this.apiFetch('/events');
        this.events = data.events;
      } catch (err) {
        this.notify('Could not connect to backend API.', 'error');
      } finally {
        this.loading = false;
      }
    },

    openCreateEvent() {
      this.editingEventId = null;
      this.eventForm = {
        title: '',
        description: '',
        category: 'General',
        venue: '',
        event_date: '2026-12-25T18:00',
        price: 15,
        total_seats: 50,
        image_url: this.pexelsPresets[0].url
      };
      this.showEventModal = true;
    },

    openEditEvent(ev) {
      this.editingEventId = ev.id;
      this.eventForm = {
        title: ev.title,
        description: ev.description,
        category: ev.category,
        venue: ev.venue,
        event_date: ev.event_date,
        price: ev.price,
        total_seats: ev.total_seats,
        image_url: ev.image_url || this.pexelsPresets[0].url
      };
      this.showEventModal = true;
    },

    async saveEvent() {
      try {
        if (this.editingEventId) {
          await this.apiFetch(`/events/${this.editingEventId}`, {
            method: 'PUT',
            body: JSON.stringify(this.eventForm)
          });
          this.notify('Event updated!');
        } else {
          await this.apiFetch('/events', {
            method: 'POST',
            body: JSON.stringify(this.eventForm)
          });
          this.notify('Event created in DRAFT state!');
        }
        this.showEventModal = false;
        await this.fetchEvents();
      } catch (err) {
        this.notify(err.message, 'error');
      }
    },

    async changeEventStatus(eventId, nextStatus) {
      try {
        await this.apiFetch(`/events/${eventId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus })
        });
        this.notify(`Event status updated to ${nextStatus}`);
        await this.fetchEvents();
        await this.fetchBookings();
      } catch (err) {
        this.notify(err.message, 'error');
      }
    },

    async deleteEvent(eventId) {
      try {
        await this.apiFetch(`/events/${eventId}`, { method: 'DELETE' });
        this.notify('Event deleted.');
        await this.fetchEvents();
      } catch (err) {
        this.notify(err.message, 'error');
      }
    },

    // --- Bookings ---
    async fetchBookings() {
      if (!this.token) return;
      try {
        const data = await this.apiFetch('/bookings');
        this.bookings = data.bookings;
      } catch (err) {
        this.notify(err.message, 'error');
      }
    },

    openBookModal(ev) {
      if (!this.user) {
        this.openAuth('login');
        this.notify('Please log in to book tickets.', 'error');
        return;
      }
      this.bookingEvent = ev;
      this.bookingSeats = 1;
      this.showBookModal = true;
    },

    async submitBooking() {
      try {
        await this.apiFetch('/bookings', {
          method: 'POST',
          body: JSON.stringify({
            event_id: this.bookingEvent.id,
            seats: this.bookingSeats
          })
        });
        this.showBookModal = false;
        this.notify('Booking created (PENDING approval)!');
        await this.fetchEvents();
        await this.fetchBookings();
        this.activeTab = 'bookings';
      } catch (err) {
        this.notify(err.message, 'error');
      }
    },

    async changeBookingStatus(bookingId, nextStatus) {
      try {
        await this.apiFetch(`/bookings/${bookingId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus })
        });
        this.notify(`Booking ${nextStatus.toLowerCase()}!`);
        await this.fetchEvents();
        await this.fetchBookings();
      } catch (err) {
        this.notify(err.message, 'error');
      }
    },

    // --- Formatting Helpers ---
    formatDate(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    },

    statusBadgeClass(status) {
      const map = {
        DRAFT: 'bg-slate-200 text-slate-700',
        PUBLISHED: 'bg-emerald-100 text-emerald-700',
        CANCELLED: 'bg-rose-100 text-rose-700',
        COMPLETED: 'bg-indigo-100 text-indigo-700',
        PENDING: 'bg-amber-100 text-amber-800',
        CONFIRMED: 'bg-emerald-100 text-emerald-700'
      };
      return map[status] || 'bg-slate-100 text-slate-700';
    }
  };
}
