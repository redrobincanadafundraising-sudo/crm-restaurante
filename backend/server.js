const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'captains_secret_key';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; 
    next();
  });
};

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (user && password === 'password123') { 
      const token = jwt.sign({ id: user.id, role: user.role, store_id: user.store_id, name: user.full_name }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, role: user.role, name: user.full_name });
    }
    res.status(401).json({ error: 'Credenciais inválidas' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT t.*, s.name as store_name, u.full_name as creator_name FROM tickets t JOIN stores s ON t.store_id = s.id JOIN users u ON t.created_by_user_id = u.id';
    let params = [];
    if (req.user.role === 'store_manager') {
      query += ' WHERE t.store_id = $1';
      params.push(req.user.store_id);
    } else { query += ' ORDER BY t.created_at DESC'; }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use(express.static(path.join(__dirname, './')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
