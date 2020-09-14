/**
 * when deploying, internal tools isn't needed and local linking is currently being avoided
 * jq and grep could also be used but they have crossplatform usability issues
 */
const fs = require('fs');
pkg = JSON.parse(fs.readFileSync(process.argv[2]));
delete pkg.devDependencies['internal-tools'];
fs.writeFileSync(process.argv[2], JSON.stringify(pkg));
