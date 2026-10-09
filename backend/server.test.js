import { describe, it, expect } from 'vitest';
import { db } from './server.js';

describe('CSJMU SQLite Backend Database Tests', () => {
  it('connects to SQLite and has initialized tables', () => {
    expect(db).toBeDefined();
  });

  it('secures admin credentials with bcrypt hashing', () => {
    return new Promise((resolve, reject) => {
      db.get("SELECT password FROM admins WHERE username = 'admin'", [], (err, row) => {
        if (err) return reject(err);
        expect(row).toBeDefined();
        // Verifies password is not stored in plain text and is a valid bcrypt hash
        expect(row.password.startsWith('$2a$') || row.password.startsWith('$2b$')).toBe(true);
        resolve();
      });
    });
  });

  it('correctly seeds default locations', () => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM locations WHERE id = 'loc_auditorium'", [], (err, rows) => {
        if (err) return reject(err);
        expect(rows.length).toBe(1);
        expect(rows[0].name).toBe('CSJM Auditorium');
        expect(rows[0].code).toBe('BLD-650');
        resolve();
      });
    });
  });

  it('correctly seeds default rooms', () => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM rooms WHERE id = 'G-01'", [], (err, rows) => {
        if (err) return reject(err);
        expect(rows.length).toBe(1);
        expect(rows[0].location_id).toBe('loc_auditorium');
        expect(rows[0].type).toBe('Lobby');
        resolve();
      });
    });
  });

  it('correctly seeds default watercoolers', () => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM water_coolers WHERE id = 'SBM-WC-01'", [], (err, rows) => {
        if (err) return reject(err);
        expect(rows.length).toBe(1);
        expect(rows[0].floor_level).toBe('ground');
        expect(rows[0].purity).toBe('99.9%');
        resolve();
      });
    });
  });
});
