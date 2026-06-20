import { PORT } from './config.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Evidence chain server running at http://127.0.0.1:${PORT}`);
});
