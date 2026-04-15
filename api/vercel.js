import { createServer } from 'node:http';
import app from './index.js';

const server = createServer(app);
server.listen(3000, () => {
  console.log('Server ready on port 3000');
});
