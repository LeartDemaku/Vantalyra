require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nexuscloud_super_secret_key';

// Database setup (MOVE TO TOP)
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('Error connecting to database:', err.message);
    else console.log('Connected to the SQLite database.');
});

// EMERGENCY DELETE ROUTE (Top Priority)
app.get('/fshirja-emergjente/:id', (req, res) => {
    const docId = req.params.id;
    console.log(`PO FSHIHET DOKUMENTI ME ID: ${docId}`);
    db.run('DELETE FROM documents WHERE id = ?', [docId], function(err) {
        res.redirect('/dashboard.html');
    });
});

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// RRUGA E FSHIRJES - PRIORITETI ZERO (Garantuar 100%)
app.get('/fshij/:id', (req, res) => {
    const docId = req.params.id;
    console.log(`KLIKU U MOR: FSHIRJA E DOKUMENTIT ME ID ${docId}`);
    
    if (db) {
        db.run('DELETE FROM documents WHERE id = ?', [docId], function(err) {
            if (err) console.error('Gabim gjatë fshirjes:', err.message);
            res.redirect('/dashboard.html');
        });
    } else {
        res.status(500).send('Databaza nuk është gati.');
    }
});

// Standard JWT Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) return res.status(401).json({ error: 'Mungon tokeni i aksesit.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token jo valid.' });
        req.user = user;
        next();
    });
}

// Register
app.post('/api/register', async (req, res) => {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
        return res.status(400).json({ error: 'Ju lutem mbushni të gjitha fushat.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)',
            [full_name, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Ky email është regjistruar më parë.' });
                    }
                    return res.status(500).json({ error: 'Gabim gjatë regjistrimit.' });
                }
                res.status(201).json({ message: 'Llogaria u krijua me sukses!' });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Gabim sistemi.' });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Ju lutem mbushni të gjitha fushat.' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Gabim sistemi.' });
        if (!user) return res.status(400).json({ error: 'Përdoruesi nuk ekziston.' });

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'Fjalëkalim i gabuar.' });

        const token = jwt.sign({ id: user.id, email: user.email, name: user.full_name }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, name: user.full_name });
    });
});

// Documents handlers
app.get('/api/documents', authenticateToken, (req, res) => {
    db.all('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Gabim gjatë marrjes së dokumenteve.' });
        res.json(rows);
    });
});

app.post('/api/documents', authenticateToken, (req, res) => {
    const { filename, format, resource_type, url } = req.body;

    if (!filename || !url) {
        return res.status(400).json({ error: 'Të dhëna të paplota të dokumentit.' });
    }

    db.run(
        'INSERT INTO documents (user_id, filename, format, resource_type, url) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, filename, format || 'unknown', resource_type || 'auto', url],
        function(err) {
            if (err) return res.status(500).json({ error: 'Gabim gjatë ruajtjes së dokumentit.' });
            
            db.get('SELECT * FROM documents WHERE id = ?', [this.lastID], (err, doc) => {
                if (err) return res.status(500).json({ error: 'Dokumenti u ruajt por nuk mund të kthehej.' });
                res.status(201).json(doc);
            });
        }
    );
});

// Legacy DELETE route (for fetch fallback)
app.delete('/api/documents/:id', authenticateToken, (req, res) => {
    const docId = req.params.id;
    db.run('DELETE FROM documents WHERE id = ? AND user_id = ?', [docId, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: 'Gabim gjatë fshirjes së dokumentit.' });
        if (this.changes === 0) return res.status(404).json({ error: 'Dokumenti nuk u gjet ose nuk keni autorizim.' });
        res.json({ message: 'Dokumenti u fshi me sukses.' });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
