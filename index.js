/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */
import { loadFile } from './database_mgmt/sqlite.mjs';
import express from 'express';
import { nanoid } from 'nanoid';
import path from 'path';
import { env } from 'process';
import { fileURLToPath } from 'url';
import multer from 'multer';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = env.PORT??3000;
const HOST = env.HOST??"0.0.0.0"
const DATA_FILE = path.join(__dirname, env.FILENAME??'urls.sqlite');
const NOUI = env.NOUI;
const REDIRECTURI = env.REDIRECTURI;
const urls = await loadFile(DATA_FILE);

/**
 * What to do on errrs.
 * 
 * @param {Request} req - Request
 * @param {Response} res - Response
 * @returns {void}
 */
function redirect(req, res) {
  try {
    new URL(REDIRECTURI);
    res.redirect(301, REDIRECTURI)
  } catch {
    req.socket.destroy()
  }
}

if(!NOUI)app.use(express.static(path.join(__dirname, 'public')));
else app.get("/",redirect)

app.post('/shorten', multer().none(), (req, res) => {
  console.log(req)
  if(NOUI)return redirect(req,res);
  if(!req.body.url)return req.socket.close();
  const urlToShorten = req.body.url;
  let shortUrlId = req.body.linkid;
  let expiry = req.body.expiry;
  console.log(expiry)
  if(shortUrlId.length>20) res.status.status(400).send(JSON.stringify({
    message: "URL that was shortened was too long.",
    extra: shortUrlId + "was too long."
  }));

  let url;
  try {
    url = new URL(urlToShorten);
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

  urls[shortUrlId] = {
    fulllink: urlToShorten,
    expiry: expiry
  };

  return res.send(JSON.stringify({
    message: shortUrlId
  }));
});

app.get('/:shortURL', (req, res) => {
  if(req.params.shortURL==="shorten")return;
  const data = urls[req.params.shortURL];
  const originalUrl = data?.fulllink;

  if (originalUrl) {
    if(Date.now()>(new Date(data?.expiry).getTime())) {
      delete urls[req.params.shortURL];
      return res.status(418).sendFile(path.resolve(__dirname, 'public', 'teapot.html'))
    }
    return res.redirect(307, originalUrl);
  } else {
    return redirect(req, res);
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Server on 127.0.0.1:${PORT} (womp womp windows user idk if it works, idgaf)`);
});
