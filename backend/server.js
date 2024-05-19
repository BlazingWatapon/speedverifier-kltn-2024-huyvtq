const express = require('express');
const cors = require('cors');
const db = require('./db'); // Import the db module
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const loginRoute = require('./routes/login');
const registerRoute = require('./routes/register');
const validateRoute = require('./routes/validate');
const uploadRoute = require('./routes/upload'); 

// Use the routes
app.use('/api', loginRoute);
app.use('/api', registerRoute);
app.use('/api', validateRoute);
app.use('/api', uploadRoute);

app.get('/api/total-validations/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.query('SELECT COUNT(*) AS count FROM single_emails WHERE users_id = ?', [userId]);
    const totalValidations = rows[0].count;
    res.json({ totalValidations });
  } catch (error) {
    console.error('Error fetching total validations:', error);
    res.status(500).send('Server error');
  }
});

app.get('/api/status-data/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT status, COUNT(*) AS count FROM single_emails WHERE users_id = ? GROUP BY status',
      [userId]
    );
    const statusOrder = ['valid', 'not existed', 'block', 'full', 'syntax error', 'unknown'];
    const statusData = statusOrder.map(status => ({
      status: status,
      count: rows.find(row => row.status === status)?.count || 0
    }));
    res.json(statusData);
  } catch (error) {
    console.error('Error fetching status data:', error);
    res.status(500).send('Server error');
  }
});

app.get('/api/history/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT idlist_emails, filename, date FROM list_emails WHERE users_id = ? ORDER BY idlist_emails DESC LIMIT 10',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).send('Server error');
  }
});

app.get('/api/download-zip/:id', async (req, res) => { // Updated endpoint name
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT valid_file, invalid_file, file FROM list_emails WHERE idlist_emails = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).send('File not found');
    }

    const validFilePath = path.join(__dirname, 'uploads', `${id}_valid.csv`);
    const invalidFilePath = path.join(__dirname, 'uploads', `${id}_invalid.csv`);
    const originalFilePath = path.join(__dirname, 'uploads', `${id}_original`); // Naming original file

    fs.writeFileSync(validFilePath, rows[0].valid_file);
    fs.writeFileSync(invalidFilePath, rows[0].invalid_file);
    fs.writeFileSync(originalFilePath, rows[0].file);

    const zipFilePath = path.join(__dirname, 'uploads', `files_${id}.zip`);

    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.download(zipFilePath, (err) => {
        fs.unlinkSync(validFilePath);
        fs.unlinkSync(invalidFilePath);
        fs.unlinkSync(originalFilePath);
        fs.unlinkSync(zipFilePath);
        if (err) {
          console.error('Error downloading file:', err);
        }
      });
    });

    archive.pipe(output);
    archive.append(fs.createReadStream(validFilePath), { name: 'valid_file.csv' });
    archive.append(fs.createReadStream(invalidFilePath), { name: 'invalid_file.csv' });
    archive.append(fs.createReadStream(originalFilePath), { name: 'original_file' }); // Adding original file
    archive.finalize();

  } catch (error) {
    console.error('Error downloading files:', error);
    res.status(500).send('Server error');
  }
});

app.delete('/api/history/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM list_emails WHERE idlist_emails = ?', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting history:', error);
    res.status(500).send('Server error');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
