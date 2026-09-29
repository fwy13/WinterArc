import bcrypt from 'bcryptjs';
import { emitKeypressEvents } from 'node:readline';

// Read interactively: no plaintext password in shell history, argv or files.
if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal.');
emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdout.write('Admin password (12+ characters, max 72 UTF-8 bytes): ');
let password = '';
process.stdin.on('keypress', async (text: string, key: { name?: string; ctrl?: boolean }) => {
  if (key.ctrl && key.name === 'c') { process.stdin.setRawMode(false); process.exit(130); }
  if (key.name === 'backspace') { password = [...password].slice(0, -1).join(''); return; }
  if (key.name !== 'return') {
    if (text && !/[\u0000-\u001f\u007f]/.test(text)) password += text;
    return;
  }
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write('\n');
  if ([...password].length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    console.error('Use at least 12 characters and at most 72 UTF-8 bytes.'); process.exitCode = 1; return;
  }
  const hash = await bcrypt.hash(password, 12);
  password = '';
  console.log(`ADMIN_PASSWORD_HASH='${hash}'`);
});
