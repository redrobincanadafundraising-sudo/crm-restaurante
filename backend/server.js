const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Central Postgre Database neon.tech layer configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Serve frontend directory assets explicitly
app.use(express.static(path.join(__dirname, './')));

// Secure Authorization Endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, role, store_id FROM users WHERE email = $1 AND password_hash = $2',
      [email, password]
    );
    
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.status(401).json({ success: false, message: 'Invalid corporate email or password.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal cloud system data error.' });
  }
});

// Dynamic Store Metrics Fetching Endpoint
app.get('/api/metrics', async (req, res) => {
  const { store_id, role } = req.query;
  try {
    let query = 'SELECT COALESCE(SUM(emails_sent), 0) as emails_sent, COALESCE(SUM(errors), 0) as errors, COALESCE(SUM(opportunities), 0) as opportunities FROM store_metrics';
    const params = [];
    
    // Store managers only pull structural records for their own branch assignment context
    if (role === 'store_manager' && store_id) {
      query += ' WHERE store_id = $1';
      params.push(store_id);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving branch metric matrix details.' });
  }
});

// View Pipeline Task Log Registry Entries
app.get('/api/tasks', async (req, res) => {
  const { store_id, role } = req.query;
  try {
    let query = 'SELECT * FROM tasks';
    const params = [];
    
    if (role === 'store_manager' && store_id) {
      query += ' WHERE store_id = $1';
      params.push(store_id);
    }
    
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching dynamic operational logs.' });
  }
});

// Append New Log Entry
app.post('/api/tasks', async (req, res) => {
  const { title, description, store_id, status } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, description, store_id, status, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [title, description, store_id || null, status || 'Pending']
    );
    res.json({ success: true, task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error logging real-time pending transaction record.' });
  }
});

// Bind Port configuration
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Application layer executing cleanly on port ${PORT}`);
});
