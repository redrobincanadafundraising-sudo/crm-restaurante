    require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Neon Database Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test Database Connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error acquiring client', err.stack);
    } else {
        console.log('Successfully connected to Neon PostgreSQL database.');
        release();
    }
});

// ==========================================
// API ROUTES
// ==========================================

// GET all users
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, full_name, email, role, store_id, is_active 
            FROM users 
            ORDER BY role, full_name
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET all tickets
app.get('/api/tickets', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.id, t.title, t.category, t.priority, t.status, 
                   u.full_name as assigned_to_name, t.origin_store_id
            FROM tickets t
            LEFT JOIN users u ON t.assigned_to = u.id
            ORDER BY t.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching tickets:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST a new ticket
app.post('/api/tickets', async (req, res) => {
    const { title, description, category, priority, assigned_to, origin_store_id, created_by } = req.body;
    try {
        const result = await pool.query(`
            INSERT INTO tickets (title, description, category, priority, assigned_to, origin_store_id, created_by, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Open')
            RETURNING *
        `, [title, description, category, priority, assigned_to, origin_store_id, created_by]);
        
        console.log(`New ticket created: ${result.rows[0].id}.`);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating ticket:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check route for Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Red Robin CRM API is running' });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log('=================================================');
    console.log('Red Robin CRM Server started successfully!');
    console.log(`Listening on port: ${PORT}`);
    console.log('=================================================');
});
