'use strict';

function createLogger(component = 'app') {
  function base(level, msg, fields = {}) {
    const record = {
      ts: new Date().toISOString(),
      level,
      component,
      msg,
      ...fields,
    };
    // Use stdout for info/debug, stderr for warn/error
    const out = (level === 'error' || level === 'warn') ? console.error : console.log;
    out(JSON.stringify(record));
  }
  return {
    info: (msg, fields) => base('info', msg, fields),
    warn: (msg, fields) => base('warn', msg, fields),
    error: (msg, fields) => base('error', msg, fields),
    debug: (msg, fields) => base('debug', msg, fields),
    child: (childName) => createLogger(`${component}:${childName}`),
  };
}

module.exports = { createLogger };

