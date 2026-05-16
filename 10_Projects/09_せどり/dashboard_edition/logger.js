const fs = require('fs');
const path = require('path');

const logFile = path.resolve(__dirname, 'error.log');

function log(message, type = 'ERROR') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type}] ${message}\n`;
    
    console.log(logMessage.trim()); // Console output for immediate feedback
    
    try {
        fs.appendFileSync(logFile, logMessage);
    } catch (err) {
        console.error('Failed to write to log file:', err);
    }
}

function clearLog() {
    try {
        fs.writeFileSync(logFile, '');
    } catch (err) {
        process.stderr.write('Failed to clear log file\n');
    }
}

module.exports = { log, clearLog };
