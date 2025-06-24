import { loadFile } from './database_mgmt/sqlite.mjs';
import bodyParser from 'body-parser';
import express from 'express';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'urls.json');
const urls = await loadFile(DATA_FILE);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/shorten', (req, res) => {
  const urlToShorten = req.body.url;
  let shortUrlId = req.body.linkid;
  if(shortUrlId.length>20) res.status.status(400).send(JSON.stringify({
    message: "URL that was shortened was too long.",
    extra: shortUrlId + "was too long."
  }));

  try {
    let url = new URL(urlToShorten);
  } catch {
    return res.status(400).send(JSON.stringify({message: "Could not parse URL."}));
  }
  if (!["http:","https:"].includes(url.protocol)) return res.status(400).send(JSON.stringify({
    message: "Invalid URL",
    extra: "URL does not appear to use HTTP or HTTPS."
  }));

  while(!shortUrlId) {
    let newId = nanoid(10);
    if(!urls[newId]) {
      shortUrlId = newId;
    }
  }

  if(urls[shortUrlId]) return res.status(409).send(JSON.stringify({
    message: "Short URL was already taken",
    extra: shortUrlId + "was already taken."
  }));

  urls[shortUrlId] = urlToShorten;

  return res.send(`http://localhost:${PORT}/${shortUrlId}`);
});

app.get('/:shortURL', (req, res) => {
  const originalUrl = urls[req.params.shortURL];
  
  if (originalUrl) {
    return res.redirect(307, originalUrl);
  } else {
    return res.status(404).send('uh oh! you made a type o!');
  }
});

app.listen(PORT, () => {
  console.log(`Server on 127.0.0.1:${PORT} (womp womp windows user idk if it works, idgaf)`);
});
