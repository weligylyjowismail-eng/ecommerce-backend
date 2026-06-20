const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getDb, saveDb } = require('../db/init');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * @swagger
 * /brands:
 *   get:
 *     summary: Get all brands with pagination
 *     tags: [Brands]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: List of brands
 */
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const stmt = db.prepare(`SELECT * FROM brands ORDER BY id ASC LIMIT ? OFFSET ?`);
    stmt.bind([limit, offset]);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();

    const total = db.exec(`SELECT COUNT(*) as count FROM brands`)[0].values[0][0];
    res.json({ data: rows, total, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /brands/{id}:
 *   get:
 *     summary: Get a single brand
 *     tags: [Brands]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Brand object
 */
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM brands WHERE id = ?`);
    stmt.bind([req.params.id]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    if (!row) return res.status(404).json({ error: 'Brand not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /brands:
 *   post:
 *     summary: Create a brand
 *     tags: [Brands]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               image: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const db = await getDb();
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const image = req.file ? `/uploads/${req.file.filename}` : null;
    db.run(`INSERT INTO brands (name, image) VALUES (?, ?)`, [name, image]);
    saveDb();

    const stmt = db.prepare(`SELECT last_insert_rowid() as id`);
    stmt.step();
    const { id } = stmt.getAsObject();
    stmt.free();

    const stmt2 = db.prepare(`SELECT * FROM brands WHERE id = ?`);
    stmt2.bind([id]);
    const row = stmt2.step() ? stmt2.getAsObject() : null;
    stmt2.free();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /brands/{id}:
 *   put:
 *     summary: Update a brand
 *     tags: [Brands]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM brands WHERE id = ?`);
    stmt.bind([req.params.id]);
    const existing = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    if (!existing) return res.status(404).json({ error: 'Brand not found' });

    const name = req.body.name || existing.name;
    const image = req.file ? `/uploads/${req.file.filename}` : existing.image;

    db.run(`UPDATE brands SET name=?, image=? WHERE id=?`, [name, image, req.params.id]);
    saveDb();

    const stmt2 = db.prepare(`SELECT * FROM brands WHERE id = ?`);
    stmt2.bind([req.params.id]);
    const updated = stmt2.step() ? stmt2.getAsObject() : null;
    stmt2.free();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /brands/{id}:
 *   delete:
 *     summary: Delete a brand
 *     tags: [Brands]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.run(`DELETE FROM brands WHERE id = ?`, [req.params.id]);
    saveDb();
    res.json({ message: 'Brand deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
