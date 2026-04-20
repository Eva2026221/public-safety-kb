const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const buf = fs.readFileSync(process.argv[2]);
const parser = new PDFParse();
parser.parse(buf).then(d => {
  console.log('pages:', d.numpages);
  console.log(d.text.substring(0, 4000));
}).catch(e => console.error(e));
