const mammoth = require('mammoth');
mammoth.extractRawText({path: process.argv[2]}).then(r => {
  process.stdout.write(r.value);
});
