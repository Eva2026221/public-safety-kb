const mammoth = require('mammoth');
mammoth.extractRawText({path: process.argv[2]}).then(r => {
  console.log('字數:', r.value.length);
  console.log(r.value.substring(0, 6000));
});
