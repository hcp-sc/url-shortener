const express = require('express');
const fs = require('fs');
const { nanoid } = require('nanoid');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'urls.json');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/shorten', (req, res) => {
  const urlToShorten = req.body.url;
  const shortUrlId = req.body.linkid??nanoid(6);

  urls = fs.existsSync(DATA_FILE)?JSON.parse(fs.readFileSync(DATA_FILE)):{};

  urls[shortUrlId] = urlToShorten;
  fs.writeFileSync(DATA_FILE, JSON.stringify(urls));

  return res.send(`http://localhost:${PORT}/${shortUrlId}`);
});

app.get('/:shortURL', (req, res) => {
  const shortURL = req.params.shortURL;
  const urls = JSON.parse(fs.readFileSync(DATA_FILE));
  console.log(urls[shortURL])
  const originalUrl = urls[shortURL];
  if (originalUrl) {
    return res.redirect(originalUrl);
  } else {
    return res.status(404).send('uh oh! you made a type o!');
  }
});

app.listen(PORT, () => {
  console.log(`Server on 127.0.0.1:${PORT} (womp womp windows user idk if it works, idgaf)`);
});
