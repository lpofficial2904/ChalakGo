import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

const events = new EventEmitter();
events.setMaxListeners(0);
let revision = randomUUID();

export function notifyAdminRequests() {
  revision = randomUUID();
  events.emit('change');
}

// Authenticated long polling: return immediately on changes, otherwise wait.
export function adminEvents(req, res) {
  res.set('Cache-Control', 'no-store');
  if (req.query.since !== revision) return res.json({ revision });
  const finish = () => {
    cleanup();
    res.json({ revision });
  };
  const timer = setTimeout(finish, 25000);
  const cleanup = () => {
    clearTimeout(timer);
    events.off('change', finish);
    res.off('close', cleanup);
  };
  events.on('change', finish);
  res.on('close', cleanup);
}
