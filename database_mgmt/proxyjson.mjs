/**
 * @typedef {'r' | 'r+' | 'w' | 'w+' | 'a' | 'a+'} FileOpenMode
 * 
 * FileOpenMode represents the many ways a file can be opened
 * - `r` Opens a file for reading. **FILE MUST EXIST.**
 * - `r+` Same as `r` but you can also write. File must still exist.
 * - `w` Truncate the file to 0 length then open it for writing. Creates the file if it does not exist.
 * - `w+` Same as `w` but you can also read.
 * - `a` Opens the file for appending, opens it for writing without overwriting it to zeros, and skips to the end.
 * - `a+` Same as `a` but you can also read.
 */
import fs from 'fs/promises';
import fsSync from 'fs'; // we need fs.watch
import { promisify } from 'util';
import { resolve } from 'path';
import { flock } from 'fs-ext'; 

/**
 * Checks the existence of a file, given the filepath. 
 * 
 * @param {string} filepath - The file path to check existence of
 * @returns {Promise<boolean>} - Does it exist or not
 */
async function fileExists(filepath) {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves content to a file.
 * 
 * @param {string} filepath - The filepath to which to write the content to.
 * @param {string} content - The content which to write to the file. Remember to use JSON.stringify on objects.
 * @param {FileOpenMode} mode - The mode of which to open the file, `r`, `a`, and `a+` are heavily discouraged, unless you are 100% sure.
 * @returns {Promise<void>} - No return.
 */
async function saveFile(filepath, content, mode="w+") {
  // flock is file lock so no other proceses can access it.
  const handle = await fs.open(filepath, mode);
  const fd = handle.fd;
  const flockAsync = promisify(flock);
  let err = null;
  try {
    // locking
    await flockAsync(fd, 'ex');

    await handle.writeFile(content, { encoding: "utf-8" });
  } finally {
    // clean up
    try {
      await flockAsync(fd, "un");
    } catch {} finally {
      await handle.close();
    }
  }
  if(err) throw err;
}

/**
 * Saves content to a file synchronously.
 * ** USE `saveFile` WHENEVER YOU CAN. **
 * @param {string} filepath - The filepath to which to write the content to.
 * @param {string} content - The content which to write to the file. Remember to use JSON.stringify on objects.
 * @param {FileOpenMode} mode - The mode of which to open the file, `r`, `a`, and `a+` are heavily discouraged, unless you are 100% sure.
 * @returns {void} - No return.
 */
async function saveFileSync(filepath, content, mode="w+") {
  // flock is file lock so no other proceses can access it.
  const fd = fsSync.openSync(filepath, mode);

  let err = null;
  try {
    // locking
    flockSync(fd, 'ex');

    fsSync.writeFileSync(fd, content, { encoding: "utf-8" });
  } finally {
    try {
      flockSync(fd, "un");
    } catch {} finally {
      fsSync.closeSync(fd);
    }
  }
  if(err) throw err;
}

/**
 * Updates an Object (target) by overwriting it from the source.
 * This is needed because changing the variable does not change the
 * contained object itself, instead the object stays the same while
 * the variable contains a new value.
 * 
 * @param {Object} target - The target object where the source should be copied.
 * @param {Object} source - The source object that will be copied onto the target.
 * @returns {void} - No return
 */
function updateData(target, source) {
  // delete keys not in the new one
  for (const key of Object.keys(target)) {
    if(!(key in source)) {
      delete target[key]
    }
  }
  // update the keys
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (typeof target[key] !== 'object' || target[key] === null) {
        target[key] = Array.isArray(source[key]) ? [] : {};
      }
      updateData(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

/**
 * Load a JSON file as an object that should be constantly
 * synchronized so as to not end up with inconsistencies.
 * 
 * @param {string} filepath - The filepath to the file that should be synchronized with the JSON.
 * @returns {Promise<Proxy>} - The proxy object that synchronoises the data file and the Object.
 */
async function loadFile(filepath) {
  let reloadTimeout;
  filepath = resolve(filepath);

  // if the file exists
  if (await fileExists(filepath)) {
    const stat = await fs.stat(filepath);
    const lstat = await fs.lstat(filepath);

    // make sure it isnt a directory, and also symlinks have odd behaviour
    if (stat.isDirectory()) throw new Error(`${filepath} is directory.`);  
    if (lstat.isSymbolicLink()) console.warn(`${filepath} if a symlink, unexpected behaviour may occur. Do not make a support ticket if you choose to continue, even if it is a unrelated error.`);
    // initialize it if it is empty
    if(!stat.size) await saveFile(filepath, '{}')
  } else {
    // if it doesnt exist, make it yourself
    await saveFile(filepath, '{}');
  }

  fsSync.watch(filepath, (eventType, filename) => {
    if (eventType === "change") {
      // throtlling the writes 
      if (reloadTimeout) clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(async ()=>{
        try {
          updateData(data, JSON.parse(await fs.readFile(filename)))
        } catch (err) {
          console.warn("Could not update the file! New links may not be saved.")
        }
      }, 50)
    }
    console.log(`Event ${eventType} emited on ${filename}`);
  })


  let data = JSON.parse(fsSync.readFileSync(filepath));
  let proxy = new Proxy(data, {
    // the return true tells js the operation succeded.
    set(target, prop, value) {
      target[prop] = value;
      saveFile(filepath, JSON.stringify(data)).catch(console.error);
      return true;
    },
    deleteProperty(target, prop) {
      delete target[prop];
      saveFile(filepath, JSON.stringify(data)).catch(console.error);
      return true;
    },
    defineProperty(target, key, descriptor) {
      Object.defineProperty(target, key, descriptor);
      saveFile(filepath, JSON.stringify(data)).catch(console.error);
      return true;
    }
  });
  
  /**
   * 
   * @param {int} [exitCode=0] Please use 0-255
   * @returns {Promise<void>} - No return
   */
  function exitHandler(exitCode=0) {
    try {
      saveFileSync(filepath, JSON.stringify(data));
    } catch {
      exitCode = 1;
    } finally {
      process.exit(exitCode);
    }
  }

  ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT', 'beforeExit'].forEach(signal=>{
    process.on(signal, exitHandler);
  })
  return proxy;
}

export { loadFile };