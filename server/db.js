/**
 * Very small file-based database.
 *
 * This stores everything in server/data/db.json. It's intentionally simple
 * so the project runs anywhere with zero setup — no database server to
 * install. It's a good fit while you're getting started or for
 * low-to-moderate traffic.
 *
 * When you outgrow it: the only file that talks to storage is this one.
 * Swap the implementation for Postgres/MySQL/MongoDB and every route file
 * stays the same, as long as you keep the same function signatures.
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Simple write queue so two writes in quick succession can't clobber each other
let writeChain = Promise.resolve();

function readRaw() {
  const text = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(text);
}

function writeRaw(data) {
  writeChain = writeChain.then(
    () =>
      new Promise((resolve, reject) => {
        const tmpPath = DB_PATH + '.tmp';
        fs.writeFile(tmpPath, JSON.stringify(data, null, 2), (err) => {
          if (err) return reject(err);
          fs.rename(tmpPath, DB_PATH, (err2) => {
            if (err2) return reject(err2);
            resolve();
          });
        });
      })
  );
  return writeChain;
}

function read() {
  return readRaw();
}

async function update(mutatorFn) {
  const data = readRaw();
  const result = mutatorFn(data);
  await writeRaw(data);
  return result;
}

module.exports = { read, update };
