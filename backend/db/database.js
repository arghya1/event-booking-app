const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcrypt');

let dbInstance = null;

async function getDb() {
  if (dbInstance) return dbInstance;

  const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './db/eventhub.sqlite');
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await dbInstance.exec('PRAGMA foreign_keys = ON;');
  await initTables(dbInstance);
  await seedData(dbInstance);

  return dbInstance;
}

async function initTables(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      venue TEXT NOT NULL,
      event_date TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      total_seats INTEGER NOT NULL,
      available_seats INTEGER NOT NULL,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      seats INTEGER NOT NULL CHECK (seats >= 1 AND seats <= 5),
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );
  `);
}

async function seedData(db) {
  // Seed default Admin and Student user if users table is empty
  const userCount = await db.get('SELECT COUNT(*) AS count FROM users');
  if (userCount.count === 0) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('user123', 10);

    await db.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Campus Admin', 'admin@eventhub.com', adminHash, 'admin']
    );
    await db.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Alex Student', 'student@eventhub.com', userHash, 'user']
    );
  }

  // Seed sample events if events table is empty
  const eventCount = await db.get('SELECT COUNT(*) AS count FROM events');
  if (eventCount.count === 0) {
    const sampleEvents = [
      {
        title: 'Neon Nights Live Concert',
        description: 'An electrifying evening of indie rock, synth-pop, and live DJ sets under open-air stage lights.',
        category: 'Music',
        venue: 'Main Campus Amphitheater',
        event_date: '2026-12-05T19:00',
        price: 25,
        total_seats: 120,
        available_seats: 120,
        image_url: 'https://images.pexels.com/photos/30433578/pexels-photo-30433578.jpeg?auto=compress&cs=tinysrgb&w=800',
        status: 'PUBLISHED'
      },
      {
        title: 'FutureStack Tech Summit 2026',
        description: 'Keynotes and hands-on sessions on AI engineering, cloud architecture, and modern web development.',
        category: 'Tech',
        venue: 'Engineering Auditorium Hall A',
        event_date: '2026-12-12T10:00',
        price: 15,
        total_seats: 80,
        available_seats: 80,
        image_url: 'https://images.pexels.com/photos/29708256/pexels-photo-29708256.jpeg?auto=compress&cs=tinysrgb&w=800',
        status: 'PUBLISHED'
      },
      {
        title: 'Watercolor & Canvas Studio Workshop',
        description: 'Beginner-friendly guided painting session. All brushes, palettes, and canvases are included.',
        category: 'Workshop',
        venue: 'Fine Arts Studio 204',
        event_date: '2026-12-18T15:00',
        price: 10,
        total_seats: 30,
        available_seats: 30,
        image_url: 'https://images.pexels.com/photos/6925106/pexels-photo-6925106.jpeg?auto=compress&cs=tinysrgb&w=800',
        status: 'PUBLISHED'
      },
      {
        title: 'Winter Street Food Carnival',
        description: 'Over 20 local food stalls serving regional street classics, desserts, and live acoustic music.',
        category: 'Food',
        venue: 'Central Courtyard',
        event_date: '2026-12-22T17:30',
        price: 5,
        total_seats: 200,
        available_seats: 200,
        image_url: 'https://images.pexels.com/photos/5321638/pexels-photo-5321638.jpeg?auto=compress&cs=tinysrgb&w=800',
        status: 'DRAFT'
      }
    ];

    for (const ev of sampleEvents) {
      await db.run(
        `INSERT INTO events (title, description, category, venue, event_date, price, total_seats, available_seats, image_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ev.title,
          ev.description,
          ev.category,
          ev.venue,
          ev.event_date,
          ev.price,
          ev.total_seats,
          ev.available_seats,
          ev.image_url,
          ev.status
        ]
      );
    }
  }
}

module.exports = { getDb };
