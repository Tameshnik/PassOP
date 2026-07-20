require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

// Define Password Schema
const passwordSchema = new mongoose.Schema({
  site: String,
  username: String,
  password: String,
  createdAt: Date,
  updatedAt: Date
});

const Password = mongoose.model('Password', passwordSchema);

// Routes
app.get('/passwords', async (req, res) => {
  const passwords = await Password.find();
  res.json(passwords);
});

app.post('/passwords', async (req, res) => {
  const newPass = new Password(req.body);
  await newPass.save();
  res.json(newPass);
});

app.put('/passwords/:id', async (req, res) => {
  const updated = await Password.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

app.delete('/passwords/:id', async (req, res) => {
  await Password.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
