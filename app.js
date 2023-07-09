const express = require('express');
const basicAuth = require('express-basic-auth');
const requestIp = require('request-ip');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const port = 3000;

// Define the blocked IP addresses
const blockedIPs = ['192.168.0.1', '192.168.0.2'];
const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.jfif', '.gif', '.avif'];

// Define the username and password for authentication
const auth = {
  users: {
    admin: 'password123',
  },
};

// Define the base URL for user-facing images
//const baseUserURL = 'https://img-cdn-tfsb.onrender.com/cdn/images/';
// const baseUserURL = 'http://127.0.0.1:3000/cdn/images/';

// Middleware to check IP address restriction
app.use((req, res, next) => {
  const clientIP = requestIp.getClientIp(req);
  if (blockedIPs.includes(clientIP)) {
    return res.status(403).send('Access denied from your IP address.');
  }
  next();
});

// Middleware for basic authentication
app.use(basicAuth({
  users: auth.users,
  challenge: true,
}));

// Serve the admin HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-4.html'));
});

// Endpoint to fetch user URLs
app.get('/user-urls', (req, res) => {
  var baseUserURL1 //= `${req.protocol}://${req.hostname}/cdn/images/`
  console.log(req.hostname, req.protocol, req.secure)
  var host = req.hostname
  var port_num
  if (host == "localhost" || host == "127.0.0.1") {
    port_num = `:${port}`
  } else {
    port_num = ''
  }
  baseUserURL1 = `//${host}${port_num}/cdn/images/`
  console.log(baseUserURL1)
  const userURLs = fs.readdirSync(path.join(__dirname, 'images'))
    .map(file => {
      const hash = crypto.createHash('md5').update(file).digest('hex');
      return `${baseUserURL1}${file}?hash=${hash}`;
    });
  res.json({ userURLs });
});

// Endpoint to delete all images
app.delete('/delete-images', (req, res) => {
  const directory = path.join(__dirname, 'images');
  fs.readdir(directory, (err, files) => {
    if (err) {
      return res.status(500).send('Failed to delete images.');
    }
    for (const file of files) {
      fs.unlink(path.join(directory, file), err => {
        if (err) {
          console.log(`Failed to delete image: ${file}`);
        }
      });
    }
    res.sendStatus(200);
  });
});

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'images'),
  filename: (req, file, cb) => {
    const uniqueName = uuidv4();
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(extension)) {
      const fileName = `${uniqueName}${extension}`;
      cb(null, fileName);
    } else {
      cb(`${extension.replace(".", "")} is not allowed to upload!`, false)
    }
  },
});
const upload = multer({ storage });

// Handle file upload endpoint
app.post('/cdn/upload', upload.single('image'), (req, res) => {
  res.sendStatus(200);
});

// Serve images based on the filename and content hash
app.use('/cdn/images/:file', (req, res, next) => {
  const fileName = req.params.file;
  const imghash = req.query.hash;
  const filePath = path.join(__dirname, 'images', fileName);

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(403).send('Access denied. Invalid image hash.');
  }

  // Verify if the image content hash matches the filename
  const hash = crypto.createHash('md5').update(fileName).digest('hex');
  if (hash !== imghash) {
    return res.status(403).send('Access denied. Invalid image hash.');
  }

  // Determine the content type based on the file extension
  const extension = path.extname(filePath).toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    return res.status(404).send('File not found.');
  }

  res.sendFile(filePath);
});

// Start the server
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
