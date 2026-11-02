/**
 * Run this once to create your admin password.
 *
 *   npm run create-admin
 *
 * It asks you to type a password (hidden), hashes it with bcrypt,
 * and prints a line you paste into your .env file as ADMIN_PASSWORD_HASH.
 * Your real password is never saved anywhere.
 */
const readline = require('readline');
const bcrypt = require('bcryptjs');

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Hide typed characters
    const onData = (char) => {
      char = char + '';
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.removeListener('data', onData);
      } else {
        process.stdout.write('\x1B[2K\x1B[200D' + question + Array(rl.line.length + 1).join('*'));
      }
    };
    process.stdin.on('data', onData);

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

(async () => {
  console.log('Set up your admin password');
  console.log('----------------------------');
  const password = await askHidden('Choose a password: ');
  console.log('');

  if (!password || password.length < 8) {
    console.error('\nPassword must be at least 8 characters. Run "npm run create-admin" again.');
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 12);
  console.log('Add this line to your .env file:\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('\nDone. Keep your .env file private and never commit it.');
  process.exit(0);
})();
