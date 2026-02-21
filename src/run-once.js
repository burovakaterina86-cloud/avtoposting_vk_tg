// Launcher for "run once" mode (no cross-env needed on Windows)
process.env.RUN_ONCE = 'true';
import('./index.js');
