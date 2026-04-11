const { spawn } = require('child_process');

console.log('Starting openclaw agent...');

const proc = spawn('openclaw', ['agent', '--agent', 'main', '--message', 'Test', '--json']);

let stdout = '';
let stderr = '';

proc.stdout.on('data', (data) => {
  stdout += data.toString();
  process.stdout.write(data);
});

proc.stderr.on('data', (data) => {
  stderr += data.toString();
});

proc.on('close', (code) => {
  console.log('\n=== EXIT:', code);
  console.log('stdout length:', stdout.length);
  process.exit(0);
});

setTimeout(() => {
  console.log('Killing...');
  proc.kill();
  process.exit(1);
}, 60000);